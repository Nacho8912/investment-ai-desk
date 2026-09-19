import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppState } from '../hooks/useAppState'
import { StanceBadge } from '../components/StanceBadge'
import {
  INDEX_DISPLAY, changeClass, formatAsOfTime, formatChangePct,
  formatPrice, getQuotes, toYahooSymbol, type MarketQuote,
} from '../lib/market'

export function HomePage() {
  const { watchlist, briefs, icSessions, strategies, settings } = useAppState()
  const live = !settings.mockMode && Boolean(settings.hasApiKey)
  const [quotesBySymbol, setQuotesBySymbol] = useState<Record<string, MarketQuote>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const lastOkRef = useRef<Record<string, MarketQuote>>({})
  const watchYahoo = useMemo(() => watchlist.map((w) => toYahooSymbol(w.ticker)), [watchlist])
  const allSymbols = useMemo(() => [...new Set([...INDEX_DISPLAY.map((i) => i.yahoo), ...watchYahoo])], [watchYahoo])
  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setRefreshing(true)
    try {
      const results = await getQuotes(allSymbols)
      const failures = results.filter((r) => !r.ok)
      if (results.some((r) => r.ok)) {
        const merged = { ...lastOkRef.current }
        for (const q of results) if (q.ok) merged[q.symbol] = q
        lastOkRef.current = merged
        setQuotesBySymbol(merged)
        setUpdatedAt(new Date())
        setError(failures.length
          ? `Algunos símbolos fallaron (${failures.map((f) => f.symbol).join(', ')}). Se muestran los últimos datos válidos.`
          : null)
      } else {
        setQuotesBySymbol({ ...lastOkRef.current })
        setError(failures[0]?.error || 'No se pudieron obtener cotizaciones. Reintente más tarde.')
      }
    } catch (e) {
      setQuotesBySymbol({ ...lastOkRef.current })
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [allSymbols])
  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => void refresh({ silent: true }), 60_000)
    return () => window.clearInterval(id)
  }, [refresh])
  const anyMarketOk = Object.values(quotesBySymbol).some((q) => q.ok)
  return (
    <div>
      <div className="row">
        <div>
          <h1 className="page-title">Panel de control</h1>
          <p className="page-sub">Investigación multi-agente y mesa institucional ·{' '}
            {live ? <span className="badge accent">OpenRouter activo (LIVE)</span>
              : <span className="badge demo">sin API activa · reglas locales</span>}
          </p>
        </div>
        <div className="spacer" />
        <Link className="btn btn-primary" to="/estrategia">Estrategia a medida</Link>
        <Link className="btn" to="/mesa">Mesa institucional</Link>
        <Link className="btn" to="/investigacion">Investigación</Link>
      </div>
      {live && <div className="disclaimer-banner" style={{ marginBottom: 16 }}>
        <strong>IA en vivo:</strong> estrategias, mesa e investigación usan el proveedor configurado.
        Las cotizaciones provienen de Yahoo Finance y pueden ir con retraso.
      </div>}
      <div className="grid grid-3">
        <div className="card">
          <div className="row" style={{ marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Resumen de mercado</h3>
            <div className="spacer" />
            <button type="button" className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}
              disabled={refreshing} onClick={() => void refresh()}>
              {refreshing ? 'Actualizando…' : 'Actualizar'}
            </button>
          </div>
          <p className="muted" style={{ fontSize: 13 }}>Cotizaciones Yahoo Finance (posible retraso de mercado)</p>
          {loading && !anyMarketOk ? <p className="muted">Cargando cotizaciones…</p> : (
            <table className="table"><tbody>
              {INDEX_DISPLAY.map((idx) => {
                const q = quotesBySymbol[idx.yahoo]
                const ok = q?.ok && q.price != null
                return <tr key={idx.yahoo}>
                  <td>{idx.name}</td>
                  <td style={{ textAlign: 'right' }}>
                    {ok ? <><span>{formatPrice(q.price, q.currency)}</span>{' '}
                      <span className={changeClass(q.changePct)}>{formatChangePct(q.changePct)}</span></>
                      : <span className="muted">—</span>}
                  </td>
                </tr>
              })}
            </tbody></table>
          )}
          {error && <p className="footer-note" style={{ color: 'var(--bad)' }}>
            {error}{' '}
            <button type="button" className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }}
              onClick={() => void refresh()}>Reintentar</button>
          </p>}
          <p className="footer-note">Mercado: {updatedAt ? `actualizado ${formatAsOfTime(null, updatedAt)}` : 'sin datos aún'}
            {' · '}fuente Yahoo Finance (no es feed instantáneo tipo Bloomberg)</p>
        </div>
        <div className="card">
          <h3>Watchlist</h3>
          <table className="table">
            <thead><tr><th>Ticker</th><th>Precio</th><th>Var.</th></tr></thead>
            <tbody>{watchlist.map((w) => {
              const q = quotesBySymbol[toYahooSymbol(w.ticker)]
              const ok = q?.ok && q.price != null
              return <tr key={w.ticker}>
                <td><strong>{w.ticker}</strong><div className="muted" style={{ fontSize: 11 }}>{w.name}</div></td>
                <td>{ok ? formatPrice(q.price, q.currency) : loading ? <span className="muted">…</span> : <span className="muted">—</span>}</td>
                <td>{ok ? <span className={changeClass(q.changePct)}>{formatChangePct(q.changePct)}</span>
                  : anyMarketOk ? <span className="badge warn">sin dato</span>
                    : w.note && !anyMarketOk ? <span className="badge">{w.note.replace(/demo/gi, 'watchlist')}</span> : null}</td>
              </tr>
            })}</tbody>
          </table>
          {anyMarketOk && <p className="footer-note">Cotización en vivo / retraso de mercado (Yahoo).
            Tickers EU: VWCE→VWCE.DE, ITX→ITX.MC, SAN→SAN.MC.</p>}
        </div>
        <div className="card">
          <h3>Estado del sistema</h3>
          <p><span className={`badge ${live ? 'accent' : 'demo'}`}>{live ? 'OpenRouter LIVE' : 'Sin API activa (local)'}</span>{' '}
            <span className={`badge ${anyMarketOk ? 'good' : 'warn'}`}>
              {anyMarketOk ? 'Mercado Yahoo' : 'Mercado sin datos'}</span></p>
          <ul className="clean muted" style={{ fontSize: 13 }}>
            <li>32 agentes en plantilla (incl. CIO)</li>
            <li>Flujo: recopilar → analizar → debatir → sintetizar → riesgo → brief</li>
            <li>Mesa IC: apertura → ronda → red team → voto → acta</li>
            <li>Estrategia mensual + comparativa de brokers</li>
            <li>Estrategias guardadas: {strategies.length}</li>
          </ul>
          <Link to="/metodologia">Ver metodología →</Link>
        </div>
      </div>
      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Briefs recientes</h3>
          {briefs.length === 0 ? <p className="muted">Aún no hay briefs. Lance una investigación sobre AAPL, VWCE o ITX.</p>
            : <table className="table"><thead><tr><th>Ticker</th><th>Postura</th><th>Fecha</th></tr></thead>
              <tbody>{briefs.slice(0, 6).map((b) => <tr key={b.id}>
                <td><strong>{b.ticker}</strong>{' '}<span className="badge">{b.mode === 'live' ? 'live' : b.mode}</span></td>
                <td><StanceBadge stance={b.synthesis.finalStance} /></td>
                <td className="muted">{new Date(b.createdAt).toLocaleString('es-ES')}</td>
              </tr>)}</tbody></table>}
        </div>
        <div className="card">
          <h3>Actas de mesa recientes</h3>
          {icSessions.length === 0 ? <p className="muted">Sin sesiones IC todavía. Pruebe la mesa con AAPL o VWCE.</p>
            : <table className="table"><thead><tr><th>Ticker</th><th>Recomendación</th><th>Fecha</th></tr></thead>
              <tbody>{icSessions.slice(0, 6).map((s) => <tr key={s.id}>
                <td><strong>{s.ticker}</strong></td><td><StanceBadge stance={s.recommendation} /></td>
                <td className="muted">{new Date(s.createdAt).toLocaleString('es-ES')}</td>
              </tr>)}</tbody></table>}
        </div>
      </div>
    </div>
  )
}
