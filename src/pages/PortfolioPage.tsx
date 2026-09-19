import { useState } from 'react'
import { useAppState } from '../hooks/useAppState'
import type { Holding } from '../types'

export function PortfolioPage() {
  const { portfolio, setPortfolio } = useAppState()
  const [ticker, setTicker] = useState('')
  const [name, setName] = useState('')
  const [shares, setShares] = useState('10')
  const [avgCost, setAvgCost] = useState('100')
  const [currency, setCurrency] = useState('EUR')

  async function add() {
    if (!ticker.trim()) return
    const h: Holding = {
      ticker: ticker.trim().toUpperCase(),
      name: name || ticker.toUpperCase(),
      shares: Number(shares) || 0,
      avgCost: Number(avgCost) || 0,
      currency,
    }
    await setPortfolio([...portfolio, h])
    setTicker(''); setName('')
  }

  async function remove(i: number) {
    await setPortfolio(portfolio.filter((_, idx) => idx !== i))
  }

  return (
    <div>
      <h1 className="page-title">Cartera sandbox</h1>
      <p className="page-sub">
        Simulación local de posiciones · <span className="badge demo">ejemplo / demostración</span> · no conectada a brókers
      </p>

      <div className="disclaimer-banner">
        Notas de riesgo educativas: revise concentración, divisa y solapamiento con ETFs globales.
        No es una propuesta de inversión.
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Posiciones</h2>
          <table className="table">
            <thead>
              <tr><th>Ticker</th><th>Nombre</th><th>Títulos</th><th>Precio medio</th><th></th></tr>
            </thead>
            <tbody>
              {portfolio.map((h, i) => (
                <tr key={`${h.ticker}-${i}`}>
                  <td><strong>{h.ticker}</strong></td>
                  <td>{h.name}</td>
                  <td>{h.shares}</td>
                  <td>{h.avgCost.toFixed(2)} {h.currency}</td>
                  <td><button className="btn btn-ghost btn-danger" onClick={() => void remove(i)}>Quitar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Añadir posición (sandbox)</h2>
          <div className="field"><label>Ticker</label><input value={ticker} onChange={(e) => setTicker(e.target.value)} /></div>
          <div className="field"><label>Nombre</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="row">
            <div className="field" style={{ flex: 1 }}><label>Títulos</label><input value={shares} onChange={(e) => setShares(e.target.value)} /></div>
            <div className="field" style={{ flex: 1 }}><label>Precio medio</label><input value={avgCost} onChange={(e) => setAvgCost(e.target.value)} /></div>
            <div className="field" style={{ width: 100 }}><label>Divisa</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option>EUR</option><option>USD</option><option>GBP</option>
              </select>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => void add()}>Añadir</button>

          <h3 style={{ marginTop: 22 }}>Notas de riesgo (demo)</h3>
          <ul className="clean" style={{ fontSize: 13.5 }}>
            <li>Posible <strong>home bias</strong> si ITX + índices españoles coinciden.</li>
            <li>AAPL + VWCE → overlap tech EE. UU. (concentración oculta).</li>
            <li>Sin sleeve de renta fija: mayor sensibilidad a drawdowns de RV.</li>
            <li>Divisa USD en AAPL para inversor EUR = riesgo FX adicional.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
