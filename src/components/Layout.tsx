import { NavLink, Outlet } from 'react-router-dom'
import { DisclaimerModal } from './DisclaimerModal'
import { StatusBar } from './StatusBar'
import { Toasts } from './Toasts'
import { useAppState } from '../hooks/useAppState'

const links = [
  { to: '/', label: 'Inicio', icon: '🏠' },
  { to: '/estrategia', label: 'Estrategia a medida', icon: '🧩' },
  { to: '/mesa', label: 'Mesa institucional', icon: '🏛️' },
  { to: '/investigacion', label: 'Investigación', icon: '🔎' },
  { to: '/agentes', label: 'Agentes', icon: '👥' },
  { to: '/cartera', label: 'Cartera sandbox', icon: '💼' },
  { to: '/metodologia', label: 'Metodología', icon: '📘' },
  { to: '/ajustes', label: 'Ajustes', icon: '⚙️' },
]

export function Layout() {
  const { settings, authSession, logout, toast } = useAppState()

  async function onLogout() {
    await logout()
    toast('info', 'Sesión cerrada.')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">FI</div>
          <div>
            <h1>Foro Inversor</h1>
            <p>Desk multi-agente</p>
          </div>
        </div>
        <nav className="side-nav">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <span>{l.icon}</span>
              <span className="label">{l.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="badge demo">{settings.mockMode ? 'Demo' : 'Live'}</div>
          <div className="muted" style={{ fontSize: 11, marginTop: 8 }} title={authSession.username}>
            {authSession.username}
          </div>
          <button type="button" className="btn btn-ghost sidebar-logout" onClick={() => void onLogout()}>
            Cerrar sesión
          </button>
          <div className="muted" style={{ fontSize: 10, marginTop: 6 }}>Terminal · es-ES</div>
        </div>
      </aside>
      <div className="workspace">
        <main className="main">
          <Outlet />
        </main>
        <StatusBar />
      </div>
      <DisclaimerModal />
      <Toasts />
    </div>
  )
}
