import { useState } from 'react'
import { useAppState } from '../hooks/useAppState'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'
const DEFAULT_MODEL = 'z-ai/glm-5.3-flashx'

export function SettingsPage() {
  const { settings, setSettings, toast, authSession, logout } = useAppState()
  const [local, setLocal] = useState(settings)
  const [saved, setSaved] = useState(false)

  async function save() {
    const next = { ...local }
    if (next.apiKey.trim() && local.mockMode && !settings.apiKey) {
      // Primera vez que pegan clave: activar live
      next.mockMode = false
    }
    await setSettings(next)
    setLocal(next)
    setSaved(true)
    toast(
      'success',
      next.apiKey.trim() && !next.mockMode
        ? 'Ajustes guardados — OpenRouter live activo.'
        : 'Ajustes guardados en almacén local.',
    )
    setTimeout(() => setSaved(false), 2000)
  }

  async function reshownDisclaimer() {
    const next = { ...local, disclaimerAccepted: false }
    setLocal(next)
    await setSettings(next)
    toast('info', 'El aviso legal se mostrará de nuevo.')
  }

  function applyOpenRouterPreset() {
    setLocal({
      ...local,
      apiBaseUrl: OPENROUTER_BASE,
      model: DEFAULT_MODEL,
    })
    toast('info', 'Preset OpenRouter aplicado (falta su API key).')
  }

  async function onLogout() {
    await logout()
    toast('info', 'Sesión cerrada.')
  }

  return (
    <div>
      <h1 className="page-title">Ajustes</h1>
      <p className="page-sub">
        Proveedor LLM: <strong>OpenRouter</strong> · con API key se usa live por defecto
      </p>

      <div className="card" style={{ maxWidth: 720, marginBottom: 16 }}>
        <h2>Cuenta local</h2>
        <p style={{ fontSize: 13.5, marginTop: 0 }}>
          Sesión iniciada como <strong>{authSession.username}</strong>
          {authSession.remember ? ' (sesión persistente en este equipo)' : ''}.
        </p>
        <p className="muted" style={{ fontSize: 12.5 }}>
          Usuarios y contraseñas (hash scrypt/PBKDF2) se guardan solo en este PC. Sin backend en la nube.
        </p>
        <button className="btn" type="button" onClick={() => void onLogout()}>
          Cerrar sesión
        </button>
      </div>

      <div className="card" style={{ maxWidth: 720 }}>
        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={local.mockMode}
              onChange={(e) => setLocal({ ...local, mockMode: e.target.checked })}
              style={{ marginRight: 8 }}
            />
            Forzar modo offline (sin llamadas de red; solo si no quiere usar la API)
          </label>
        </div>

        <div className="row" style={{ marginBottom: 12 }}>
          <span className="badge accent">Proveedor: OpenRouter</span>
          <button type="button" className="btn btn-ghost" onClick={applyOpenRouterPreset}>
            Restaurar preset OpenRouter
          </button>
        </div>

        <div className="field">
          <label>API key (OpenRouter) — solo almacén local, no se registra en logs</label>
          <input
            type="password"
            value={local.apiKey}
            onChange={(e) => setLocal({ ...local, apiKey: e.target.value })}
            placeholder="sk-or-… (pegar aquí; nunca en el código)"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="field">
          <label>Base URL (OpenAI-compatible /v1)</label>
          <input
            value={local.apiBaseUrl}
            onChange={(e) => setLocal({ ...local, apiBaseUrl: e.target.value })}
            placeholder={OPENROUTER_BASE}
          />
        </div>
        <div className="field">
          <label>Modelo (ej. z-ai/glm-5.3-flashx, anthropic/claude-3.5-sonnet)</label>
          <input
            value={local.model}
            onChange={(e) => setLocal({ ...local, model: e.target.value })}
            placeholder={DEFAULT_MODEL}
          />
        </div>

        <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
          En modo live, Foro Inversor llama a <code>{'{base}'}/chat/completions</code> con cabeceras
          OpenRouter <code>HTTP-Referer</code> y <code>X-Title: Foro Inversor</code>.
          Guarde una API key válida y deje desmarcado el modo offline. Si la llamada falla, hay fallback a reglas locales (sin conexión API).
        </p>

        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn btn-primary" onClick={() => void save()}>
            {saved ? 'Guardado' : 'Guardar ajustes'}
          </button>
          <button className="btn" onClick={() => void reshownDisclaimer()}>
            Volver a mostrar aviso legal
          </button>
        </div>
      </div>
    </div>
  )
}
