import { useCallback, useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppStateProvider } from './hooks/useAppState'
import { Layout } from './components/Layout'
import { AuthScreen } from './components/AuthScreen'
import { HomePage } from './pages/HomePage'
import { ResearchPage } from './pages/ResearchPage'
import { MesaPage } from './pages/MesaPage'
import { AgentsPage } from './pages/AgentsPage'
import { PortfolioPage } from './pages/PortfolioPage'
import { SettingsPage } from './pages/SettingsPage'
import { MethodologyPage } from './pages/MethodologyPage'
import { StrategyPage } from './pages/StrategyPage'
import { authGetSession } from './lib/auth'
import type { AuthSessionInfo } from './types'

function AuthenticatedApp({
  session,
  onLogout,
}: {
  session: AuthSessionInfo
  onLogout: () => void
}) {
  return (
    <AppStateProvider authSession={session} onLogout={onLogout}>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="estrategia" element={<StrategyPage />} />
            <Route path="investigacion" element={<ResearchPage />} />
            <Route path="mesa" element={<MesaPage />} />
            <Route path="agentes" element={<AgentsPage />} />
            <Route path="cartera" element={<PortfolioPage />} />
            <Route path="metodologia" element={<MethodologyPage />} />
            <Route path="ajustes" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppStateProvider>
  )
}

function AuthGate() {
  const [checking, setChecking] = useState(true)
  const [session, setSession] = useState<AuthSessionInfo | null>(null)

  useEffect(() => {
    void authGetSession().then((s) => {
      setSession(s)
      setChecking(false)
    })
  }, [])

  const onAuthenticated = useCallback((s: AuthSessionInfo) => {
    setSession(s)
  }, [])

  const onLogout = useCallback(() => {
    setSession(null)
  }, [])

  if (checking) {
    return (
      <div className="splash">
        <div className="splash-mark">FI</div>
        <div className="splash-title">Foro Inversor</div>
        <div className="splash-sub">Comprobando sesión…</div>
      </div>
    )
  }

  if (!session) {
    return <AuthScreen onAuthenticated={onAuthenticated} />
  }

  return <AuthenticatedApp session={session} onLogout={onLogout} />
}

export default function App() {
  return <AuthGate />
}
