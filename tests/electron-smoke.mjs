import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

/** Real Electron smoke test through Chrome DevTools Protocol on an isolated CI profile.
 * No production test bypass, network credentials or live LLM calls are used.
 * Never print stored credentials, CDP payloads or the contents of the profile.
 */
if (process.platform !== 'win32' || process.env.CI !== 'true') {
  throw new Error('Electron smoke requires an ephemeral Windows GitHub Actions runner (CI=true)')
}
const require = createRequire(import.meta.url)
const binary = require('electron')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const scratch = mkdtempSync(path.join(os.tmpdir(), 'foro-electron-smoke-'))
const appData = path.join(scratch, 'roaming')
const localData = path.join(scratch, 'local')
mkdirSync(appData, { recursive: true })
mkdirSync(localData, { recursive: true })
const settings = {
  mockMode: true, apiKey: '', hasApiKey: false,
  apiBaseUrl: 'https://openrouter.ai/api/v1',
  model: 'openai/gpt-4o-mini', disclaimerAccepted: true,
}
let running = null

async function freePort() {
  const server = createServer()
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() => resolve(address.port))
    })
  })
}

class CDP {
  constructor(socket) {
    this.socket = socket
    this.id = 0
    this.pending = new Map()
    socket.addEventListener('message', (event) => {
      let message
      try { message = JSON.parse(event.data) } catch { return }
      const request = this.pending.get(message.id)
      if (!request) return
      this.pending.delete(message.id)
      clearTimeout(request.timer)
      if (message.error) request.reject(new Error('CDP method rejected'))
      else request.resolve(message.result)
    })
    socket.addEventListener('close', () => {
      for (const request of this.pending.values()) {
        clearTimeout(request.timer)
        request.reject(new Error('CDP socket closed'))
      }
      this.pending.clear()
    })
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`CDP ${method} timeout`))
      }, 20000)
      this.pending.set(id, { resolve, reject, timer })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }
  async evaluate(script) {
    const output = await this.send('Runtime.evaluate', {
      expression: `(async () => { ${script} })()`,
      awaitPromise: true, returnByValue: true,
    })
    if (output.exceptionDetails || output.result?.subtype === 'error') {
      throw new Error('Electron renderer assertion raised an exception')
    }
    return output.result?.value
  }
  close() { this.socket.close() }
}

async function start() {
  const port = await freePort()
  const child = spawn(binary, ['.', `--remote-debugging-port=${port}`,
    '--remote-debugging-address=127.0.0.1', '--disable-gpu'], {
    cwd: root,
    env: { ...process.env, APPDATA: appData, LOCALAPPDATA: localData, VITE_DEV_SERVER_URL: '' },
    stdio: 'ignore', windowsHide: true,
  })
  running = child
  const until = Date.now() + 60000
  let target = null
  while (Date.now() < until) {
    if (child.exitCode !== null) throw new Error('Electron exited before its page became available')
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1500) })
      if (response.ok) {
        const targets = await response.json()
        target = targets.find(t => t.type === 'page' && t.url.startsWith('file:') && t.webSocketDebuggerUrl)
        if (target) break
      }
    } catch { /* DevTools endpoint starts asynchronously. */ }
    await new Promise(resolve => setTimeout(resolve, 300))
  }
  if (!target) throw new Error('Electron application window did not load in time')
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CDP socket connection timeout')), 10000)
    socket.addEventListener('open', () => { clearTimeout(timer); resolve() }, { once: true })
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('CDP websocket connection failed')) }, { once: true })
  })
  const cdp = new CDP(socket)
  await cdp.send('Runtime.enable')
  const ready = await cdp.evaluate(`return { bridge: !!window.foroAPI, noRead: !window.foroAPI?.get,
    noWrite: !window.foroAPI?.set, noRawIpc: !window.ipcRenderer }`)
  assert.deepEqual(ready, { bridge: true, noRead: true, noWrite: true, noRawIpc: true })
  return cdp
}

async function stop(cdp) {
  try { cdp?.close() } catch { /* Electron may already have exited. */ }
  if (!running) return
  const child = running
  running = null
  if (child.exitCode === null) child.kill()
  await new Promise(resolve => {
    if (child.exitCode !== null) return resolve()
    child.once('exit', resolve)
    setTimeout(resolve, 5000)
  })
}

function locateStore(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const name = path.join(dir, item.name)
    if (item.isFile() && item.name === 'foro-inversor.json') return name
    if (item.isDirectory()) {
      const found = locateStore(name)
      if (found) return found
    }
  }
  return null
}

try {
  let cdp = await start()
  const before = await cdp.evaluate(`let noSession = false, noWrite = false;
    try { await window.foroAPI.getAll() } catch { noSession = true }
    try { await window.foroAPI.setData('watchlist', []) } catch { noWrite = true }
    return { noSession, noWrite, version: await window.foroAPI.getVersion() }`)
  assert.equal(before.noSession, true, 'reading data requires login')
  assert.equal(before.noWrite, true, 'writing data requires login')
  assert.equal(typeof before.version, 'string')

  const register = await cdp.evaluate(`return window.foroAPI.auth.register('ci-smoke-user', 'ci-smoke-password-123')`)
  assert.equal(register.ok, true, 'registration through real Electron IPC')
  const actual = await cdp.evaluate(`const api = window.foroAPI;
    await api.setData('watchlist', [{ ticker: 'TEST', name: 'CI smoke' }]);
    const data = await api.getAll();
    const rejected = [];
    for (const key of ['authUsers', 'authSession', 'llmApiCredential', 'llmLegacyApiKey', 'settings', '__proto__']) {
      try { await api.setData(key, []); rejected.push(false) } catch { rejected.push(true) }
    }
    let malformedRejected = false;
    try { await api.setData('portfolio', [{ ticker: 'TEST', shares: -1 }]) }
    catch { malformedRejected = true }
    const frame = document.createElement('iframe');
    frame.src = 'about:blank'; document.body.append(frame);
    await new Promise(r => setTimeout(r, 200));
    let subframeRestricted = true;
    if (frame.contentWindow.foroAPI) {
      try { await frame.contentWindow.foroAPI.getAll(); subframeRestricted = false }
      catch { subframeRestricted = true }
    }
    frame.remove();
    return { saved: data.watchlist?.[0]?.ticker === 'TEST', secret: data.settings.apiKey,
      hasKey: data.settings.hasApiKey, rejected, malformedRejected, subframeRestricted }`)
  assert.equal(actual.saved, true, 'valid watchlist persists')
  assert.equal(actual.secret, '', 'getAll redacts API key')
  assert.equal(actual.hasKey, false)
  assert.ok(actual.rejected.every(Boolean), 'protected keys cannot be overwritten')
  assert.equal(actual.malformedRejected, true)
  assert.equal(actual.subframeRestricted, true, 'subframe cannot read protected data')

  const configured = await cdp.evaluate(`const api = window.foroAPI;
    const first = await api.updateSettings(${JSON.stringify(settings)}, 'ci-dummy-key-alpha');
    const visible = await api.getAll();
    let forbiddenSettings = false;
    try { await api.updateSettings({ ...${JSON.stringify(settings)}, apiKey: 'forbidden' }) }
    catch { forbiddenSettings = true }
    let offlineDenied = false;
    try { await api.llmComplete('system', 'prompt') } catch { offlineDenied = true }
    return { keyRedacted: first.apiKey === '' && visible.settings.apiKey === '',
      presence: first.hasApiKey && visible.settings.hasApiKey, forbiddenSettings, offlineDenied }`)
  assert.deepEqual(configured, {
    keyRedacted: true, presence: true, forbiddenSettings: true, offlineDenied: true,
  }, 'credential write is encrypted, not readable through renderer, and offline mode blocks LLM')

  const rotated = await cdp.evaluate(`const api = window.foroAPI;
    const changed = await api.updateSettings(${JSON.stringify(settings)}, 'ci-dummy-key-beta');
    const removed = await api.clearApiKey();
    const restored = await api.updateSettings(${JSON.stringify(settings)}, 'ci-dummy-key-gamma');
    await api.auth.logout();
    let blocked = false;
    try { await api.getAll() } catch { blocked = true }
    const loggedIn = await api.auth.login('ci-smoke-user', 'ci-smoke-password-123', true);
    return { changed: changed.hasApiKey, removed: !removed.hasApiKey,
      restored: restored.hasApiKey, blocked, login: loggedIn.ok }`)
  assert.deepEqual(rotated, { changed: true, removed: true, restored: true, blocked: true, login: true })
  await stop(cdp)
  cdp = null

  const file = locateStore(appData)
  assert.ok(file && file.startsWith(appData + path.sep), 'test profile store must reside in scratch APPDATA')
  let stored = JSON.parse(readFileSync(file, 'utf8'))
  const diskText = JSON.stringify(stored)
  assert.equal(diskText.includes('ci-dummy-key-'), false, 'fresh credentials must not appear as plaintext')
  assert.equal(stored.settings.apiKey, '', 'settings should not contain a persisted plaintext key')
  assert.ok(stored.llmApiCredential && !stored.llmLegacyApiKey, 'new key should be stored encrypted')

  cdp = await start()
  const restarted = await cdp.evaluate(`const api = window.foroAPI;
    const state = await api.getAll();
    const session = await api.auth.getSession();
    return { user: session?.username, ticker: state.watchlist?.[0]?.ticker,
      secret: state.settings.apiKey, present: state.settings.hasApiKey }`)
  assert.deepEqual(restarted, { user: 'ci-smoke-user', ticker: 'TEST', secret: '', present: true },
    'saved session and collections survive relaunch without leaking key')
  await stop(cdp)
  cdp = null

  // Reproduce a prior-version plaintext fixture in the temporary profile, never on user's PC.
  stored = JSON.parse(readFileSync(file, 'utf8'))
  stored.settings.apiKey = 'ci-legacy-key-fixture'
  stored.llmApiCredential = ''
  stored.llmLegacyApiKey = ''
  writeFileSync(file, JSON.stringify(stored), 'utf8')
  cdp = await start()
  const migrated = await cdp.evaluate(`const api = window.foroAPI;
    const state = await api.getAll();
    return { secret: state.settings.apiKey, present: state.settings.hasApiKey,
      ticker: state.watchlist?.[0]?.ticker }`)
  assert.deepEqual(migrated, { secret: '', present: true, ticker: 'TEST' },
    'legacy migration redacts the key and conserves existing collections')
  await stop(cdp)
  cdp = null
  const after = JSON.parse(readFileSync(file, 'utf8'))
  assert.equal(JSON.stringify(after).includes('ci-legacy-key-fixture'), false,
    'Windows migration must eliminate legacy plaintext in the current JSON file')
  assert.ok(after.llmApiCredential && !after.llmLegacyApiKey)
  console.log('PASS: Electron Windows startup, session, IPC allowlist, subframe, redaction, key rotation, restart, encrypted migration')
} finally {
  if (running?.exitCode === null) running.kill()
  rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 })
}
