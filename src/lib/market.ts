/** Cotizaciones vía Yahoo Finance (proceso principal Electron). Pueden ir con retraso. */

export interface MarketQuote {
  symbol: string
  price: number | null
  changePct: number | null
  currency: string | null
  asOf: string | null
  marketState: string | null
  ok: boolean
  error?: string
}

/** Nombre / ticker de UI → símbolo Yahoo Finance */
export const YAHOO_SYMBOL_MAP: Record<string, string> = {
  // Índices
  'S&P 500': '^GSPC',
  SPX: '^GSPC',
  '^GSPC': '^GSPC',
  'Euro Stoxx 50': '^STOXX50E',
  SX5E: '^STOXX50E',
  '^STOXX50E': '^STOXX50E',
  'IBEX 35': '^IBEX',
  IBEX: '^IBEX',
  '^IBEX': '^IBEX',
  VIX: '^VIX',
  '^VIX': '^VIX',
  // Watchlist / cartera
  AAPL: 'AAPL',
  VWCE: 'VWCE.DE',
  'VWCE.DE': 'VWCE.DE',
  'VWCE.AS': 'VWCE.AS',
  ITX: 'ITX.MC',
  'ITX.MC': 'ITX.MC',
  SAN: 'SAN.MC',
  'SAN.MC': 'SAN.MC',
}

export const INDEX_DISPLAY: { name: string; yahoo: string }[] = [
  { name: 'S&P 500', yahoo: '^GSPC' },
  { name: 'Euro Stoxx 50', yahoo: '^STOXX50E' },
  { name: 'IBEX 35', yahoo: '^IBEX' },
  { name: 'VIX', yahoo: '^VIX' },
]

export function toYahooSymbol(displayOrTicker: string): string {
  const key = displayOrTicker.trim()
  if (YAHOO_SYMBOL_MAP[key]) return YAHOO_SYMBOL_MAP[key]
  const upper = key.toUpperCase()
  if (YAHOO_SYMBOL_MAP[upper]) return YAHOO_SYMBOL_MAP[upper]
  return key
}

export function hasMarketApi(): boolean {
  return typeof window !== 'undefined' && typeof window.foroAPI?.getQuotes === 'function'
}

export async function getQuotes(symbols: string[]): Promise<MarketQuote[]> {
  if (!hasMarketApi()) {
    return symbols.map((symbol) => ({
      symbol,
      price: null,
      changePct: null,
      currency: null,
      asOf: null,
      marketState: null,
      ok: false,
      error: 'Cotizaciones solo disponibles en la app de escritorio (Electron).',
    }))
  }
  const yahoo = [...new Set(symbols.map(toYahooSymbol))]
  const results = (await window.foroAPI.getQuotes(yahoo)) as MarketQuote[]
  return results
}

export function formatPrice(price: number | null, currency: string | null): string {
  if (price == null || Number.isNaN(price)) return '—'
  const cur = currency || ''
  try {
    if (cur) {
      return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: cur,
        maximumFractionDigits: price >= 1000 ? 2 : 4,
      }).format(price)
    }
  } catch {
    /* currency desconocida */
  }
  return (
    new Intl.NumberFormat('es-ES', {
      maximumFractionDigits: price >= 1000 ? 2 : 4,
    }).format(price) + (cur ? ` ${cur}` : '')
  )
}

export function formatChangePct(changePct: number | null): string {
  if (changePct == null || Number.isNaN(changePct)) return '—'
  const sign = changePct > 0 ? '+' : changePct < 0 ? '−' : ''
  const abs = Math.abs(changePct)
  return `${sign}${abs.toLocaleString('es-ES', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}%`
}

export function changeClass(changePct: number | null): string {
  if (changePct == null || Number.isNaN(changePct) || changePct === 0) return 'muted'
  return changePct > 0 ? 'chg-up' : 'chg-down'
}

export function formatAsOfTime(iso: string | null, fallbackDate?: Date | null): string {
  const d = iso ? new Date(iso) : fallbackDate ?? null
  if (!d || Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}
