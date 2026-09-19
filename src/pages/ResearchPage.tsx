import { useMemo, useState } from 'react'
import { AGENT_ROSTER } from '../agents/roster'
import { WORKFLOW_STAGES, defaultSelectedAgents, runResearch, DISCLAIMER } from '../agents/orchestrator'
import type { AgentId, ResearchBrief } from '../types'
import { useAppState } from '../hooks/useAppState'
import { StanceBadge } from '../components/StanceBadge'

export function ResearchPage() {
  const { settings, addBrief } = useAppState()
  const specialists = useMemo(() => AGENT_ROSTER.filter((a) => !a.isChair), [])
  const [ticker, setTicker] = useState('AAPL')
  const [question, setQuestion] = useState('¿Qué calidad tiene el negocio y qué riesgos relevantes hay?')
  const [selected, setSelected] = useState<AgentId[]>(defaultSelectedAgents())
  const [running, setRunning] = useState(false)
  const [stage, setStage] = useState<string | null>(null)
  const [brief, setBrief] = useState<ResearchBrief | null>(null)

  function toggle(id: AgentId) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function onRun() {
    setRunning(true)
    setBrief(null)
    try {
      const result = await runResearch({
        ticker,
        question,
        selectedAgents: selected,
        settings,
        onStage: setStage,
      })
      setBrief(result)
      await addBrief(result)
    } finally {
      setRunning(false)
      setStage(null)
    }
  }

  return (
    <div>
      <h1 className="page-title">Espacio de investigación</h1>
      <p className="page-sub">
        Orquestación multi-agente · modo {settings.mockMode ? 'demostración' : 'LLM'} · pruebe AAPL, VWCE o ITX
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="grid grid-2">
          <div className="field">
            <label>Ticker / ISIN simbólico</label>
            <input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="AAPL" />
          </div>
          <div className="field">
            <label>Pregunta de investigación</label>
            <input value={question} onChange={(e) => setQuestion(e.target.value)} />
          </div>
        </div>
        <label className="muted" style={{ fontSize: 12 }}>Agentes participantes</label>
        <div className="row" style={{ marginTop: 8, marginBottom: 14 }}>
          {specialists.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`agent-chip${selected.includes(a.id) ? ' on' : ''}`}
              onClick={() => toggle(a.id)}
              style={{ borderColor: selected.includes(a.id) ? a.color : undefined }}
            >
              {a.icon} {a.shortName}
            </button>
          ))}
        </div>
        <div className="row">
          <button className="btn btn-primary" disabled={running || selected.length === 0} onClick={() => void onRun()}>
            {running ? 'Ejecutando flujo…' : 'Lanzar análisis'}
          </button>
          <span className="badge demo">Demo rica sin API key</span>
        </div>

        {(running || stage) && (
          <div className="progress">
            {WORKFLOW_STAGES.map((s) => {
              const idx = WORKFLOW_STAGES.findIndex((x) => x.id === stage)
              const mine = WORKFLOW_STAGES.findIndex((x) => x.id === s.id)
              const cls = stage === s.id ? 'on' : idx > mine ? 'done' : ''
              return <span key={s.id} className={`step ${cls}`}>{s.label}</span>
            })}
          </div>
        )}
      </div>

      {brief && <BriefView brief={brief} />}
    </div>
  )
}

function BriefView({ brief }: { brief: ResearchBrief }) {
  return (
    <div>
      <div className="disclaimer-banner">{brief.disclaimer || DISCLAIMER}</div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row">
          <h2 style={{ margin: 0 }}>{brief.synthesis.title}</h2>
          <span className="badge demo">{brief.mode === 'mock' ? 'demostración' : 'live'}</span>
          <StanceBadge stance={brief.synthesis.finalStance} />
        </div>
        <p style={{ marginTop: 12 }}>{brief.synthesis.executiveSummary}</p>
        <div className="grid grid-2" style={{ marginTop: 12 }}>
          <div>
            <h3>Caso alcista (bull)</h3>
            <ul className="clean">{brief.synthesis.bullCase.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
          <div>
            <h3>Caso bajista (bear)</h3>
            <ul className="clean">{brief.synthesis.bearCase.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
          <div className="risks-box">
            <strong>Riesgos</strong>
            <ul className="clean">{brief.synthesis.risks.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
          <div>
            <h3>Incertidumbres</h3>
            <ul className="clean">{brief.synthesis.uncertainties.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        </div>
      </div>

      {brief.disagreements.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2>Desacuerdos entre agentes</h2>
          {brief.disagreements.map((d) => (
            <div key={d.topic} style={{ marginBottom: 12 }}>
              <strong>{d.topic}</strong>
              <ul className="clean">
                {d.positions.map((p) => (
                  <li key={p.agent}><em>{p.agent}:</em> {p.view}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ fontSize: 18 }}>Contribuciones por agente</h2>
      <div className="grid grid-2">
        {brief.contributions.map((c, i) => (
          <div className="card" key={`${c.agentId}-${i}`}>
            <div className="row">
              <h2 style={{ margin: 0, fontSize: 15 }}>{c.agentName}</h2>
              {c.stance && <StanceBadge stance={c.stance} />}
              {c.conviction && <span className="badge">Convicción {c.conviction}</span>}
            </div>
            <p style={{ fontSize: 13.5 }}>{c.summary}</p>
            {c.facts.length > 0 && (
              <div className="facts">
                <strong>Hechos</strong>
                <ul className="clean">{c.facts.map((f) => <li key={f}>{f}</li>)}</ul>
              </div>
            )}
            {c.judgments.length > 0 && (
              <div className="judgments">
                <strong>Juicios</strong>
                <ul className="clean">{c.judgments.map((f) => <li key={f}>{f}</li>)}</ul>
              </div>
            )}
            {c.risks.length > 0 && (
              <div className="risks-box">
                <strong>Riesgos</strong>
                <ul className="clean">{c.risks.map((f) => <li key={f}>{f}</li>)}</ul>
              </div>
            )}
            {c.dissentNote && <p className="badge warn">{c.dissentNote}</p>}
          </div>
        ))}
      </div>
      <p className="footer-note">{DISCLAIMER}</p>
    </div>
  )
}
