import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// Transitional unit harness: extract the real pure validator from main.ts and transpile it.
// This exercises real validation logic, but DOES NOT replace Electron IPC integration tests.
const source = readFileSync(new URL('../electron/main.ts', import.meta.url), 'utf8')
const start = source.indexOf('function isRecord(')
const end = source.indexOf('function validatedBaseUrl(', start)
assert.ok(start >= 0 && end > start, 'Security validation section must exist in main.ts')
const snippet = `${source.slice(start, end)}\nglobalThis.__validateData = validData;`
const code = ts.transpileModule(snippet, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText
const context = vm.createContext({ Buffer })
vm.runInContext(code, context)
const validate = context.__validateData
assert.equal(typeof validate, 'function')

test('allows valid existing watchlist, portfolio and saved reports', () => {
  assert.equal(validate('watchlist', [{ ticker: 'AAPL', name: 'Apple Inc.' }]), true)
  assert.equal(validate('portfolio', [{ ticker: 'AAPL', name: 'Apple', shares: 1.5, avgCost: 100, currency: 'USD' }]), true)
  assert.equal(validate('briefs', [{ id: 'brief-1', createdAt: '2026-09-19T08:00:00Z', mode: 'mock' }]), true)
})

test('forbids protected store keys', () => {
  for (const key of ['settings', 'authUsers', 'authSession', 'llmApiCredential', 'llmLegacyApiKey', '__proto__']) {
    assert.equal(validate(key, []), false, `${key} must not be writable`)
  }
})

test('rejects non-array payloads and malformed watchlist and portfolio records', () => {
  assert.throws(() => validate('watchlist', {}), /Colección inválida/)
  assert.throws(() => validate('watchlist', [{ ticker: 'AAPL' }]), /watchlist inválido/)
  assert.throws(() => validate('portfolio', [{ ticker: 'AAPL', name: 'Apple', shares: -1, avgCost: 10, currency: 'USD' }]), /cartera inválida/)
  assert.throws(() => validate('portfolio', [{ ticker: 'AAPL', name: 'Apple', shares: Number.POSITIVE_INFINITY, avgCost: 10, currency: 'USD' }]), /Número no finito/)
  assert.throws(() => validate('briefs', [{ id: 'x' }]), /Informe inválido/)
})

test('rejects prototype pollution, oversized and excessively nested inputs', () => {
  const polluted = JSON.parse('{"ticker":"AAPL","name":"Apple","__proto__":{"admin":true}}')
  assert.throws(() => validate('watchlist', [polluted]), /Clave no permitida/)
  assert.throws(() => validate('watchlist', [{ ticker: 'AAPL', name: 'A', note: 'x'.repeat(2_000_100) }]), /fuera de límites/)
  let nested = { ticker: 'AAPL', name: 'Apple' }
  for (let n = 0; n < 30; n++) nested = { ticker: 'AAPL', name: 'Apple', next: nested }
  assert.throws(() => validate('watchlist', [nested]), /demasiado anidados/)
})
