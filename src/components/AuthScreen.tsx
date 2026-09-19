import { useEffect, useState, type FormEvent } from 'react'
import { authHasUsers, authLogin, authRegister } from '../lib/auth'
import type { AuthSessionInfo } from '../types'

type Mode = 'login' | 'register'

export function AuthScreen({ onAuthenticated }: { onAuthenticated: (s: AuthSessionInfo) => void }) {
  const [mode, setMode] = useState<Mode>('login')
  const [hasUsers, setHasUsers] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void authHasUsers().then((h) => {
      setHasUsers(h)
      setMode(h ? 'login' : 'register')
    })
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'register') {
        if (password !== confirm) {
          setError('Las contraseñas no coinciden.')
          return
        }
        const res = await authRegister(username, password)
        if (!res.ok || !res.session) {
          setError(res.error || 'No se pudo crear la cuenta.')
          return
        }
        onAuthenticated(res.session)
      } else {
        const res = await authLogin(username, password, remember)
        if (!res.ok || !res.session) {
          setError(res.error || 'No se pudo iniciar sesión.')
          return
        }
        onAuthenticated(res.session)
      }
    } catch (err) {
      setError((err as Error).message || 'Error de autenticación.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card card">
        <div className="auth-brand">
          <div className="brand-mark">FI</div>
          <div>
            <h1>Foro Inversor</h1>
            <p className="muted">Acceso local · este equipo</p>
          </div>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab${mode === 'login' ? ' active' : ''}`}
            onClick={() => { setMode('login'); setError(null) }}
            disabled={!hasUsers && mode === 'register'}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            className={`auth-tab${mode === 'register' ? ' active' : ''}`}
            onClick={() => { setMode('register'); setError(null) }}
          >
            Crear cuenta
          </button>
        </div>

        {!hasUsers && mode === 'register' && (
          <p className="muted" style={{ fontSize: 13 }}>
            Primera vez: cree un usuario local. Las contraseñas se guardan con hash (nunca en texto claro).
          </p>
        )}

        <form onSubmit={(e) => void submit(e)}>
          <div className="field">
            <label>Usuario / email</label>
            <input
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="nombre o correo"
              required
              minLength={3}
            />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input
              type="password"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="mínimo 8 caracteres"
              required
              minLength={8}
            />
          </div>
          {mode === 'register' && (
            <div className="field">
              <label>Confirmar contraseña</label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
              />
            </div>
          )}
          {mode === 'login' && (
            <label className="chk" style={{ marginBottom: 12, display: 'flex' }}>
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />{' '}
              Mantener sesión en este equipo
            </label>
          )}
          {error && <div className="auth-error">{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%' }}>
            {busy
              ? 'Espere…'
              : mode === 'register'
                ? 'Crear cuenta y entrar'
                : 'Iniciar sesión'}
          </button>
        </form>

        <p className="muted" style={{ fontSize: 11.5, marginTop: 16, lineHeight: 1.45 }}>
          Autenticación local multi-usuario (Electron / almacén del PC). Sin nube en v1.
          Protege el acceso en este equipo o distribución — no sustituye cifrado de disco completo.
        </p>
      </div>
    </div>
  )
}
