import type { ResearchBrief, ICSession, StrategyPlan, StrategyInput } from '../../types'

/** Trust boundary: no model output is a typed report until every required nested field passes.
 * No mock report is used as a template and no model-supplied metadata is trusted.
 * These structural checks cannot establish truth, recency, citations or suitability.
 */
type Spec = 'text' | 'boolean' | 'stance' | 'conviction' | 'liquidity' | 'color' |
  { kind: 'number'; min: number; max: number } |
  { kind: 'array'; item: Spec; min: number; max: number } |
  { kind: 'object'; fields: Record<string, Spec>; optional: string[] }
const text: Spec = 'text'
const bool: Spec = 'boolean'
const percent: Spec = { kind: 'number', min: 0, max: 100 }
const amount: Spec = { kind: 'number', min: 0, max: 1_000_000_000 }
const score: Spec = percent
const list = (item: Spec, min = 0, max = 80): Spec => ({ kind: 'array', item, min, max })
const obj = (fields: Record<string, Spec>, optional: string[] = []): Spec => ({ kind: 'object', fields, optional })
const strings = list(text, 0, 80)
const stance: Spec = 'stance'
const conviction: Spec = 'conviction'

function fail(): never { throw new Error('Respuesta LLM incompleta, inválida o inconsistente; se utilizará simulación') }
function check(value: unknown, spec: Spec, depth = 0): unknown {
  if (depth > 20) return fail()
  if (typeof spec === 'string') {
    if (spec === 'boolean') { if (typeof value !== 'boolean') fail(); return value }
    if (typeof value !== 'string' || value.length > 10_000 || value.trim().length === 0) fail()
    if (spec === 'text') return value
    if (spec === 'stance' && !['comprar', 'mantener', 'evitar', 'insuficiente'].includes(value)) fail()
    if (spec === 'conviction' && !['alta', 'media', 'baja'].includes(value)) fail()
    if (spec === 'liquidity' && !['alta', 'media', 'baja'].includes(value)) fail()
    if (spec === 'color' && !/^#[a-f0-9]{3}(?:[a-f0-9]{3})?$/i.test(value)) fail()
    return value
  }
  if (spec.kind === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < spec.min || value > spec.max) fail()
    return value
  }
  if (spec.kind === 'array') {
    if (!Array.isArray(value) || value.length < spec.min || value.length > spec.max) fail()
    value.forEach(entry => check(entry, spec.item, depth + 1))
    return value
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail()
  const record = value as Record<string, unknown>
  for (const key of Object.keys(record)) {
    if (!Object.prototype.hasOwnProperty.call(spec.fields, key)) fail()
  }
  for (const [key, nested] of Object.entries(spec.fields)) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) {
      if (!spec.optional.includes(key)) fail()
      continue
    }
    check(record[key], nested, depth + 1)
  }
  return value
}

export function parseJsonResponse(raw: string): unknown {
  if (typeof raw !== 'string' || raw.length > 1_000_000) fail()
  const input = raw.trim()
  const json = input.startsWith('```')
    ? input.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i)?.[1] : input
  if (!json) fail()
  try { return JSON.parse(json) as unknown } catch { return fail() }
}

const contribution = obj({
  agentId: text, agentName: text, stage: text, summary: text,
  facts: strings, judgments: strings, risks: strings,
  stance, conviction, dissentNote: text,
}, ['stance', 'conviction', 'dissentNote'])
const disagreement = obj({ topic: text, positions: list(obj({ agent: text, view: text }), 2, 40) })
const synthesis = obj({
  title: text, bullCase: strings, bearCase: strings, risks: strings,
  uncertainties: strings, finalStance: stance, executiveSummary: text,
})
const briefSpec = obj({
  ticker: text, question: text, stages: list(text, 1, 20),
  contributions: list(contribution, 1, 80), synthesis,
  disagreements: list(disagreement),
}, ['ticker', 'question'])
const icSpec = obj({
  ticker: text, thesis: text, openingBrief: text,
  rounds: list(obj({ agentId: text, agentName: text, view: text, facts: strings, judgments: strings }), 1),
  challenges: list(obj({ from: text, to: text, challenge: text, reply: text }, ['reply'])),
  votes: list(obj({ agentId: text, agentName: text, stance, conviction, oneLiner: text }), 1),
  recommendation: stance, convictionAggregate: conviction, actaMemo: text, dissentSummary: text,
}, ['ticker', 'thesis'])
const product = obj({
  ticker: text, name: text, assetClass: text, suggestedPct: percent,
  pctOfContribution: percent, eurosThisMonth: amount, minCapitalHint: text,
  why: text, liquidity: 'liquidity', demoLabel: text,
})
const broker = obj({
  id: text, name: text, fitScore: score, bestFor: text, whyFits: text,
  pros: strings, cons: strings, monthlyDcaFriendly: bool, ucitsEtfs: bool,
  spainRetailNotes: text, feeNotes: text, demoLabel: text,
})
const strategySpec = obj({
  title: text, monthlyContributionEur: amount, nearTermView: text, longTermThesis: text,
  allocation: list(obj({ key: text, label: text, pct: percent, color: 'color', rationale: text }), 1),
  products: list(product, 1),
  monthlyBreakdown: list(obj({ ticker: text, name: text, pct: percent, euros: amount, why: text }), 1),
  steps: list(obj({ title: text, detail: text }), 1), brokers: list(broker, 1),
  rebalancing: strings, riskChecklist: strings, agentNotes: list(contribution, 1),
  disagreements: list(disagreement), executiveBrief: text,
})
function roundedSum(values: number[]): number { return values.reduce((sum, n) => sum + n, 0) }
function around(actual: number, expected: number, tolerance: number) {
  if (Math.abs(actual - expected) > tolerance) fail()
}
function metadata(prefix: string) {
  return { id: `${prefix}-${crypto.randomUUID()}`, createdAt: new Date().toISOString(), mode: 'live' as const }
}

export function validateResearchResponse(raw: string, ticker: string, question: string, selectedAgents: string[], disclaimer: string): ResearchBrief {
  const payload = check(parseJsonResponse(raw), briefSpec) as Record<string, unknown>
  if (payload.ticker !== undefined && payload.ticker !== ticker) fail()
  if (payload.question !== undefined && payload.question !== question) fail()
  const contributions = payload.contributions as Array<{ agentId: string }>
  const selected = new Set([...selectedAgents, 'cumplimiento'])
  if (contributions.some(entry => !selected.has(entry.agentId))) fail()
  return { ...payload, ticker, question, ...metadata('brief-live'), disclaimer } as unknown as ResearchBrief
}

export function validateICResponse(raw: string, ticker: string, thesis: string, disclaimer: string): ICSession {
  const payload = check(parseJsonResponse(raw), icSpec) as Record<string, unknown>
  if (payload.ticker !== undefined && payload.ticker !== ticker) fail()
  if (payload.thesis !== undefined && payload.thesis !== thesis) fail()
  return { ...payload, ticker, thesis, ...metadata('ic-live'), disclaimer } as unknown as ICSession
}

export function validateStrategyResponse(raw: string, input: StrategyInput, disclaimer: string): StrategyPlan {
  const payload = check(parseJsonResponse(raw), strategySpec) as Record<string, unknown>
  const contribution = payload.monthlyContributionEur as number
  around(contribution, input.monthlyContributionEur, 0.001)
  const allocation = payload.allocation as Array<{ pct: number }>
  const products = payload.products as Array<{ ticker: string; pctOfContribution: number; eurosThisMonth: number }>
  const breakdown = payload.monthlyBreakdown as Array<{ ticker: string; pct: number; euros: number }>
  around(roundedSum(allocation.map(row => row.pct)), 100, 0.5)
  around(roundedSum(products.map(row => row.pctOfContribution)), 100, 0.5)
  around(roundedSum(breakdown.map(row => row.pct)), 100, 0.5)
  around(roundedSum(products.map(row => row.eurosThisMonth)), contribution, 0.05)
  around(roundedSum(breakdown.map(row => row.euros)), contribution, 0.05)
  const seen = new Set<string>()
  for (const product of products) {
    if (seen.has(product.ticker)) fail()
    seen.add(product.ticker)
    const row = breakdown.find(item => item.ticker === product.ticker)
    if (!row) fail()
    around(row.pct, product.pctOfContribution, 0.5)
    around(row.euros, product.eurosThisMonth, 0.05)
  }
  if (breakdown.length !== products.length) fail()
  return { ...payload, input, ...metadata('strat-live'), disclaimer } as unknown as StrategyPlan
}
