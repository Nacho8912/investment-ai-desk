import type { AgentId, AppSettings, ResearchBrief, ICSession, StrategyInput, StrategyPlan } from '../../types'
import { DISCLAIMER } from '../mock/demos'
import { AGENT_ROSTER } from '../roster'
import { validateResearchResponse, validateICResponse, validateStrategyResponse } from './validate'

/** Only Electron main performs authenticated provider fetches. Web preview is mock-only. */
async function chatCompletion(_settings: AppSettings, system: string, user: string): Promise<string> {
  if (typeof window === 'undefined' || !window.foroAPI?.llmComplete) {
    throw new Error('La IA live requiere la aplicación Electron')
  }
  return window.foroAPI.llmComplete(system, user)
}

const RULES = `Devuelve únicamente un objeto JSON válido, sin Markdown y sin propiedades adicionales.
Incluye TODOS los campos solicitados y todos los campos anidados, incluso listas vacías.
No inventes datos de mercado, precios, tarifas, ISIN o fuentes. Señala explícitamente lagunas en uncertainties/risks.
Una única llamada al modelo redacta esta simulación de roles: no afirmes consultas independientes a especialistas.
No incluyas id, createdAt, mode, disclaimer ni input: los establece la aplicación.
Stance: comprar | mantener | evitar | insuficiente. Conviction: alta | media | baja.
Cuando no tengas información suficiente, expresa incertidumbre; nunca completes campos con datos ficticios.`

export async function runLiveResearch(opts: {
  ticker: string; question: string; selectedAgents: AgentId[]; settings: AppSettings
}): Promise<ResearchBrief> {
  const ticker = opts.ticker.trim().toUpperCase()
  const agents = AGENT_ROSTER.filter(agent => opts.selectedAgents.includes(agent.id))
  const system = `Genera un ResearchBrief en español. ${RULES}
Contrato JSON obligatorio:
{ "stages": string[al menos 1], "contributions": [
{ "agentId": string, "agentName": string, "stage": string, "summary": string,
"facts": string[], "judgments": string[], "risks": string[],
"stance"?: stance, "conviction"?: conviction, "dissentNote"?: string } ],
"synthesis": { "title": string, "bullCase": string[], "bearCase": string[],
"risks": string[], "uncertainties": string[], "finalStance": stance, "executiveSummary": string },
"disagreements": [{"topic": string, "positions": [{"agent": string,"view": string}, al menos 2]}] }
Usa exclusivamente agentId de los agentes solicitados; facts sin verificación deben identificarse como no verificados.
Ticker y pregunta los añade la aplicación; no los incluyas en el JSON.`
  const user = `Ticker: ${ticker}\nPregunta: ${opts.question}\nRoles solicitados: ${agents.map(agent => `${agent.id}: ${agent.name}`).join(', ')}`
  const raw = await chatCompletion(opts.settings, system, user)
  return validateResearchResponse(raw, ticker, opts.question, opts.selectedAgents, DISCLAIMER)
}

export async function runLiveIC(opts: {
  ticker: string; thesis: string; settings: AppSettings
}): Promise<ICSession> {
  const ticker = opts.ticker.trim().toUpperCase()
  const system = `Genera una simulación de acta de comité ICSession en español. ${RULES}
Contrato JSON obligatorio:
{ "openingBrief": string,
"rounds": [{"agentId": string,"agentName": string,"view": string,"facts": string[],"judgments": string[]}],
"challenges": [{"from": string,"to": string,"challenge": string,"reply"?: string}],
"votes": [{"agentId": string,"agentName": string,"stance": stance,"conviction": conviction,"oneLiner": string}],
"recommendation": stance,"convictionAggregate": conviction,"actaMemo": string,"dissentSummary": string }
Es una simulación de roles de una sola respuesta del modelo, no votos de personas o agentes independientes.
Ticker y tesis los añade la aplicación; no los incluyas en el JSON.`
  const raw = await chatCompletion(opts.settings, system, `Ticker: ${ticker}\nTesis: ${opts.thesis}`)
  return validateICResponse(raw, ticker, opts.thesis, DISCLAIMER)
}

export async function runLiveStrategy(opts: {
  input: StrategyInput; settings: AppSettings
}): Promise<StrategyPlan> {
  const system = `Genera StrategyPlan de planificación educativa en español. ${RULES}
Contrato JSON obligatorio:
{ "title": string,"monthlyContributionEur": number,"nearTermView": string,"longTermThesis": string,
"allocation": [{"key":string,"label":string,"pct":number,"color":"#RRGGBB","rationale":string}],
"products": [{"ticker":string,"name":string,"assetClass":string,"suggestedPct":number,
"pctOfContribution":number,"eurosThisMonth":number,"minCapitalHint":string,"why":string,
"liquidity":"alta|media|baja","demoLabel":string}],
"monthlyBreakdown": [{"ticker":string,"name":string,"pct":number,"euros":number,"why":string}],
"steps": [{"title":string,"detail":string}],
"brokers": [{"id":string,"name":string,"fitScore":number,"bestFor":string,"whyFits":string,
"pros":string[],"cons":string[],"monthlyDcaFriendly":boolean,"ucitsEtfs":boolean,
"spainRetailNotes":string,"feeNotes":string,"demoLabel":string}],
"rebalancing":string[],"riskChecklist":string[],
"agentNotes": [{"agentId":string,"agentName":string,"stage":string,"summary":string,
"facts":string[],"judgments":string[],"risks":string[]}],
"disagreements": [{"topic":string,"positions":[{"agent":string,"view":string},{"agent":string,"view":string}]}],
"executiveBrief":string }
Todas las cuotas porcentuales de allocation, products.pctOfContribution y monthlyBreakdown deben sumar 100 cada una.
La suma de eurosThisMonth y la de monthlyBreakdown.euros deben coincidir por separado con monthlyContributionEur.
Cada producto debe tener exactamente una fila mensual con ticker, porcentaje y euros coincidentes.
No pongas precios, ISIN, tarifas ni disponibilidad no verificados; demoLabel debe pedir verificar condiciones actuales.
Usa nombres de roles en agentNotes sin fingir agentes autónomos. Los porcentajes serán comprobados por código.`
  const raw = await chatCompletion(opts.settings, system, JSON.stringify(opts.input))
  return validateStrategyResponse(raw, opts.input, DISCLAIMER)
}
