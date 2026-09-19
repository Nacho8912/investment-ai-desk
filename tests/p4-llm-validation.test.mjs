import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { webcrypto } from 'node:crypto'

// Exercise the real validator implementation, not a mock or a restatement of its rules.
const source = readFileSync(new URL('../src/agents/llm/validate.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText
const module = { exports: {} }
vm.runInNewContext(compiled, { module, exports: module.exports, crypto: webcrypto })
const { validateResearchResponse: research, validateICResponse: ic,
  validateStrategyResponse: strategy, parseJsonResponse: parse } = module.exports
const dump = value => JSON.stringify(value)
const contribution = () => ({ agentId: 'macro', agentName: 'Macroeconomía', stage: 'analizar',
  summary: 'Sin datos actuales verificados', facts: [], judgments: ['Riesgo ilustrativo'], risks: [] })
const disagreement = () => ({ topic: 'Valoración', positions: [{ agent: 'Macro', view: 'Incierto' }, { agent: 'Riesgo', view: 'Incierto' }] })
const validResearch = () => ({ stages: ['recopilar'], contributions: [contribution()],
  synthesis: { title: 'Informe de estructura', bullCase: [], bearCase: [], risks: [],
    uncertainties: ['Sin acceso a datos actuales'], finalStance: 'insuficiente', executiveSummary: 'No verificable' },
  disagreements: [disagreement()] })
const validIC = () => ({ openingBrief: 'Tesis sin comprobar', rounds: [{ agentId: 'macro',
  agentName: 'Macro', view: 'No verificado', facts: [], judgments: [] }], challenges: [],
  votes: [{ agentId: 'macro', agentName: 'Macro', stance: 'insuficiente', conviction: 'baja', oneLiner: 'Faltan datos' }],
  recommendation: 'insuficiente', convictionAggregate: 'baja', actaMemo: 'Acta de simulación', dissentSummary: 'Sin disenso' })
const input = { monthlyContributionEur: 100, capitalEur: 1000, horizon: 'largo', risk: 'moderado',
  goal: 'crecimiento', constraints: { esg: false, noCrypto: true, spainRetail: true,
    preferAccumulating: true, maxSingleStockPct: 10 } }
const validStrategy = () => ({ title: 'Plan educativo', monthlyContributionEur: 100,
  nearTermView: 'Datos no verificados', longTermThesis: 'Ilustrativo',
  allocation: [{ key: 'global', label: 'Global', pct: 100, color: '#223344', rationale: 'Diversificar' }],
  products: [{ ticker: 'TEST', name: 'Producto simbólico', assetClass: 'ETF', suggestedPct: 100,
    pctOfContribution: 100, eurosThisMonth: 100, minCapitalHint: 'Verificar mínimo',
    why: 'Ejemplo estructural', liquidity: 'media', demoLabel: 'Verifique condiciones' }],
  monthlyBreakdown: [{ ticker: 'TEST', name: 'Producto simbólico', pct: 100,
    euros: 100, why: 'Ejemplo estructural' }],
  steps: [{ title: 'Verificar', detail: 'No comprar sin información' }],
  brokers: [{ id: 'test', name: 'Proveedor simbólico', fitScore: 50,
    bestFor: 'Sin comprobación', whyFits: 'Ejemplo', pros: [], cons: [],
    monthlyDcaFriendly: false, ucitsEtfs: false, spainRetailNotes: 'Comprobar',
    feeNotes: 'Tarifas no verificadas', demoLabel: 'Verifique condiciones' }],
  rebalancing: [], riskChecklist: [], agentNotes: [contribution()],
  disagreements: [disagreement()], executiveBrief: 'Plan simulado y no verificado' })
const disclaimer = 'Advertencia controlada exclusivamente por la aplicación'

test('validates every nested research field; stamps trustworthy metadata and preserves supplied ticker', () => {
  const report = research(dump(validResearch()), 'AAPL', 'Pregunta original', ['macro'], disclaimer)
  assert.equal(report.mode, 'live')
  assert.equal(report.ticker, 'AAPL')
  assert.equal(report.question, 'Pregunta original')
  assert.equal(report.disclaimer, disclaimer)
  assert.ok(report.id.startsWith('brief-live-'))
  assert.equal(report.synthesis.finalStance, 'insuficiente')
})

test('valid IC payload uses supplied thesis and never borrows mock votes', () => {
  const report = ic(dump(validIC()), 'AAPL', 'Tesis exacta', disclaimer)
  assert.equal(report.thesis, 'Tesis exacta')
  assert.equal(report.votes.length, 1)
  assert.equal(report.mode, 'live')
})

test('valid strategy checks full schema, trusted input, allocation and contribution totals', () => {
  const plan = strategy(dump(validStrategy()), input, disclaimer)
  assert.equal(plan.monthlyContributionEur, 100)
  assert.equal(plan.input, input)
  assert.equal(plan.mode, 'live')
})

test('rejects empty/malformed JSON and refuses incomplete data instead of silently using mock defaults', () => {
  for (const raw of ['{}', 'null', '[]', '```json\n{}\n```', '{invalid']) {
    assert.throws(() => research(raw, 'AAPL', 'Pregunta', ['macro'], disclaimer))
  }
  assert.throws(() => ic('{}', 'AAPL', 'Tesis', disclaimer))
  assert.throws(() => strategy('{}', input, disclaimer))
  assert.equal(typeof parse('```json\n{"ok":true}\n```'), 'object')
})

test('rejects model-supplied provenance, disallowed agents and forged ticker', () => {
  const forged = validResearch()
  forged.mode = 'live'
  assert.throws(() => research(dump(forged), 'AAPL', 'Pregunta', ['macro'], disclaimer))
  const unauthorized = validResearch()
  unauthorized.contributions[0].agentId = 'unselected'
  assert.throws(() => research(dump(unauthorized), 'AAPL', 'Pregunta', ['macro'], disclaimer))
  const ticker = validResearch()
  ticker.ticker = 'MSFT'
  assert.throws(() => research(dump(ticker), 'AAPL', 'Pregunta', ['macro'], disclaimer))
})

test('rejects invalid nested enums and missing fields, excessive content and injected object keys', () => {
  const bad = validResearch()
  bad.synthesis.finalStance = 'supercomprar'
  assert.throws(() => research(dump(bad), 'AAPL', 'Pregunta', ['macro'], disclaimer))
  const missing = validResearch()
  delete missing.contributions[0].facts
  assert.throws(() => research(dump(missing), 'AAPL', 'Pregunta', ['macro'], disclaimer))
  assert.throws(() => research('x'.repeat(1_000_001), 'AAPL', 'Pregunta', ['macro'], disclaimer))
  assert.throws(() => research(dump({ ...validResearch(), __proto__: undefined, unexpected: true }), 'AAPL', 'Pregunta', ['macro'], disclaimer))
  assert.throws(() => research('{"__proto__":{"polluted":true}}', 'AAPL', 'Pregunta', ['macro'], disclaimer))
})

test('rejects percentage overflows, mismatched euro totals, missing/duplicate product rows and incorrect input amount', () => {
  const invalid = [
    plan => { plan.allocation[0].pct = 99 },
    plan => { plan.monthlyBreakdown[0].euros = 90 },
    plan => { plan.products[0].pctOfContribution = 101 },
    plan => { plan.products[0].ticker = 'DIFFERENT' },
    plan => { plan.products.push({ ...plan.products[0] }) },
    plan => { plan.monthlyContributionEur = 90 },
    plan => { plan.brokers[0].fitScore = 200 },
    plan => { plan.products[0].eurosThisMonth = -1 },
  ]
  for (const mutate of invalid) {
    const plan = validStrategy()
    mutate(plan)
    assert.throws(() => strategy(dump(plan), input, disclaimer))
  }
})
