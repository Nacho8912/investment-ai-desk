import type { AgentId, ResearchBrief, ICSession, AppSettings, StrategyInput, StrategyPlan } from '../types'
import { getMockBrief, getMockICSession, DISCLAIMER } from './mock/demos'
import { buildMockStrategy } from './mock/strategy'
import { runLiveResearch, runLiveIC, runLiveStrategy } from './llm/client'
import { AGENT_ROSTER } from './roster'

export const WORKFLOW_STAGES = [
  { id: 'recopilar', label: 'Recopilar' }, { id: 'analizar', label: 'Analizar' },
  { id: 'debatir', label: 'Debatir' }, { id: 'sintetizar', label: 'Sintetizar' },
  { id: 'checklist-riesgo', label: 'Checklist de riesgo' }, { id: 'brief-final', label: 'Brief final' },
] as const
export const IC_STAGES = [
  { id: 'apertura', label: 'Apertura del CIO' }, { id: 'ronda', label: 'Ronda de vistas' },
  { id: 'redteam', label: 'Desafíos (red team)' }, { id: 'votacion', label: 'Votación formal' },
  { id: 'acta', label: 'Acta de comité' },
] as const
export const STRATEGY_STAGES = [
  { id: 'perfil', label: 'Perfil y cuota mensual' }, { id: 'restricciones', label: 'Restricciones' },
  { id: 'asignacion', label: 'Asignación' }, { id: 'productos', label: 'Reparto de la cuota' },
  { id: 'debate', label: 'Debate / disenso' }, { id: 'brief', label: 'Paso a paso + brief' },
] as const
export async function runResearch(opts: {
  ticker: string; question: string; selectedAgents: AgentId[]; settings: AppSettings
  onStage?: (stage: string) => void
}): Promise<ResearchBrief> {
  const { ticker, question, selectedAgents, settings, onStage } = opts
  for (const s of WORKFLOW_STAGES) { onStage?.(s.id); await delay(settings.mockMode ? 220 : 100) }
  if (settings.mockMode || !settings.hasApiKey) return getMockBrief(ticker, question, selectedAgents)
  try { return await runLiveResearch({ ticker, question, selectedAgents, settings }) }
  catch (e) {
    const fallback = getMockBrief(ticker, question, selectedAgents)
    fallback.synthesis.executiveSummary =
      `⚠️ Sin conexión API / fallo LLM (${(e as Error).message}). Simulación local.\n\n` + fallback.synthesis.executiveSummary
    return fallback
  }
}
export async function runInvestmentCommittee(opts: {
  ticker: string; thesis: string; settings: AppSettings; onStage?: (stage: string) => void
}): Promise<ICSession> {
  const { ticker, thesis, settings, onStage } = opts
  for (const s of IC_STAGES) { onStage?.(s.id); await delay(settings.mockMode ? 280 : 120) }
  if (settings.mockMode || !settings.hasApiKey) return getMockICSession(ticker, thesis)
  try { return await runLiveIC({ ticker, thesis, settings }) }
  catch (e) {
    const fallback = getMockICSession(ticker, thesis)
    fallback.actaMemo = `⚠️ Sin conexión API / fallo LLM (${(e as Error).message}). Simulación local.\n\n` + fallback.actaMemo
    return fallback
  }
}
export async function runStrategyBuilder(opts: {
  input: StrategyInput; settings: AppSettings; onStage?: (stage: string) => void
}): Promise<StrategyPlan> {
  const { input, settings, onStage } = opts
  const useLive = Boolean(settings.hasApiKey) && !settings.mockMode
  for (const s of STRATEGY_STAGES) { onStage?.(s.id); await delay(useLive ? 120 : 260) }
  if (!useLive) {
    const plan = buildMockStrategy(input)
    if (!settings.hasApiKey) plan.executiveBrief =
      '⚠️ Sin conexión API — plan simulado con reglas locales.\n\n' + plan.executiveBrief
    return plan
  }
  try { return await runLiveStrategy({ input, settings }) }
  catch (e) {
    const fallback = buildMockStrategy(input)
    fallback.executiveBrief =
      `⚠️ Sin conexión API / fallo LLM (${(e as Error).message}). Plan simulado.\n\n` + fallback.executiveBrief
    return fallback
  }
}
export function defaultSelectedAgents(): AgentId[] {
  return AGENT_ROSTER.filter((a) => a.defaultSelected && !a.isChair).map((a) => a.id)
}
export { DISCLAIMER, AGENT_ROSTER }
function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)) }
