import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const binary = require('electron')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const scratch = mkdtempSync(path.join(os.tmpdir(), 'foro-diagnostic-'))
const appData = path.join(scratch, 'roaming')
mkdirSync(appData, { recursive: true })
const server = createServer()
const port = await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => {
    const p = server.address().port
    server.close(() => resolve(p))
  })
})
let stderr = ''
const child = spawn(binary, ['.', `--remote-debugging-port=${port}`, '--disable-gpu'], {
  cwd: root,
  env: { ...process.env, APPDATA: appData, LOCALAPPDATA: path.join(scratch, 'local'), VITE_DEV_SERVER_URL: '' },
  stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true,
})
child.stderr.on('data', chunk => { stderr += String(chunk).slice(0, 3000); stderr = stderr.slice(-6000) })
try {
  let target
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`Electron exited early: ${child.exitCode}`)
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1000) })
      const pages = await response.json()
      target = pages.find(t => t.type === 'page' && t.url.startsWith('file:'))
      if (target) break
    } catch {}
    await new Promise(r => setTimeout(r, 200))
  }
  if (!target) throw new Error('No file:// page was found')
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })
  let count = 0
  async function probe() {
    const id = ++count
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: {
      expression: "({ready:document.readyState, bridge:!!window.foroAPI, title:document.title, href:location.href.slice(0,80), body:document.body?.innerText.slice(0,90)})", returnByValue: true,
    } }))
    return new Promise(resolve => {
      const listener = event => {
        const packet = JSON.parse(event.data)
        if (packet.id !== id) return
        ws.removeEventListener('message', listener)
        resolve(packet.result?.result?.value ?? { evaluation: 'failed' })
      }
      ws.addEventListener('message', listener)
    })
  }
  let result
  for (let i = 0; i < 40; i++) {
    result = await probe()
    if (result.bridge) break
    await new Promise(r => setTimeout(r, 250))
  }
  console.log('Sanitized Electron preload diagnostic:', result)
  if (!result.bridge) {
    console.log('Sanitized Electron startup errors:', stderr.split('\n').filter(x => /preload|error|failed|module/i.test(x)).map(x => x.slice(0,180)).slice(0,10))
    throw new Error('Renderer bridge never became available')
  }
  ws.close()
} finally {
  child.kill()
  rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 400 })
}
