import { useMemo, useState } from 'react'
import { AGENT_ROSTER } from '../agents/roster'
import { IC_STAGES, runInvestmentCommittee, DISCLAIMER } from '../agents/orchestrator'
import type { ICSession, Stance } from '../types'
import { useAppState } from '../hooks/useAppState'
import { StanceBadge } from '../components/StanceBadge'

/** Posiciones alrededor de la mesa (porcentaje del contenedor) */
const SEAT_LAYOUT: { top: string; left: string }[] = [
  { top: '6%', left: '42%' },
  { top: '14%', left: '68%' },
  { top: '32%', left: '82%' },
  { top: '55%', left: '82%' },
  { top: '72%', left: '68%' },
  { top: '78%', left: '42%' },
  { top: '72%', left: '16%' },
  { top: '55%', left: '4%' },
  { top: '32%', left: '4%' },
  { top: '14%', left: '16%' },
  { top: '8%', left: '55%' },
  { top: '22%', left: '78%' },
  { top: '48%', left: '88%' },
  { top: '68%', left: '55%' },
  { top: '48%', left: '0%' },
]

export function MesaPage() {
  const { settings, addICSession } = useAppState()
  const [ticker, setTicker] = useState('AAPL')
  const [thesis, setThesis] = useState(
    'Posición de calidad a largo plazo con disciplina de valoración y de peso en cartera.',
  )
  const [running, setRunning] = useState(false)
  const [stage, setStage] = useState<string | null>(null)
  const [session, setSession] = useState<ICSession | null>(null)
  const [highlight, setHighlight] = useState<string | null>(null)

  const seats = useMemo(() => AGENT_ROSTER.filter((a) => !a.isChair).slice(0, 15), [])
  const cio = AGENT_ROSTER.find((a) => a.isChair)!

  async function onRun() {
    setRunning(true)
    setSession(null)
    setHighlight(null)
    try {
      const result = await runInvestmentCommittee({
        ticker,
        thesis,
        settings,
        onStage: (s) => {
          setStage(s)
          if (s === 'ronda') setHighlight('renta-variable')
          if (s === 'redteam') setHighlight('abogado-diablo')
          if (s === 'votacion') setHighlight(null)
          if (s === 'acta') setHighlight('cio-mesa')
        },
      })
      setSession(result)
      await addICSession(result)
    } finally {
      setRunning(false)
      setStage(null)
    }
  }

  return (
    <div>
      <h1 className="page-title">Mesa institucional</h1>
      <p className="page-sub">
        Comité de inversiones estilo buy-side · el CIO modera · votación formal con disensos
      </p>

      <div className="disclaimer-banner">
        Banner permanente: esto <strong>no es asesoramiento financiero</strong>. La mesa es una simulación educativa.
        Datos de ejemplo salvo que active LLM en Ajustes.
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="grid grid-2">
          <div className="field">
            <label>Ticker / tema</label>
            <input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="AAPL / VWCE / ITX" />
          </div>
          <div className="field">
            <label>Tesis presentada al comité</label>
            <input value={thesis} onChange={(e) => setThesis(e.target.value)} />
          </div>
        </div>
        <div className="row">
          <button className="btn btn-primary" disabled={running} onClick={() => void onRun()}>
            {running ? 'Sesión IC en curso…' : 'Convocar mesa (IC)'}
          </button>
          <span className="badge demo">Demo IC completa en español</span>
          <span className="badge accent">{cio.icon} {cio.name}</span>
        </div>
        {(running || stage) && (
          <div className="progress">
            {IC_STAGES.map((s) => {
              const idx = IC_STAGES.findIndex((x) => x.id === stage)
              const mine = IC_STAGES.findIndex((x) => x.id === s.id)
              const cls = stage === s.id ? 'on' : idx > mine ? 'done' : ''
              return <span key={s.id} className={`step ${cls}`}>{s.label}</span>
            })}
          </div>
        )}
      </div>

      <div className="mesa-room" style={{ marginBottom: 18 }}>
        {seats.map((a, i) => {
          const pos = SEAT_LAYOUT[i % SEAT_LAYOUT.length]
          const vote = session?.votes.find((v) => v.agentId === a.id)
          return (
            <div
              key={a.id}
              className={`seat${highlight === a.id ? ' speaking' : ''}`}
              style={{ top: pos.top, left: pos.left }}
              title={a.name}
            >
              <div>
                <span className="dot" style={{ background: a.color }} />
                <strong>{a.shortName}</strong>
              </div>
              <div className="muted" style={{ marginTop: 4, lineHeight: 1.2 }}>{a.name}</div>
              {vote && (
                <div style={{ marginTop: 6 }} className={`stance-${vote.stance}`}>
                  {labelStance(vote.stance)} · {vote.conviction}
                </div>
              )}
            </div>
          )
        })}
        <div className="mesa-table">
          <div className="cio-chip">
            <div style={{ fontSize: 22 }}>{cio.icon}</div>
            <strong>{cio.name}</strong>
            <div className="muted" style={{ fontSize: 11 }}>Moderación · acta</div>
            {session && (
              <div style={{ marginTop: 8 }}>
                <StanceBadge stance={session.recommendation} />
              </div>
            )}
          </div>
        </div>
      </div>

      {session && <ICResult session={session} />}
    </div>
  )
}

function labelStance(s: Stance) {
  return { comprar: 'Comprar', mantener: 'Mantener', evitar: 'Evitar', insuficiente: 'Insuficiente' }[s]
}

function ICResult({ session }: { session: ICSession }) {
  const counts = session.votes.reduce(
    (acc, v) => {
      acc[v.stance] = (acc[v.stance] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  return (
    <div>
      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h2>Apertura del CIO</h2>
          <p style={{ fontSize: 14 }}>{session.openingBrief}</p>
          <p className="muted" style={{ fontSize: 13 }}><strong>Tesis:</strong> {session.thesis}</p>
          <div className="row" style={{ marginTop: 8 }}>
            <StanceBadge stance={session.recommendation} />
            <span className="badge">Convicción agregada: {session.convictionAggregate}</span>
            <span className="badge demo">{session.mode}</span>
          </div>
        </div>
        <div className="card">
          <h2>Tally de votos</h2>
          <table className="table">
            <tbody>
              {(['comprar', 'mantener', 'evitar', 'insuficiente'] as Stance[]).map((s) => (
                <tr key={s}>
                  <td><StanceBadge stance={s} /></td>
                  <td><strong>{counts[s] || 0}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 13 }}>{session.dissentSummary}</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Ronda de vistas</h2>
        <div className="grid grid-2">
          {session.rounds.map((r) => (
            <div key={r.agentId} style={{ padding: 10, border: '1px solid var(--border-soft)', borderRadius: 10 }}>
              <strong>{r.agentName}</strong>
              <p style={{ fontSize: 13.5 }}>{r.view}</p>
              {r.facts.length > 0 && (
                <div className="facts">
                  <ul className="clean">{r.facts.map((f) => <li key={f}>{f}</li>)}</ul>
                </div>
              )}
              {r.judgments.length > 0 && (
                <div className="judgments">
                  <ul className="clean">{r.judgments.map((f) => <li key={f}>{f}</li>)}</ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Desafíos del Abogado del diablo</h2>
        {session.challenges.map((c, i) => (
          <div key={i} style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border-soft)' }}>
            <div className="badge warn">{c.from} → {c.to}</div>
            <p style={{ fontSize: 14 }}><strong>Desafío:</strong> {c.challenge}</p>
            {c.reply && <p style={{ fontSize: 14 }}><strong>Respuesta:</strong> {c.reply}</p>}
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Votos individuales</h2>
        <table className="table">
          <thead>
            <tr><th>Agente</th><th>Postura</th><th>Convicción</th><th>Nota</th></tr>
          </thead>
          <tbody>
            {session.votes.map((v) => (
              <tr key={v.agentId}>
                <td>{v.agentName}</td>
                <td><StanceBadge stance={v.stance} /></td>
                <td>{v.conviction}</td>
                <td className="muted">{v.oneLiner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Acta de comité (memo del CIO)</h2>
        <pre style={{
          whiteSpace: 'pre-wrap',
          fontFamily: 'inherit',
          fontSize: 13.5,
          lineHeight: 1.5,
          margin: 0,
          color: 'var(--text)',
        }}>{session.actaMemo}</pre>
        <p className="footer-note">{session.disclaimer || DISCLAIMER}</p>
      </div>
    </div>
  )
}
