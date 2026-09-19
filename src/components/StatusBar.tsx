import { AGENT_ROSTER } from '../agents/roster'
import { useAppState } from '../hooks/useAppState'

export function StatusBar() {
  const { settings, briefs, icSessions, strategies } = useAppState()
  return (
    <footer className="status-bar">
      <span>Foro Inversor v1</span>
      <span className="sep">|</span>
      <span>{AGENT_ROSTER.length} agentes</span>
      <span className="sep">|</span>
      <span>{settings.mockMode ? 'MODO DEMO' : 'MODO LIVE · OpenRouter'}</span>
      <span className="sep">|</span>
      <span>
        Briefs {briefs.length} · IC {icSessions.length} · Estrategias {strategies.length}
      </span>
      <span className="spacer" />
      <span className="muted">No es asesoramiento financiero</span>
    </footer>
  )
}
