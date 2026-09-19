import { useState } from 'react'
import { STRATEGY_STAGES, runStrategyBuilder, DISCLAIMER } from '../agents/orchestrator'
import type { StrategyInput, StrategyPlan, RiskTolerance, InvestGoal, HorizonCode } from '../types'
import { useAppState } from '../hooks/useAppState'

const defaultInput = (): StrategyInput => ({
  monthlyContributionEur: 50,
  capitalEur: 0,
  contributionDay: 1,
  horizon: 'corto',
  risk: 'moderado',
  goal: 'ingresos',
  constraints: {
    esg: false,
    noCrypto: true,
    spainRetail: true,
    preferAccumulating: true,
    maxSingleStockPct: 5,
  },
  notes: '',
})

function fmtEur(n: number) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function StrategyPage() {
  const { settings, addStrategy, toast } = useAppState()
  const [input, setInput] = useState<StrategyInput>(defaultInput)
  const [running, setRunning] = useState(false)
  const [stage, setStage] = useState<string | null>(null)
  const [plan, setPlan] = useState<StrategyPlan | null>(null)

  async function onRun() {
    if (input.monthlyContributionEur < 10) {
      toast('warn', 'La aportación mensual mínima es 10 €.')
      return
    }
    setRunning(true)
    setPlan(null)
    try {
      const result = await runStrategyBuilder({ input, settings, onStage: setStage })
      setPlan(result)
      await addStrategy(result)
      toast('success', 'Plan mensual generado.')
    } catch (e) {
      toast('error', `Error: ${(e as Error).message}`)
    } finally {
      setRunning(false)
      setStage(null)
    }
  }

  function printBrief() {
    window.print()
  }

  return (
    <div className="strategy-page">
      <h1 className="page-title">Estrategia a medida</h1>
      <p className="page-sub">
        Indique su <strong>aportación mensual</strong> · el comité reparte cada euro entre varios productos y le guía paso a paso
      </p>
      <div className="disclaimer-banner">
        Mesa de estrategia operativa. <strong>No es asesor CNMV ni bróker</strong> (no ejecuta órdenes).
        Rentabilidad pasada ≠ futura.
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Perfil de entrada</h2>
        <div className="grid grid-3">
          <div className="field">
            <label>Aportación mensual (EUR)</label>
            <input
              type="number"
              min={10}
              step={10}
              value={input.monthlyContributionEur}
              onChange={(e) => setInput({ ...input, monthlyContributionEur: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label>Capital inicial ya invertido (opcional)</label>
            <input
              type="number"
              min={0}
              step={100}
              value={input.capitalEur}
              onChange={(e) => setInput({ ...input, capitalEur: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label>Día de aportación (1–28, opcional)</label>
            <input
              type="number"
              min={1}
              max={28}
              value={input.contributionDay ?? 1}
              onChange={(e) => setInput({ ...input, contributionDay: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label>Horizonte</label>
            <select
              value={input.horizon}
              onChange={(e) => setInput({ ...input, horizon: e.target.value as HorizonCode })}
            >
              <option value="corto">Corto (&lt;3 años)</option>
              <option value="medio">Medio (3–7 años)</option>
              <option value="largo">Largo (7–15 años)</option>
              <option value="jubilacion">Jubilación / muy largo</option>
            </select>
          </div>
          <div className="field">
            <label>Tolerancia al riesgo</label>
            <select
              value={input.risk}
              onChange={(e) => setInput({ ...input, risk: e.target.value as RiskTolerance })}
            >
              <option value="conservador">Conservador</option>
              <option value="moderado">Moderado</option>
              <option value="dinamico">Dinámico</option>
              <option value="agresivo">Agresivo</option>
            </select>
          </div>
          <div className="field">
            <label>Objetivo</label>
            <select
              value={input.goal}
              onChange={(e) => setInput({ ...input, goal: e.target.value as InvestGoal })}
            >
              <option value="crecimiento">Crecimiento</option>
              <option value="ingresos">Ingresos / renta</option>
              <option value="preservacion">Preservación</option>
              <option value="equilibrado">Equilibrado</option>
            </select>
          </div>
          <div className="field">
            <label>Máx. % acción individual</label>
            <input
              type="number"
              min={0}
              max={20}
              value={input.constraints.maxSingleStockPct}
              onChange={(e) =>
                setInput({
                  ...input,
                  constraints: { ...input.constraints, maxSingleStockPct: Number(e.target.value) },
                })
              }
            />
          </div>
          <div className="field">
            <label>Notas (opcional)</label>
            <input
              value={input.notes || ''}
              onChange={(e) => setInput({ ...input, notes: e.target.value })}
              placeholder="p. ej. ya tengo fondo de emergencia"
            />
          </div>
        </div>
        <div className="row" style={{ gap: 16, marginBottom: 12 }}>
          <label className="chk">
            <input
              type="checkbox"
              checked={input.constraints.esg}
              onChange={(e) =>
                setInput({ ...input, constraints: { ...input.constraints, esg: e.target.checked } })
              }
            />{' '}
            Preferencia ESG
          </label>
          <label className="chk">
            <input
              type="checkbox"
              checked={input.constraints.noCrypto}
              onChange={(e) =>
                setInput({ ...input, constraints: { ...input.constraints, noCrypto: e.target.checked } })
              }
            />{' '}
            Sin cripto
          </label>
          <label className="chk">
            <input
              type="checkbox"
              checked={input.constraints.spainRetail}
              onChange={(e) =>
                setInput({
                  ...input,
                  constraints: { ...input.constraints, spainRetail: e.target.checked },
                })
              }
            />{' '}
            Enfoque retail ES / UCITS
          </label>
          <label className="chk">
            <input
              type="checkbox"
              checked={input.constraints.preferAccumulating}
              onChange={(e) =>
                setInput({
                  ...input,
                  constraints: { ...input.constraints, preferAccumulating: e.target.checked },
                })
              }
            />{' '}
            Preferir ETF Acc
          </label>
        </div>
        <div className="row">
          <button className="btn btn-primary" disabled={running} onClick={() => void onRun()}>
            {running ? 'Diseñando plan mensual…' : 'Generar plan mensual multi-agente'}
          </button>
          <span className="badge accent">OpenRouter live si hay API key · offline = reglas locales</span>
        </div>
        {(running || stage) && (
          <div className="progress">
            {STRATEGY_STAGES.map((s) => {
              const idx = STRATEGY_STAGES.findIndex((x) => x.id === stage)
              const mine = STRATEGY_STAGES.findIndex((x) => x.id === s.id)
              const cls = stage === s.id ? 'on' : idx > mine ? 'done' : ''
              return (
                <span key={s.id} className={`step ${cls}`}>
                  {s.label}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {plan && <StrategyResult plan={plan} onPrint={printBrief} />}
    </div>
  )
}

function StrategyResult({ plan, onPrint }: { plan: StrategyPlan; onPrint: () => void }) {
  const total = plan.allocation.reduce((s, a) => s + a.pct, 0) || 1
  let acc = 0
  const gradients = plan.allocation.map((a) => {
    const start = (acc / total) * 100
    acc += a.pct
    const end = (acc / total) * 100
    return `${a.color} ${start}% ${end}%`
  })

  const breakdown = plan.monthlyBreakdown?.length
    ? plan.monthlyBreakdown
    : plan.products.map((p) => ({
        ticker: p.ticker,
        name: p.name,
        pct: p.pctOfContribution ?? p.suggestedPct,
        euros: p.eurosThisMonth ?? 0,
        why: p.why,
      }))

  return (
    <div className="print-area">
      <div className="row" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>{plan.title}</h2>
        <span className={plan.mode === 'live' ? 'badge good' : 'badge warn'}>
          {plan.mode === 'live' ? 'live' : 'sin conexión API'}
        </span>
        <div className="spacer" />
        <button className="btn" onClick={onPrint}>
          Imprimir / PDF
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Reparto de esta cuota mensual</h2>
        <p className="muted" style={{ fontSize: 13.5, marginTop: 0 }}>
          De tus <strong>{fmtEur(plan.monthlyContributionEur)} €</strong> este mes — compra este reparto
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>%</th>
              <th>€ este mes</th>
              <th>Por qué</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((r) => (
              <tr key={r.ticker}>
                <td>
                  <strong>{r.ticker}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>{r.name}</div>
                </td>
                <td>{r.pct}%</td>
                <td><strong>{fmtEur(r.euros)} €</strong></td>
                <td style={{ fontSize: 12.5 }}>{r.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {plan.steps && plan.steps.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2>Paso a paso</h2>
          <ol className="steps-list">
            {plan.steps.map((s, i) => (
              <li key={`${i}-${s.title}`}>
                <strong>{s.title}</strong>
                <p style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, margin: '6px 0 0' }}>{s.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {plan.brokers && plan.brokers.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2>Brokers recomendados para tu plan</h2>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
            Ordenados por encaje con su cuota, UCITS y operativa España. Confirme tarifas e ISINs en el bróker antes de abrir cuenta.
          </p>
          <div className="grid grid-2">
            {plan.brokers.map((b) => (
              <div
                key={b.id}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card-2)',
                  marginBottom: 8,
                }}
              >
                <div className="row" style={{ marginBottom: 6 }}>
                  <strong style={{ fontSize: 15 }}>{b.name}</strong>
                  <span className="badge good">fit {b.fitScore}/10</span>
                  {b.monthlyDcaFriendly && <span className="badge accent">DCA</span>}
                  {b.ucitsEtfs && <span className="badge accent">UCITS</span>}
                </div>
                <div style={{ fontSize: 13, marginBottom: 6 }}>
                  <em>{b.bestFor}</em>
                </div>
                <p style={{ fontSize: 13, margin: '0 0 8px' }}>{b.whyFits}</p>
                <div className="grid grid-2" style={{ gap: 8 }}>
                  <div>
                    <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Pros</div>
                    <ul className="clean" style={{ fontSize: 12.5 }}>
                      {b.pros.map((x) => (
                        <li key={x}>+ {x}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Contras</div>
                    <ul className="clean" style={{ fontSize: 12.5 }}>
                      {b.cons.map((x) => (
                        <li key={x}>− {x}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <p style={{ fontSize: 12.5, margin: '8px 0 4px' }}>
                  <strong>Tarifas:</strong> {b.feeNotes}
                </p>
                <p style={{ fontSize: 12.5, margin: '0 0 6px' }}>
                  <strong>España:</strong> {b.spainRetailNotes}
                </p>
                <span className="badge warn" style={{ fontSize: 10 }}>{b.demoLabel}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>Asignación propuesta</h3>
          <div
            className="alloc-donut"
            style={{ background: `conic-gradient(${gradients.join(',')})` }}
            title="Asignación estratégica"
          />
          <ul className="clean" style={{ marginTop: 12 }}>
            {plan.allocation.map((a) => (
              <li key={a.key}>
                <span className="dot" style={{ background: a.color }} /> <strong>{a.pct}%</strong> {a.label}
                <div className="muted" style={{ fontSize: 12 }}>{a.rationale}</div>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h3>Vista corto plazo</h3>
          <p style={{ fontSize: 13.5 }}>{plan.nearTermView}</p>
          <h3>Tesis largo plazo</h3>
          <p style={{ fontSize: 13.5 }}>{plan.longTermThesis}</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Productos del plan</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Nombre</th>
              <th>%</th>
              <th>€/mes</th>
              <th>Liquidez</th>
              <th>Por qué encaja</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {plan.products.map((p) => (
              <tr key={p.ticker}>
                <td><strong>{p.ticker}</strong></td>
                <td>{p.name}</td>
                <td>{p.pctOfContribution ?? p.suggestedPct}%</td>
                <td>{fmtEur(p.eurosThisMonth ?? 0)} €</td>
                <td>{p.liquidity}</td>
                <td style={{ fontSize: 12.5 }}>{p.why}<br /><span className="muted">{p.minCapitalHint}</span></td>
                <td><span className="badge accent" style={{ fontSize: 10 }}>{p.demoLabel}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>Rebalanceo</h3>
          <ul className="clean">{plan.rebalancing.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
        <div className="card risks-box">
          <h3>Checklist de riesgo</h3>
          <ul className="clean">{plan.riskChecklist.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      </div>

      {plan.disagreements.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2>Disenso entre agentes</h2>
          {plan.disagreements.map((d) => (
            <div key={d.topic} style={{ marginBottom: 10 }}>
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

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Notas del comité</h2>
        <div className="grid grid-2">
          {plan.agentNotes.map((n, i) => (
            <div key={`${n.agentId}-${i}`} style={{ padding: 8, borderBottom: '1px solid var(--border-soft)' }}>
              <strong>{n.agentName}</strong>
              <p style={{ fontSize: 13 }}>{n.summary}</p>
              {n.facts.length > 0 && (
                <div className="facts"><ul className="clean">{n.facts.map((f) => <li key={f}>{f}</li>)}</ul></div>
              )}
              {n.judgments.length > 0 && (
                <div className="judgments"><ul className="clean">{n.judgments.map((f) => <li key={f}>{f}</li>)}</ul></div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Brief ejecutivo (imprimible)</h2>
        <pre className="brief-pre">{plan.executiveBrief}</pre>
        <p className="footer-note">{plan.disclaimer || DISCLAIMER}</p>
      </div>
    </div>
  )
}
