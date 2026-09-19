import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

// Static source invariants: these do not replace Electron IPC integration or penetration tests.
test('P1: renderer bridge does not expose arbitrary get/set or ipcRenderer', () => {
  const preload = read('electron/preload.ts')
  assert.doesNotMatch(preload, /\bget:\s*\(key:/)
  assert.doesNotMatch(preload, /\bset:\s*\(key:/)
  assert.doesNotMatch(preload, /exposeInMainWorld\(\s*['"]ipcRenderer['"]|\bipcRenderer:\s*ipcRenderer/)
  assert.match(preload, /llmComplete:/)
  assert.match(preload, /updateSettings:/)
})

test('P1: LLM request is sent from Electron main, never from client.ts', () => {
  const main = read('electron/main.ts')
  const client = read('src/agents/llm/client.ts')
  assert.match(main, /ipcMain\.handle\('llm:complete'/)
  assert.match(main, /Authorization: `Bearer \$\{apiKey\}`/)
  assert.match(client, /window\.foroAPI\.llmComplete\(/)
  assert.doesNotMatch(client, /Authorization:|fetch\(/)
})

test('P1: settings are redacted on the main process boundary', () => {
  const main = read('electron/main.ts')
  const storage = read('src/lib/storage.ts')
  assert.match(main, /function publicSettings\(\)/)
  assert.match(main, /apiKey: ''/)
  assert.match(main, /settings: publicSettings\(\)/)
  assert.match(storage, /apiKey: ''/)
  assert.match(storage, /updateSettings\(/)
})

test('P2: generic storage handlers are gone and specific methods are guarded', () => {
  const main = read('electron/main.ts')
  assert.doesNotMatch(main, /ipcMain\.handle\('store:(get|set|getAll)'/)
  assert.match(main, /ipcMain\.handle\('data:set'/)
  assert.match(main, /if \(!validData\(key, value\)\)/)
  assert.match(main, /function assertSession\(/)
  assert.match(main, /event\.senderFrame !== event\.sender\.mainFrame/)
})

test('P2: data key allowlist excludes authentication and credentials', () => {
  const main = read('electron/main.ts')
  const declaration = main.match(/const DATA_KEYS = \[([^\]]+)\] as const/)
  assert.ok(declaration, 'data key allowlist should exist')
  assert.doesNotMatch(declaration[1], /authUsers|authSession|apiKey|llmApiCredential|settings/)
  assert.match(main, /assertData\(value, 2_000_000\)/)
})

test('P1/P5: app selects live mode using credential presence flag, not the key', () => {
  for (const file of ['src/agents/orchestrator.ts', 'src/pages/HomePage.tsx']) {
    const source = read(file)
    assert.match(source, /settings\.hasApiKey/)
    assert.doesNotMatch(source, /settings\.apiKey/)
  }
})
