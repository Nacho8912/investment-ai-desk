import type { AppSettings, Holding, ICSession, PersistedState, ResearchBrief, StrategyPlan, WatchItem } from '../types'

const LS_KEY = 'foro-inversor-state'

const defaults: PersistedState = {
  settings: {
    mockMode: false,
    apiKey: '',
    apiBaseUrl: 'https://openrouter.ai/api/v1',
    model: 'z-ai/glm-5.3-flashx',
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
  icSessions: [],
  strategies: [],
}

function hasElectron(): boolean {
  return typeof window !== 'undefined' && !!window.foroAPI
}

export async function loadState(): Promise<PersistedState> {
  if (hasElectron()) {
    const all = await window.foroAPI.getAll()
    return {
      settings: { ...defaults.settings, ...(all.settings as AppSettings) },
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
    return { ...structuredClone(defaults), ...JSON.parse(raw) }
  } catch {
    return structuredClone(defaults)
  }
}

export async function saveKey<K extends keyof PersistedState>(key: K, value: PersistedState[K]) {
  if (hasElectron()) {
    await window.foroAPI.set(key, value)
    return
  }
  const cur = await loadState()
  cur[key] = value
  localStorage.setItem(LS_KEY, JSON.stringify(cur))
}
