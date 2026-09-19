import { useState } from 'react'
import { useAppState } from '../hooks/useAppState'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'
const DEFAULT_MODEL = 'z-ai/glm-5.3-flashx'

export function SettingsPage() {
  const { settings, setSettings, toast, authSession, logout } = useAppState()
  const [local, setLocal] = useState({ ...settings, apiKey: '' })
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    setSaved(false)
    try {
      const enteredKey = local.apiKey.trim()
      const next = { ...local, mockMode: enteredKey ? false : local.mockMode }
      await setSettings(next)
      // The user's new key is never kept in shared app state or the settings input after saving.
      setLocal({ ...next, apiKey: '', hasApiKey: Boolean(enteredKey || settings.hasApiKey) })
      setSaved(true)
      toast('success', enteredKey || settings.hasApiKey
        ? 'Ajustes guardados. Clave almacenada por el proceso principal.'
        : 'Ajustes guardados. Sin clave de API.')
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'No se pudieron guardar los ajustes.')
    } finally {
      setBusy(false)
    }
  }
  async function clearKey() {
    if (!window.foroAPI?.clearApiKey) {
      toast('error', 'Esta operación requiere la aplicación de escritorio.')
      return
    }
    setBusy(true)
    try {
      await window.foroAPI.clearApiKey()
      await setSettings({ ...local, apiKey: '', hasApiKey: false, mockMode: true })
      setLocal({ ...local, apiKey: '', hasApiKey: false, mockMode: true })
      toast('success', 'Credencial eliminada del almacén de la aplicación.')
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'No se pudo eliminar la credencial.')
    } finally {
      setBusy(false)
    }
  }
  async function reshownDisclaimer() {
    const next = { ...local, apiKey: '', disclaimerAccepted: false }
    try {
      await setSettings(next)
      setLocal(next)
      toast('info', 'El aviso legal se mostrará de nuevo.')
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'No se pudo guardar el aviso.')
    }
  }
  function applyOpenRouterPreset() {
    setLocal((prev) => ({ ...prev, apiBaseUrl: OPENROUTER_BASE, model: DEFAULT_MODEL }))
    toast('info', 'Preset OpenRouter aplicado; pulse Guardar ajustes para confirmarlo.')
  }
  async function onLogout() {
    await logout()
    toast('info', 'Sesión cerrada.')
  }
  return (
    <div>
      <h1 className="page-title">Ajustes</h1>
      <p className="page-sub">Proveedor LLM: <strong>OpenRouter</strong> · llamadas gestionadas por Electron</p>
      <div className="card" style={{ maxWidth: 720, marginBottom: 16 }}>
        <h2>Cuenta local</h2>
        <p style={{ fontSize: 13.5, marginTop: 0 }}>
          Sesión iniciada como <strong>{authSession.username}</strong>
          {authSession.remember ? ' (sesión persistente en este equipo)' : ''}.
        </p>
        <p className="muted" style={{ fontSize: 12.5 }}>
          Usuarios y contraseñas se guardan localmente. Sin backend en la nube.
        </p>
        <button className="btn" type="button" onClick={() => void onLogout()}>Cerrar sesión</button>
      </div>
      <div className="card" style={{ maxWidth: 720 }}>
        <div className="field">
          <label>
            <input type="checkbox" checked={local.mockMode}
              onChange={(e) => setLocal({ ...local, mockMode: e.target.checked })}
              style={{ marginRight: 8 }} />
            Forzar modo demostración (sin llamadas a la API de IA)
          </label>
        </div>
        <div className="row" style={{ marginBottom: 12 }}>
          <span className="badge accent">Proveedor: OpenRouter</span>
          <button type="button" className="btn btn-ghost" onClick={applyOpenRouterPreset}>
            Restaurar preset OpenRouter
          </button>
        </div>
        <div className="field">
          <label>API key (OpenRouter) — {settings.hasApiKey ? 'configurada; deje el campo vacío para conservarla' : 'no configurada'}</label>
          <input type="password" value={local.apiKey}
            onChange={(e) => setLocal({ ...local, apiKey: e.target.value })}
            placeholder={settings.hasApiKey ? 'Dejar vacío para mantener la clave' : 'Pegue aquí una clave nueva'}
            disabled={!window.foroAPI?.updateSettings || busy} autoComplete="off" spellCheck={false} />
          {settings.hasApiKey && (
            <button type="button" className="btn btn-ghost" disabled={busy}
              onClick={() => void clearKey()}>Eliminar clave guardada</button>
          )}
          {!window.foroAPI?.updateSettings && <p className="muted">La vista web es solo demostración: configure la clave desde Electron.</p>}
        </div>
        <div className="field">
          <label>Base URL (OpenAI-compatible /v1; HTTPS)</label>
          <input value={local.apiBaseUrl}
            onChange={(e) => setLocal({ ...local, apiBaseUrl: e.target.value })}
            placeholder={OPENROUTER_BASE} />
        </div>
        <div className="field">
          <label>Modelo (ej. z-ai/glm-5.3-flashx)</label>
          <input value={local.model}
            onChange={(e) => setLocal({ ...local, model: e.target.value })}
            placeholder={DEFAULT_MODEL} />
        </div>
        <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
          En modo live, Electron envía las solicitudes al proveedor por HTTPS. La interfaz solo recibe
          el resultado y un indicador de si hay clave; nunca recupera la credencial guardada.
          Si la llamada falla, se muestra una simulación identificada como tal.
        </p>
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn btn-primary" disabled={busy} onClick={() => void save()}>
            {busy ? 'Guardando…' : saved ? 'Guardado' : 'Guardar ajustes'}
          </button>
          <button className="btn" disabled={busy} onClick={() => void reshownDisclaimer()}>
            Volver a mostrar aviso legal
          </button>
        </div>
      </div>
    </div>
  )
}
