import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

// End-to-end tests execute the production main and preload bundles through a
// test-only bootstrap that sets app.userData BEFORE electron-store is loaded.
// All credentials are fictional. Never print credentials, profile or CDP payloads.
if (process.platform !== 'win32' || process.env.CI !== 'true') {
  throw new Error('Only run this test on a disposable Windows CI runner')
}
const require = createRequire(import.meta.url)
const electron = require('electron')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const scratch = mkdtempSync(path.join(os.tmpdir(), 'foro-electron-smoke-'))
const profile = path.join(scratch, 'profile')
mkdirSync(profile, { recursive: true })
const settings = {
  mockMode: true, apiKey: '', hasApiKey: false,
  apiBaseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini',
  disclaimerAccepted: true,
}
let child = null
let connection = null
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
async function freePort() {
  const server = createServer()
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      server.close(() => resolve(port))
    })
  })
}
class CDP {
  constructor(socket) {
    this.socket = socket
    this.nextId = 0
    this.pending = new Map()
    socket.addEventListener('message', event => {
      let msg
      try { msg = JSON.parse(event.data) } catch { return }
      const pending = this.pending.get(msg.id)
      if (!pending) return
      this.pending.delete(msg.id)
      clearTimeout(pending.timer)
      if (msg.error) pending.reject(new Error('CDP command rejected'))
      else pending.resolve(msg.result)
    })
    socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer)
        pending.reject(new Error('CDP disconnected'))
      }
      this.pending.clear()
    })
  }
  command(method, params = {}) {
    const id = ++this.nextId
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`CDP ${method} timeout`))
      }, 20000)
      this.pending.set(id, { resolve, reject, timer })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }
  async eval(body) {
    const result = await this.command('Runtime.evaluate', {
      expression: `(async () => { ${body} })()`,
      awaitPromise: true, returnByValue: true,
    })
    if (result.exceptionDetails || result.result?.subtype === 'error') {
      throw new Error('Renderer test evaluation failed')
    }
    return result.result?.value
  }
  close() { this.socket.close() }
}
async function start() {
  const port = await freePort()
  child = spawn(electron, ['tests/electron-test-main.cjs',
    `--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1', '--disable-gpu'], {
    cwd: root, stdio: 'ignore', windowsHide: true,
    env: { ...process.env, VITE_DEV_SERVER_URL: '', FORO_E2E_USER_DATA: profile },
  })
  let page
  for (let n = 0; n < 200; n++) {
    if (child.exitCode !== null) throw new Error('Electron exited before loading the window')
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`, {
        signal: AbortSignal.timeout(1000),
      })
      const pages = await res.json()
      page = pages.find(p => p.type === 'page' && p.url.startsWith('file:') && p.webSocketDebuggerUrl)
      if (page) break
    } catch { /* Endpoint not ready yet. */ }
    await pause(250)
  }
  if (!page) throw new Error('Electron did not create its production page')
  const socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CDP connection timeout')), 10000)
    socket.addEventListener('open', () => { clearTimeout(timer); resolve() }, { once: true })
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('CDP connection failed')) }, { once: true })
  })
  connection = new CDP(socket)
  await connection.command('Runtime.enable')
  let bridge
  for (let n = 0; n < 40; n++) {
    bridge = await connection.eval(`return {
      ready: !!window.foroAPI, noGet: !window.foroAPI?.get,
      noSet: !window.foroAPI?.set, noIpc: !window.ipcRenderer
    }`)
    if (bridge.ready) break
    await pause(250)
  }
  assert.deepEqual(bridge, { ready: true, noGet: true, noSet: true, noIpc: true },
    'production preload must expose only the restricted bridge')
  return connection
}
async function stop() {
  const current = child
  child = null
  connection?.close()
  connection = null
  if (!current) return
  if (current.exitCode === null) current.kill()
  await Promise.race([
    new Promise(resolve => current.once('exit', resolve)), pause(5000),
  ])
}
function findStore(directory) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, item.name)
    if (item.isFile() && item.name === 'foro-inversor.json') return filename
    if (item.isDirectory()) {
      const nested = findStore(filename)
      if (nested) return nested
    }
  }
  return null
}
try {
  let cdp = await start()
  const loggedOut = await cdp.eval(`let readBlocked = false, writeBlocked = false;
    try { await window.foroAPI.getAll() } catch { readBlocked = true }
    try { await window.foroAPI.setData('watchlist', []) } catch { writeBlocked = true }
    return { readBlocked, writeBlocked, version: await window.foroAPI.getVersion() }`)
  assert.equal(loggedOut.readBlocked, true)
  assert.equal(loggedOut.writeBlocked, true)
  assert.equal(typeof loggedOut.version, 'string')
  const register = await cdp.eval(`return await window.foroAPI.auth.register('ci-smoke-user', 'ci-smoke-password-123')`)
  assert.equal(register.ok, true, 'real Electron account registration')
  const data = await cdp.eval(`const api = window.foroAPI;
    await api.setData('watchlist', [{ ticker: 'TEST', name: 'CI smoke' }]);
    const state = await api.getAll();
    const blocked = [];
    for (const key of ['authUsers', 'authSession', 'llmApiCredential', 'llmLegacyApiKey', 'settings', '__proto__']) {
      try { await api.setData(key, []); blocked.push(false) } catch { blocked.push(true) }
    }
    let malformedBlocked = false;
    try { await api.setData('portfolio', [{ ticker: 'TEST', shares: -1 }]) }
    catch { malformedBlocked = true }
    const iframe = document.createElement('iframe'); iframe.src = 'about:blank';
    document.body.append(iframe); await new Promise(r => setTimeout(r, 100));
    let frameBlocked = !iframe.contentWindow.foroAPI;
    if (!frameBlocked) {
      try { await iframe.contentWindow.foroAPI.getAll() } catch { frameBlocked = true }
    }
    iframe.remove();
    return { saved: state.watchlist?.[0]?.ticker === 'TEST', secret: state.settings.apiKey,
      blocked, malformedBlocked, frameBlocked }`)
  assert.equal(data.saved, true)
  assert.equal(data.secret, '')
  assert.ok(data.blocked.every(Boolean), 'sensitive data keys must be rejected')
  assert.equal(data.malformedBlocked, true)
  assert.equal(data.frameBlocked, true)
  const credentials = await cdp.eval(`const api = window.foroAPI;
    const a = await api.updateSettings(${JSON.stringify(settings)}, 'ci-dummy-key-alpha');
    const view = await api.getAll();
    let rejected = false;
    try { await api.updateSettings({ ...${JSON.stringify(settings)}, apiKey: 'invalid' }) }
    catch { rejected = true }
    let offlineBlocked = false;
    try { await api.llmComplete('system', 'user') } catch { offlineBlocked = true }
    const rotated = await api.updateSettings(${JSON.stringify(settings)}, 'ci-dummy-key-beta');
    const cleared = await api.clearApiKey();
    const restored = await api.updateSettings(${JSON.stringify(settings)}, 'ci-dummy-key-gamma');
    await api.auth.logout();
    let afterLogoutBlocked = false;
    try { await api.getAll() } catch { afterLogoutBlocked = true }
    const login = await api.auth.login('ci-smoke-user', 'ci-smoke-password-123', true);
    return { secret: a.apiKey === '' && view.settings.apiKey === '',
      present: a.hasApiKey && view.settings.hasApiKey,
      rejected, offlineBlocked, rotated: rotated.hasApiKey, cleared: !cleared.hasApiKey,
      restored: restored.hasApiKey, afterLogoutBlocked, login: login.ok }`)
  assert.deepEqual(credentials, {
    secret: true, present: true, rejected: true, offlineBlocked: true,
    rotated: true, cleared: true, restored: true, afterLogoutBlocked: true, login: true,
  })
  await stop()
  const filename = findStore(profile)
  assert.ok(filename && filename.startsWith(profile + path.sep), 'store must use disposable userData')
  let state = JSON.parse(readFileSync(filename, 'utf8'))
  assert.equal(JSON.stringify(state).includes('ci-dummy-key-'), false, 'fresh key must not be plaintext')
  assert.equal(state.settings.apiKey, '')
  assert.ok(state.llmApiCredential && !state.llmLegacyApiKey, 'new key must be encrypted')
  cdp = await start()
  const reopened = await cdp.eval(`const api = window.foroAPI;
    const data = await api.getAll(); const session = await api.auth.getSession();
    return { username: session?.username, ticker: data.watchlist?.[0]?.ticker,
      secret: data.settings.apiKey, present: data.settings.hasApiKey }`)
  assert.deepEqual(reopened, { username: 'ci-smoke-user', ticker: 'TEST', secret: '', present: true })
  await stop()
  // Simulate a previous application's settings in a temporary profile, not a real user's data.
  state = JSON.parse(readFileSync(filename, 'utf8'))
  state.settings.apiKey = 'ci-legacy-key-fixture'
  state.llmApiCredential = ''
  state.llmLegacyApiKey = ''
  writeFileSync(filename, JSON.stringify(state), 'utf8')
  cdp = await start()
  const migrated = await cdp.eval(`const value = await window.foroAPI.getAll();
    return { secret: value.settings.apiKey, present: value.settings.hasApiKey,
      ticker: value.watchlist?.[0]?.ticker }`)
  assert.deepEqual(migrated, { secret: '', present: true, ticker: 'TEST' })
  await stop()
  const finalState = JSON.parse(readFileSync(filename, 'utf8'))
  assert.equal(JSON.stringify(finalState).includes('ci-legacy-key-fixture'), false)
  assert.ok(finalState.llmApiCredential && !finalState.llmLegacyApiKey)
  console.log('PASS: real Electron IPC, session, key redaction and rotation, persistence, encrypted legacy migration')
} finally {
  if (child?.exitCode === null) child.kill()
  rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 })
}
