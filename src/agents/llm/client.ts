import type { AgentId, AppSettings, ResearchBrief, ICSession, StrategyInput, StrategyPlan } from '../../types'
import { getMockBrief, getMockICSession, DISCLAIMER } from '../mock/demos'
import { buildMockStrategy } from '../mock/strategy'
import { AGENT_ROSTER } from '../roster'

/**
 * Cliente OpenAI-compatible (preset: OpenRouter).
 * Base por defecto: https://openrouter.ai/api/v1
 * Cabeceras opcionales recomendadas por OpenRouter: HTTP-Referer, X-Title.
 * La API key NUNCA se escribe en logs ni en mensajes de error.
 */
async function chatCompletion(settings: AppSettings, system: string, user: string): Promise<string> {
  const base = (settings.apiBaseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '')
  const url = `${base}/chat/completions`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${settings.apiKey}`,
    // OpenRouter attribution (sin secretos)
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
    const t = await res.text()
    throw new Error(`HTTP ${res.status} en proveedor LLM: ${t.slice(0, 160)}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
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
  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
    return {
      ...getMockBrief(opts.ticker, opts.question, opts.selectedAgents),
      ...parsed,
      mode: 'live',
      disclaimer: DISCLAIMER,
      id: `brief-live-${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
  } catch {
    const mock = getMockBrief(opts.ticker, opts.question, opts.selectedAgents)
    mock.mode = 'live'
    mock.synthesis.executiveSummary = raw.slice(0, 2000) || mock.synthesis.executiveSummary
    return mock
  }
}

export async function runLiveIC(opts: {
  ticker: string
  thesis: string
  settings: AppSettings
}): Promise<ICSession> {
  const system = `CIO Mesa Institucional Foro Inversor. JSON ICSession en español.`
  const user = `Ticker: ${opts.ticker}\nTesis: ${opts.thesis}`
  const raw = await chatCompletion(opts.settings, system, user)
  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
    return {
      ...getMockICSession(opts.ticker, opts.thesis),
      ...parsed,
      mode: 'live',
      disclaimer: DISCLAIMER,
      id: `ic-live-${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
  } catch {
    const mock = getMockICSession(opts.ticker, opts.thesis)
    mock.mode = 'live'
    mock.actaMemo = raw.slice(0, 3000) || mock.actaMemo
    return mock
  }
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
  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
    return {
      ...buildMockStrategy(opts.input),
      ...parsed,
      mode: 'live',
      disclaimer: DISCLAIMER,
      id: `strat-live-${Date.now()}`,
      createdAt: new Date().toISOString(),
      input: opts.input,
    }
  } catch {
    const mock = buildMockStrategy(opts.input)
    mock.mode = 'live'
    mock.executiveBrief = raw.slice(0, 4000) || mock.executiveBrief
    return mock
  }
}
