import type { AgentId, AppSettings, ResearchBrief, ICSession, StrategyInput, StrategyPlan } from '../../types'
import { getMockBrief, getMockICSession, DISCLAIMER } from '../mock/demos'
import { buildMockStrategy } from '../mock/strategy'
import { AGENT_ROSTER } from '../roster'

/** Cliente OpenAI-compatible. TODO(P1): mover las peticiones y credenciales al proceso principal Electron. */
async function chatCompletion(settings: AppSettings, system: string, user: string): Promise<string> {
  const base = (settings.apiBaseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '')
  const url = `${base}/chat/completions`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${settings.apiKey}`,
    'HTTP-Referer': 'https://foro-inversor.local',
    'X-Title': 'Foro Inversor',
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: settings.model || 'z-ai/glm-5.3-flashx',
      temperature: 0.4,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!res.ok) {
    // No incluir en errores el cuerpo arbitrario del proveedor: puede contener datos sensibles.
    throw new Error(`HTTP ${res.status} en proveedor LLM`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

/** Rechazar respuestas no JSON en vez de presentar contenido demo con una insignia «live».
 * TODO(P4): validar exhaustivamente los tres contratos con esquemas de runtime.
 */
function parseLiveObject(raw: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
  } catch {
    throw new Error('La respuesta del modelo no contiene JSON válido')
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('La respuesta del modelo no es un objeto JSON')
  }
  return parsed as Record<string, unknown>
}

export async function runLiveResearch(opts: {
  ticker: string
  question: string
  selectedAgents: AgentId[]
  settings: AppSettings
}): Promise<ResearchBrief> {
  const agents = AGENT_ROSTER.filter((a) => opts.selectedAgents.includes(a.id))
  const system = `Eres el orquestador de Foro Inversor (es-ES). JSON ResearchBrief. Disclaimer no asesoramiento.`
  const user = `Ticker: ${opts.ticker}\nPregunta: ${opts.question}\nAgentes: ${agents.map((a) => a.name).join(', ')}`
  const raw = await chatCompletion(opts.settings, system, user)
  const parsed = parseLiveObject(raw)
  return {
    ...getMockBrief(opts.ticker, opts.question, opts.selectedAgents),
    ...parsed,
    mode: 'live',
    disclaimer: DISCLAIMER,
    id: `brief-live-${Date.now()}`,
    createdAt: new Date().toISOString(),
  } as ResearchBrief
}

export async function runLiveIC(opts: {
  ticker: string
  thesis: string
  settings: AppSettings
}): Promise<ICSession> {
  const system = `CIO Mesa Institucional Foro Inversor. JSON ICSession en español.`
  const user = `Ticker: ${opts.ticker}\nTesis: ${opts.thesis}`
  const raw = await chatCompletion(opts.settings, system, user)
  const parsed = parseLiveObject(raw)
  return {
    ...getMockICSession(opts.ticker, opts.thesis),
    ...parsed,
    mode: 'live',
    disclaimer: DISCLAIMER,
    id: `ic-live-${Date.now()}`,
    createdAt: new Date().toISOString(),
  } as ICSession
}

export async function runLiveStrategy(opts: {
  input: StrategyInput
  settings: AppSettings
}): Promise<StrategyPlan> {
  const system = `Arquitecto de Estrategia — Foro Inversor (mesa de inversión, es-ES).
Devuelve JSON StrategyPlan operativo y decisivo (no tono escolar). No eres asesor CNMV ni bróker.
PRIORIDAD: aportación MENSUAL (monthlyContributionEur). Debe incluir:
- monthlyContributionEur
- products con tickers/ISINs reales UCITS cuando sea posible; suggestedPct, pctOfContribution, eurosThisMonth (2–4 ETF; no 100% en uno salvo cuota <30€)
- monthlyBreakdown: [{ticker,name,pct,euros,why}]
- brokers: BrokerIdea[] (3–5) ranking Trade Republic, MyInvestor, IBKR, DEGIRO, Scalable, Renta 4/Self Bank, Indexa — fitScore, bestFor, whyFits, pros/cons, feeNotes concretas (savings plans, custodia, FX), spainRetailNotes; demoLabel = "verifique tarifas actuales en el bróker"
- steps: [{title,detail}] operativos (elegir bróker de la lista, transferencia, compras día D, revisión 6–12m)
- executiveBrief que empiece con "De tus X€ este mes compra…" + sección "Brokers recomendados para tu plan"
- disclaimer corto CNMV/no bróker`
  const user = JSON.stringify(opts.input)
  const raw = await chatCompletion(opts.settings, system, user)
  const parsed = parseLiveObject(raw)
  return {
    ...buildMockStrategy(opts.input),
    ...parsed,
    mode: 'live',
    disclaimer: DISCLAIMER,
    id: `strat-live-${Date.now()}`,
    createdAt: new Date().toISOString(),
    input: opts.input,
  } as StrategyPlan
}
