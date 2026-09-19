import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type {
  AppSettings,
  AuthSessionInfo,
  Holding,
  ICSession,
  ResearchBrief,
  StrategyPlan,
  ToastMessage,
  WatchItem,
} from '../types'
import { loadState, saveKey } from '../lib/storage'
import { authLogout } from '../lib/auth'

interface Ctx {
  ready: boolean
  settings: AppSettings
  watchlist: WatchItem[]
  briefs: ResearchBrief[]
  portfolio: Holding[]
  icSessions: ICSession[]
  strategies: StrategyPlan[]
  toasts: ToastMessage[]
  authSession: AuthSessionInfo
  setSettings: (s: AppSettings) => Promise<void>
  setWatchlist: (w: WatchItem[]) => Promise<void>
  addBrief: (b: ResearchBrief) => Promise<void>
  setPortfolio: (p: Holding[]) => Promise<void>
  addICSession: (s: ICSession) => Promise<void>
  addStrategy: (s: StrategyPlan) => Promise<void>
  acceptDisclaimer: () => Promise<void>
  logout: () => Promise<void>
  toast: (type: ToastMessage['type'], text: string) => void
  dismissToast: (id: string) => void
}

const AppCtx = createContext<Ctx | null>(null)

export function AppStateProvider({
  children,
  authSession,
  onLogout,
}: {
  children: React.ReactNode
  authSession: AuthSessionInfo
  onLogout: () => void
}) {
  const [ready, setReady] = useState(false)
  const [settings, setSettingsState] = useState<AppSettings | null>(null)
  const [watchlist, setWatchlistState] = useState<WatchItem[]>([])
  const [briefs, setBriefsState] = useState<ResearchBrief[]>([])
  const [portfolio, setPortfolioState] = useState<Holding[]>([])
  const [icSessions, setICState] = useState<ICSession[]>([])
  const [strategies, setStratState] = useState<StrategyPlan[]>([])
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => {
    loadState().then((s) => {
      setSettingsState(s.settings)
      setWatchlistState(s.watchlist)
      setBriefsState(s.briefs)
      setPortfolioState(s.portfolio)
      setICState(s.icSessions ?? [])
      setStratState(s.strategies ?? [])
      setReady(true)
    })
  }, [])

  const toast = useCallback((type: ToastMessage['type'], text: string) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setToasts((prev) => [...prev, { id, type, text }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const setSettings = useCallback(async (s: AppSettings) => {
    setSettingsState(s)
    await saveKey('settings', s)
  }, [])

  const setWatchlist = useCallback(async (w: WatchItem[]) => {
    setWatchlistState(w)
    await saveKey('watchlist', w)
  }, [])

  const addBrief = useCallback(async (b: ResearchBrief) => {
    setBriefsState((prev) => {
      const next = [b, ...prev].slice(0, 40)
      void saveKey('briefs', next)
      return next
    })
  }, [])

  const setPortfolio = useCallback(async (p: Holding[]) => {
    setPortfolioState(p)
    await saveKey('portfolio', p)
  }, [])

  const addICSession = useCallback(async (s: ICSession) => {
    setICState((prev) => {
      const next = [s, ...prev].slice(0, 30)
      void saveKey('icSessions', next)
      return next
    })
  }, [])

  const addStrategy = useCallback(async (s: StrategyPlan) => {
    setStratState((prev) => {
      const next = [s, ...prev].slice(0, 30)
      void saveKey('strategies', next)
      return next
    })
  }, [])

  const acceptDisclaimer = useCallback(async () => {
    if (!settings) return
    await setSettings({ ...settings, disclaimerAccepted: true })
  }, [settings, setSettings])

  const logout = useCallback(async () => {
    await authLogout()
    onLogout()
  }, [onLogout])

  const value = useMemo<Ctx | null>(() => {
    if (!settings) return null
    return {
      ready,
      settings,
      watchlist,
      briefs,
      portfolio,
      icSessions,
      strategies,
      toasts,
      authSession,
      setSettings,
      setWatchlist,
      addBrief,
      setPortfolio,
      addICSession,
      addStrategy,
      acceptDisclaimer,
      logout,
      toast,
      dismissToast,
    }
  }, [
    ready, settings, watchlist, briefs, portfolio, icSessions, strategies, toasts, authSession,
    setSettings, setWatchlist, addBrief, setPortfolio, addICSession, addStrategy,
    acceptDisclaimer, logout, toast, dismissToast,
  ])

  if (!value) {
    return (
      <div className="splash">
        <div className="splash-mark">FI</div>
        <div className="splash-title">Foro Inversor</div>
        <div className="splash-sub">Cargando escritorio multi-agente…</div>
      </div>
    )
  }

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export function useAppState() {
  const ctx = useContext(AppCtx)
  if (!ctx) throw new Error('useAppState fuera de provider')
  return ctx
}
