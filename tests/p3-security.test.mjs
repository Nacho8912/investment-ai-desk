import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

test('P3: sandbox and context isolation are enabled; no renderer Node integration', () => {
  const main = source('electron/main.ts')
  assert.match(main, /sandbox:\s*true/)
  assert.match(main, /contextIsolation:\s*true/)
  assert.match(main, /nodeIntegration:\s*false/)
  assert.match(main, /webviewTag:\s*false/)
  assert.match(main, /hardenWindow\(mainWindow\)/)
  assert.doesNotMatch(main, /sandbox:\s*false/)
  assert.match(main, /preload\.cjs/)
})

test('P3: window navigation, redirects, webviews, popups and permissions are denied', () => {
  const policy = source('electron/window-security.ts')
  for (const event of ['will-navigate', 'will-frame-navigate', 'will-redirect', 'will-attach-webview']) {
    assert.match(policy, new RegExp(`on\\('${event}'`))
  }
  assert.match(policy, /setWindowOpenHandler/)
  assert.match(policy, /return \{ action: 'deny' \}/)
  assert.match(policy, /url === 'https:\/\/openrouter\.ai\/docs'/)
  assert.doesNotMatch(policy, /startsWith\(['"]https:\/\//)
  assert.match(policy, /setPermissionRequestHandler/)
  assert.match(policy, /setPermissionCheckHandler\(\(\) => false\)/)
})

test('P3: packaged CSP has no arbitrary remote connections, scripts or objects', () => {
  const html = source('index.html')
  const meta = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)
  assert.ok(meta, 'CSP meta tag must exist in packaged HTML')
  const policy = meta[1]
  assert.match(policy, /script-src 'self'/)
  assert.match(policy, /connect-src 'none'/)
  assert.match(policy, /object-src 'none'/)
  assert.match(policy, /base-uri 'none'/)
  assert.match(policy, /form-action 'none'/)
  assert.doesNotMatch(policy, /unsafe-eval|https:\/\/\*|http:\/\/localhost|unsafe-inline.*script-src/)
  assert.match(source('vite.config.ts'), /apply: 'serve'/)
})
