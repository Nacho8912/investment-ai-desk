import type { AppSettings, Holding, ICSession, PersistedState, ResearchBrief, StrategyPlan, WatchItem } from '../types'

const LS_KEY = 'foro-inversor-state'
const defaults: PersistedState = {
  settings: {
    mockMode: true,
    apiKey: '',
    hasApiKey: false,
    apiBaseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
    disclaimerAccepted: false,
  },
  watchlist: [
    { ticker: 'AAPL', name: 'Apple Inc.', note: 'Watchlist' },
    { ticker: 'VWCE', name: 'Vanguard FTSE All-World UCITS ETF', note: 'Watchlist' },
    { ticker: 'ITX', name: 'Inditex', note: 'IBEX' },
    { ticker: 'SAN', name: 'Banco Santander', note: 'IBEX' },
  ],
  briefs: [],
  portfolio: [
    { ticker: 'VWCE', name: 'Vanguard FTSE All-World', shares: 120, avgCost: 98.5, currency: 'EUR' },
    { ticker: 'AAPL', name: 'Apple Inc.', shares: 15, avgCost: 175.2, currency: 'USD' },
    { ticker: 'ITX', name: 'Inditex', shares: 40, avgCost: 38.1, currency: 'EUR' },
  ],
  icSessions: [], strategies: [],
}
function hasElectron(): boolean {
  return typeof window !== 'undefined' && !!window.foroAPI
}
function redact(settings: AppSettings): AppSettings {
  return { ...settings, apiKey: '', hasApiKey: hasElectron() ? !!settings.hasApiKey : false }
}
export async function loadState(): Promise<PersistedState> {
  if (hasElectron()) {
    const all = await window.foroAPI.getAll()
    return {
      settings: redact({ ...defaults.settings, ...(all.settings as AppSettings) }),
      watchlist: (all.watchlist as WatchItem[]) ?? defaults.watchlist,
      briefs: (all.briefs as ResearchBrief[]) ?? [],
      portfolio: (all.portfolio as Holding[]) ?? defaults.portfolio,
      icSessions: (all.icSessions as ICSession[]) ?? [],
      strategies: (all.strategies as StrategyPlan[]) ?? [],
    }
  }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return structuredClone(defaults)
    const old = JSON.parse(raw) as PersistedState
    const next: PersistedState = {
      ...structuredClone(defaults), ...old,
      settings: { ...defaults.settings, ...(old.settings || {}), apiKey: '', hasApiKey: false, mockMode: true },
    }
    // Browser preview is offline-only. Remove any credential saved by an older version.
    localStorage.setItem(LS_KEY, JSON.stringify(next))
    return next
  } catch {
    return structuredClone(defaults)
  }
}
/** Returns the sanitized settings when key === 'settings'; other data setters return undefined. */
export async function saveKey<K extends keyof PersistedState>(key: K, value: PersistedState[K]): Promise<AppSettings | void> {
  if (key === 'settings') {
    const settings = value as AppSettings
    if (hasElectron()) {
      const { apiKey, ...rest } = settings
      return window.foroAPI.updateSettings({ ...rest, apiKey: '' }, apiKey.trim() || undefined)
    }
    if (settings.apiKey.trim()) throw new Error('Las credenciales solo se pueden configurar en la aplicación Electron')
    const cur = await loadState()
    cur.settings = { ...settings, apiKey: '', hasApiKey: false, mockMode: true }
    localStorage.setItem(LS_KEY, JSON.stringify(cur))
    return cur.settings
  }
  if (hasElectron()) {
    await window.foroAPI.setData(key, value)
    return
  }
  const cur = await loadState()
  cur[key] = value
  localStorage.setItem(LS_KEY, JSON.stringify(cur))
}
