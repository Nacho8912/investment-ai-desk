import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { createRequire } from 'node:module'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

if (process.platform !== 'win32' || process.env.CI !== 'true') {
  throw new Error('P3 hostile Electron integration requires isolated Windows CI')
}
const require = createRequire(import.meta.url)
const binary = require('electron')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const scratch = mkdtempSync(path.join(os.tmpdir(), 'foro-p3-security-'))
const roaming = path.join(scratch, 'roaming')
const local = path.join(scratch, 'local')
mkdirSync(roaming, { recursive: true })
mkdirSync(local, { recursive: true })

async function freePort() {
  const server = createServer()
  return await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() => resolve(address.port))
    })
  })
}
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))
let child, socket
try {
  const port = await freePort()
  child = spawn(binary, ['.', `--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1', '--disable-gpu'], {
    cwd: root,
    env: { ...process.env, APPDATA: roaming, LOCALAPPDATA: local, VITE_DEV_SERVER_URL: '' },
    stdio: 'ignore', windowsHide: true,
  })
  let target
  for (let attempt = 0; attempt < 200; attempt++) {
    if (child.exitCode !== null) throw new Error('Electron exited before P3 tests')
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1000) })
      const targets = await response.json()
      target = targets.find(t => t.type === 'page' && t.url.startsWith('file:') && t.webSocketDebuggerUrl)
      if (target) break
    } catch { /* Electron CDP starts asynchronously. */ }
    await sleep(250)
  }
  assert.ok(target, 'the packaged renderer must load')
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CDP connection timed out')), 10000)
    socket.addEventListener('open', () => { clearTimeout(timer); resolve() }, { once: true })
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('CDP connection failed')) }, { once: true })
  })
  let sequence = 0
  const pending = new Map()
  socket.addEventListener('message', event => {
    let reply
    try { reply = JSON.parse(event.data) } catch { return }
    const entry = pending.get(reply.id)
    if (!entry) return
    pending.delete(reply.id)
    clearTimeout(entry.timer)
    if (reply.error) entry.reject(new Error('CDP command failed'))
    else entry.resolve(reply.result)
  })
  function send(method, params = {}) {
    const id = ++sequence
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`CDP ${method} timed out`))
      }, 15000)
      pending.set(id, { resolve, reject, timer })
      socket.send(JSON.stringify({ id, method, params }))
    })
  }
  async function evaluate(script) {
    const answer = await send('Runtime.evaluate', {
      expression: `(async () => { ${script} })()`, awaitPromise: true, returnByValue: true,
    })
    if (answer.exceptionDetails || answer.result?.subtype === 'error') {
      throw new Error('Renderer probe threw unexpectedly')
    }
    return answer.result?.value
  }
  await send('Runtime.enable')
  const ready = await evaluate(`return { bridge: !!window.foroAPI, url: location.href.split('#')[0],
    isolatedNode: typeof window.require === 'undefined' && typeof window.process === 'undefined' }`)
  assert.equal(ready.bridge, true, 'sandbox must retain narrowly exposed preload bridge')
  assert.equal(ready.isolatedNode, true, 'renderer must not expose Node globals')
  assert.match(ready.url, /^file:\/\//)

  const constraints = await evaluate(`const expected = location.href.split('#')[0];
    let remoteFetchBlocked = false, inlineScriptBlocked = false, popupBlocked = false;
    try { await fetch('https://example.com/p3-csp-probe') } catch { remoteFetchBlocked = true }
    window.__p3_inline_executed = false;
    const injected = document.createElement('script');
    injected.textContent = 'window.__p3_inline_executed = true';
    document.head.append(injected);
    await new Promise(resolve => setTimeout(resolve, 200));
    inlineScriptBlocked = window.__p3_inline_executed === false;
    let popup = null;
    try { popup = window.open('https://example.com/p3-popup', '_blank') } catch { popupBlocked = true }
    popupBlocked ||= popup === null;
    let permissionDenied = false;
    try { permissionDenied = (await navigator.permissions.query({ name: 'geolocation' })).state === 'denied' }
    catch { permissionDenied = true }
    const iframe = document.createElement('iframe'); iframe.srcdoc = '<p>isolated</p>';
    document.body.append(iframe); await new Promise(resolve => setTimeout(resolve, 200));
    const frameBridgeAbsent = !iframe.contentWindow?.foroAPI;
    iframe.remove();
    return { expected, remoteFetchBlocked, inlineScriptBlocked, popupBlocked, permissionDenied, frameBridgeAbsent }`)
  assert.equal(constraints.remoteFetchBlocked, true, 'production CSP blocks remote renderer fetch')
  assert.equal(constraints.inlineScriptBlocked, true, 'production CSP blocks injected inline scripts')
  assert.equal(constraints.popupBlocked, true, 'arbitrary popups are denied')
  assert.equal(constraints.permissionDenied, true, 'geolocation permission is denied')
  assert.equal(constraints.frameBridgeAbsent, true, 'subframes do not inherit the main-frame bridge')

  const navigation = await evaluate(`const before = location.href.split('#')[0];
    const anchor = document.createElement('a'); anchor.href = 'https://example.com/p3-navigation';
    document.body.append(anchor); anchor.click(); anchor.remove();
    await new Promise(resolve => setTimeout(resolve, 400));
    const stillLocal = location.href.split('#')[0] === before;
    location.hash = '#/metodologia';
    const hashRouterWorks = location.hash === '#/metodologia';
    return { stillLocal, hashRouterWorks }`)
  assert.equal(navigation.stillLocal, true, 'renderer-initiated document navigation is denied')
  assert.equal(navigation.hashRouterWorks, true, 'HashRouter navigation remains available')
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  assert.equal(targets.filter(t => t.type === 'page').length, 1, 'arbitrary popup cannot create a second window')
  console.log('PASS P3 Electron runtime: sandboxed bridge, CSP fetch/script, popup, permissions, subframe, navigation and HashRouter')
} finally {
  try { socket?.close() } catch { /* already closed */ }
  if (child?.exitCode === null) child.kill()
  rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 })
}
