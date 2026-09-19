import { AGENT_ROSTER } from '../agents/roster'

export function AgentsPage() {
  return (
    <div>
      <h1 className="page-title">Plantilla de agentes</h1>
      <p className="page-sub">
        {AGENT_ROSTER.length} especialistas · mandatos y metodología en español · CIO preside mesa y valida estrategias
      </p>
      <div className="grid grid-3">
        {AGENT_ROSTER.map((a) => (
          <div className="card agent-card" key={a.id} style={{ borderTop: `3px solid ${a.color}` }}>
            <div className="row">
              <span style={{ fontSize: 22 }}>{a.icon}</span>
              <div>
                <h2 style={{ margin: 0, fontSize: 15 }}>{a.name}</h2>
                <div className="muted" style={{ fontSize: 12 }}>
                  {a.role}
                  {a.isChair ? ' · Presidencia' : ''}
                </div>
              </div>
            </div>
            <p style={{ fontSize: 13, marginTop: 10 }}>{a.description}</p>
            <p className="method-note"><strong>Método:</strong> {a.methodology}</p>
            <span className="badge">{a.defaultSelected ? 'Por defecto en flujos' : 'Opcional / sectorial'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
