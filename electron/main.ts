import { app, BrowserWindow, ipcMain, shell, Menu, safeStorage } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isIP } from 'node:net'
import { createRequire } from 'node:module'
import crypto from 'node:crypto'
import { hardenWindow } from './window-security'

const require = createRequire(import.meta.url)
const Store = require('electron-store') as typeof import('electron-store')
const fs = require('node:fs') as typeof import('node:fs')
const __dirname = path.dirname(fileURLToPath(import.meta.url))
process.env.DIST = path.join(__dirname, '../dist')
interface AuthUserRecord { id: string; username: string; salt: string; hash: string; createdAt: string }
interface AuthSessionRecord { userId: string; username: string; remember: boolean; loggedInAt: string }
interface PublicSettings {
  mockMode: boolean
  apiKey: string // Always empty in renderer; retained for legacy TypeScript compatibility.
  hasApiKey: boolean
  apiBaseUrl: string
  model: string
  disclaimerAccepted: boolean
}
const defaultSettings = {
  mockMode: true, apiKey: '', apiBaseUrl: 'https://openrouter.ai/api/v1',
  model: 'openai/gpt-4o-mini', disclaimerAccepted: false,
}
const store = new Store({
  name: 'foro-inversor',
  defaults: {
    settings: defaultSettings,
    llmApiCredential: '',
    llmLegacyApiKey: '',
    watchlist: [
      { ticker: 'AAPL', name: 'Apple Inc.', note: 'Ejemplo demo' },
      { ticker: 'VWCE', name: 'Vanguard FTSE All-World UCITS ETF', note: 'Ejemplo demo' },
      { ticker: 'ITX', name: 'Inditex', note: 'Ejemplo IBEX — demo' },
      { ticker: 'SAN', name: 'Banco Santander', note: 'Ejemplo IBEX — demo' },
    ],
    briefs: [], icSessions: [], strategies: [],
    portfolio: [
      { ticker: 'VWCE', name: 'Vanguard FTSE All-World', shares: 120, avgCost: 98.5, currency: 'EUR' },
      { ticker: 'AAPL', name: 'Apple Inc.', shares: 15, avgCost: 175.2, currency: 'USD' },
      { ticker: 'ITX', name: 'Inditex', shares: 40, avgCost: 38.1, currency: 'EUR' },
    ],
    authUsers: [] as AuthUserRecord[], authSession: null as AuthSessionRecord | null,
  },
})
const SCRYPT_N = 16384, SCRYPT_R = 8, SCRYPT_P = 1, KEYLEN = 64
function normalizeUsername(u: string) { return u.trim().toLowerCase() }
function hashPassword(password: string, saltHex: string): string {
  return crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), KEYLEN, {
    N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P,
  }).toString('hex')
}
function verifyPassword(password: string, saltHex: string, hashHex: string): boolean {
  const a = Buffer.from(hashPassword(password, saltHex), 'hex')
  const b = Buffer.from(hashHex, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
let mainWindow: BrowserWindow | null = null
let memorySession: AuthSessionRecord | null = null
function preloadPath() {
  const p = path.join(__dirname, 'preload.cjs')
  if (!fs.existsSync(p)) throw new Error('No se encuentra el preload seguro de Electron')
  return p
}
function iconPath() {
  const p = path.join(__dirname, '../public/icon.png')
  return fs.existsSync(p) ? p : undefined
}
function buildMenu() {
  const isMac = process.platform === 'darwin'
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{ label: app.name, submenu: [{ role: 'about' as const }, { type: 'separator' as const }, { role: 'quit' as const }] }] : []),
    { label: 'Archivo', submenu: [
      ...(isMac ? [] : [{ role: 'quit' as const, label: 'Salir' }]),
      { role: 'close' as const, label: 'Cerrar ventana' },
    ] },
    { label: 'Editar', submenu: [
      { role: 'undo' as const, label: 'Deshacer' }, { role: 'redo' as const, label: 'Rehacer' },
      { type: 'separator' as const }, { role: 'cut' as const, label: 'Cortar' },
      { role: 'copy' as const, label: 'Copiar' }, { role: 'paste' as const, label: 'Pegar' },
      { role: 'selectAll' as const, label: 'Seleccionar todo' },
    ] },
    { label: 'Ver', submenu: [
      { role: 'reload' as const, label: 'Recargar' }, { role: 'toggleDevTools' as const, label: 'Herramientas de desarrollo' },
      { type: 'separator' as const }, { role: 'resetZoom' as const, label: 'Zoom real' },
      { role: 'zoomIn' as const, label: 'Acercar' }, { role: 'zoomOut' as const, label: 'Alejar' },
      { type: 'separator' as const }, { role: 'togglefullscreen' as const, label: 'Pantalla completa' },
    ] },
    { label: 'Ayuda', submenu: [{ label: 'Documentación OpenRouter', click: () => {
      void shell.openExternal('https://openrouter.ai/docs')
    } }] },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480, height: 940, minWidth: 1100, minHeight: 720,
    title: 'Foro Inversor', backgroundColor: '#070b14', icon: iconPath(),
    webPreferences: { preload: preloadPath(), contextIsolation: true, nodeIntegration: false, sandbox: true, webviewTag: false },
    show: false,
  })
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  hardenWindow(mainWindow)
  if (process.env.VITE_DEV_SERVER_URL) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  else mainWindow.loadFile(path.join(process.env.DIST!, 'index.html'))
}
/** Migrate existing plaintext key before changing legacy settings, without returning it to React.
 * If encryption is unavailable, retain existing legacy credentials main-only rather than deleting them.
 * New credentials require OS-backed safeStorage; P6 will later scope credentials by user.
 */
function migrateLegacyCredential() {
  const current = store.get('settings') as Record<string, unknown>
  const old = typeof current?.apiKey === 'string' ? current.apiKey : ''
  if (!old) return
  if (!store.get('llmApiCredential') && !store.get('llmLegacyApiKey')) {
    if (safeStorage.isEncryptionAvailable()) {
      store.set('llmApiCredential', safeStorage.encryptString(old).toString('base64'))
    } else {
      store.set('llmLegacyApiKey', old)
    }
  }
  store.set('settings', { ...current, apiKey: '' })
}
function getApiKey(): string {
  const encrypted = store.get('llmApiCredential')
  if (typeof encrypted === 'string' && encrypted.length) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Almacén seguro de credenciales no disponible')
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
  }
  return store.get('llmLegacyApiKey') || ''
}
function publicSettings(): PublicSettings {
  const s = store.get('settings') as Record<string, unknown>
  return {
    mockMode: typeof s.mockMode === 'boolean' ? s.mockMode : true,
    apiKey: '',
    hasApiKey: Boolean(store.get('llmApiCredential') || store.get('llmLegacyApiKey')),
    apiBaseUrl: typeof s.apiBaseUrl === 'string' ? s.apiBaseUrl : defaultSettings.apiBaseUrl,
    model: typeof s.model === 'string' ? s.model : defaultSettings.model,
    disclaimerAccepted: s.disclaimerAccepted === true,
  }
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function assertCaller(event: IpcMainInvokeEvent) {
  if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== event.sender.mainFrame) {
    throw new Error('Origen IPC no autorizado')
  }
  const frameUrl = event.senderFrame.url.split('#')[0]
  const expected = process.env.VITE_DEV_SERVER_URL
    ? new URL(process.env.VITE_DEV_SERVER_URL).href.split('#')[0]
    : pathToFileURL(path.join(process.env.DIST!, 'index.html')).href
  if (frameUrl !== expected) throw new Error('Navegación IPC no autorizada')
}
function assertSession(event: IpcMainInvokeEvent) {
  assertCaller(event)
  if (!memorySession) throw new Error('Sesión requerida')
}
function assertText(value: unknown, label: string, max: number): asserts value is string {
  if (typeof value !== 'string' || value.length > max) throw new Error(`${label} inválido`)
}
function assertData(value: unknown, maxBytes: number) {
  let json: string | undefined
  try { json = JSON.stringify(value) } catch { throw new Error('Datos no serializables') }
  if (!json || Buffer.byteLength(json, 'utf8') > maxBytes) throw new Error('Datos fuera de límites')
  function visit(v: unknown, depth: number): void {
    if (depth > 24) throw new Error('Datos demasiado anidados')
    if (Array.isArray(v)) { v.forEach((x) => visit(x, depth + 1)); return }
    if (isRecord(v)) {
      for (const [k, x] of Object.entries(v)) {
        if (['__proto__', 'constructor', 'prototype'].includes(k)) throw new Error('Clave no permitida')
        visit(x, depth + 1)
      }
      return
    }
    if (typeof v === 'number' && !Number.isFinite(v)) throw new Error('Número no finito')
    if (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean' && v !== null) throw new Error('Valor inválido')
  }
  visit(value, 0)
}
const DATA_KEYS = ['watchlist', 'briefs', 'portfolio', 'icSessions', 'strategies'] as const
function validData(key: unknown, value: unknown): key is (typeof DATA_KEYS)[number] {
  if (typeof key !== 'string' || !DATA_KEYS.includes(key as (typeof DATA_KEYS)[number])) return false
  assertData(value, 2_000_000)
  if (!Array.isArray(value) || value.length > 1000 || !value.every(isRecord)) throw new Error('Colección inválida')
  for (const entry of value) {
    if (key === 'watchlist') {
      if (typeof entry.ticker !== 'string' || !entry.ticker.trim() || entry.ticker.length > 32 ||
          typeof entry.name !== 'string' || entry.name.length > 300 ||
          (entry.note !== undefined && (typeof entry.note !== 'string' || entry.note.length > 2000))) {
        throw new Error('Elemento de watchlist inválido')
      }
    } else if (key === 'portfolio') {
      if (typeof entry.ticker !== 'string' || !entry.ticker.trim() || entry.ticker.length > 32 ||
          typeof entry.name !== 'string' || entry.name.length > 300 ||
          typeof entry.currency !== 'string' || !/^[A-Z]{3}$/.test(entry.currency) ||
          typeof entry.shares !== 'number' || !Number.isFinite(entry.shares) || entry.shares < 0 ||
          typeof entry.avgCost !== 'number' || !Number.isFinite(entry.avgCost) || entry.avgCost < 0) {
        throw new Error('Posición de cartera inválida')
      }
    } else if (typeof entry.id !== 'string' || entry.id.length > 150 ||
               typeof entry.createdAt !== 'string' || entry.createdAt.length > 60 ||
               !['mock', 'live'].includes(String(entry.mode))) {
      throw new Error('Informe inválido')
    }
  }
  return true
}
function validatedBaseUrl(raw: unknown): string {
  assertText(raw, 'URL', 300)
  let url: URL
  try { url = new URL(raw) } catch { throw new Error('URL del proveedor inválida') }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      !host || host === 'localhost' || host.endsWith('.localhost') || isIP(host) !== 0) {
    throw new Error('El proveedor debe ser un dominio HTTPS, sin credenciales ni parámetros en la URL')
  }
  return url.toString().replace(/\/$/, '')
}
function validateSettings(value: unknown): Omit<PublicSettings, 'hasApiKey'> {
  if (!isRecord(value) || typeof value.mockMode !== 'boolean' || typeof value.disclaimerAccepted !== 'boolean') {
    throw new Error('Configuración inválida')
  }
  assertText(value.model, 'Modelo', 150)
  if (!value.model.trim()) throw new Error('Modelo vacío')
  if (value.apiKey !== undefined && value.apiKey !== '') throw new Error('Utilice el campo separado de credenciales')
  return {
    mockMode: value.mockMode, disclaimerAccepted: value.disclaimerAccepted,
    model: value.model, apiBaseUrl: validatedBaseUrl(value.apiBaseUrl), apiKey: '',
  }
}
app.whenReady().then(() => {
  migrateLegacyCredential()
  const saved = store.get('authSession') as AuthSessionRecord | null
  if (saved?.remember) memorySession = saved
  else { store.set('authSession', null); memorySession = null }
  buildMenu()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

ipcMain.handle('data:getAll', (e) => {
  assertSession(e)
  return {
    settings: publicSettings(),
    watchlist: store.get('watchlist'), briefs: store.get('briefs'), portfolio: store.get('portfolio'),
    icSessions: store.get('icSessions'), strategies: store.get('strategies'),
  }
})
ipcMain.handle('data:set', (e, key: unknown, value: unknown) => {
  assertSession(e)
  if (!validData(key, value)) throw new Error('Clave de almacenamiento no autorizada')
  store.set(key, value)
  return true
})
ipcMain.handle('settings:update', (e, input: unknown, newApiKey?: unknown) => {
  assertSession(e)
  const next = validateSettings(input)
  if (newApiKey !== undefined && newApiKey !== '') {
    assertText(newApiKey, 'API key', 4096)
    if (!newApiKey.trim()) throw new Error('API key vacía')
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Almacén seguro no disponible; clave no modificada')
    const cipher = safeStorage.encryptString(newApiKey).toString('base64')
    store.set('llmApiCredential', cipher)
    store.delete('llmLegacyApiKey')
  }
  store.set('settings', next)
  return publicSettings()
})
ipcMain.handle('settings:clearKey', (e) => {
  assertSession(e)
  store.delete('llmApiCredential')
  store.delete('llmLegacyApiKey')
  return publicSettings()
})
ipcMain.handle('llm:complete', async (e, system: unknown, user: unknown) => {
  assertSession(e)
  assertText(system, 'System prompt', 12000)
  assertText(user, 'User prompt', 24000)
  const s = publicSettings()
  if (s.mockMode) throw new Error('Modo demostración activo')
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('API key no configurada')
  const base = validatedBaseUrl(s.apiBaseUrl)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60_000)
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST', signal: controller.signal, redirect: 'error',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://foro-inversor.local', 'X-Title': 'Foro Inversor' },
      body: JSON.stringify({ model: s.model, temperature: 0.4,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    })
    if (!res.ok) throw new Error(`Proveedor LLM: HTTP ${res.status}`)
    const data: unknown = await res.json()
    if (!isRecord(data) || !Array.isArray(data.choices)) throw new Error('Respuesta del proveedor inválida')
    const first = data.choices[0]
    const content = isRecord(first) && isRecord(first.message) ? first.message.content : undefined
    if (typeof content !== 'string' || content.length > 2_000_000) throw new Error('Contenido del proveedor inválido')
    return content
  } finally { clearTimeout(timer) }
})
ipcMain.handle('app:getVersion', (e) => { assertCaller(e); return app.getVersion() })

ipcMain.handle('auth:hasUsers', (e) => { assertCaller(e); return ((store.get('authUsers') as AuthUserRecord[]) || []).length > 0 })
ipcMain.handle('auth:getSession', (e) => {
  assertCaller(e)
  if (!memorySession) return null
  return { username: memorySession.username, userId: memorySession.userId, remember: memorySession.remember }
})
ipcMain.handle('auth:register', (e, payload: unknown) => {
  assertCaller(e)
  if (!isRecord(payload)) return { ok: false, error: 'Datos inválidos.' }
  const username = typeof payload.username === 'string' ? normalizeUsername(payload.username) : ''
  const password = typeof payload.password === 'string' ? payload.password : ''
  if (username.length < 3 || username.length > 254) return { ok: false, error: 'Usuario inválido.' }
  if (password.length < 8 || password.length > 1024) return { ok: false, error: 'Contraseña inválida.' }
  const users = (store.get('authUsers') as AuthUserRecord[]) || []
  if (users.some((u) => u.username === username)) return { ok: false, error: 'Ese usuario ya existe.' }
  const salt = crypto.randomBytes(16).toString('hex')
  const user: AuthUserRecord = { id: `u-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    username, salt, hash: hashPassword(password, salt), createdAt: new Date().toISOString() }
  store.set('authUsers', [...users, user])
  const session: AuthSessionRecord = { userId: user.id, username, remember: false, loggedInAt: new Date().toISOString() }
  memorySession = session
  store.set('authSession', null)
  return { ok: true, session: { username, userId: user.id, remember: false } }
})
ipcMain.handle('auth:login', (e, payload: unknown) => {
  assertCaller(e)
  if (!isRecord(payload)) return { ok: false, error: 'Datos inválidos.' }
  const username = typeof payload.username === 'string' ? normalizeUsername(payload.username) : ''
  const password = typeof payload.password === 'string' ? payload.password : ''
  if (username.length > 254 || password.length > 1024) return { ok: false, error: 'Datos inválidos.' }
  const remember = payload.remember === true
  const users = (store.get('authUsers') as AuthUserRecord[]) || []
  const user = users.find((u) => u.username === username)
  if (!user || !verifyPassword(password, user.salt, user.hash)) return { ok: false, error: 'Usuario o contraseña incorrectos.' }
  const session: AuthSessionRecord = { userId: user.id, username, remember, loggedInAt: new Date().toISOString() }
  memorySession = session
  store.set('authSession', remember ? session : null)
  return { ok: true, session: { username, userId: user.id, remember } }
})
ipcMain.handle('auth:logout', (e) => {
  assertCaller(e)
  memorySession = null
  store.set('authSession', null)
  return { ok: true }
})
interface MarketQuoteResult {
  symbol: string; price: number | null; changePct: number | null; currency: string | null
  asOf: string | null; marketState: string | null; ok: boolean; error?: string
}
async function fetchYahooChartQuote(symbol: string): Promise<MarketQuoteResult> {
  const encoded = encodeURIComponent(symbol)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=1d`
  try {
    const res = await fetch(url, { headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json',
    } })
    if (!res.ok) return { symbol, price: null, changePct: null, currency: null,
      asOf: null, marketState: null, ok: false, error: `HTTP ${res.status}` }
    const data = (await res.json()) as {
      chart?: { result?: Array<{ meta?: {
        regularMarketPrice?: number; regularMarketChangePercent?: number; currency?: string
        regularMarketTime?: number; currentTradingPeriod?: { regular?: { start?: number; end?: number } }
      } }>; error?: { code?: string; description?: string } | null }
    }
    const err = data.chart?.error
    const meta = data.chart?.result?.[0]?.meta
    if (err || !meta || meta.regularMarketPrice == null) return { symbol, price: null, changePct: null,
      currency: null, asOf: null, marketState: null, ok: false,
      error: err?.description || err?.code || 'Sin datos de cotización' }
    const nowSec = Math.floor(Date.now() / 1000)
    const reg = meta.currentTradingPeriod?.regular
    const marketState = reg?.start != null && reg?.end != null
      ? (nowSec >= reg.start && nowSec <= reg.end ? 'REGULAR' : 'CLOSED') : null
    const asOf = meta.regularMarketTime != null
      ? new Date(meta.regularMarketTime * 1000).toISOString() : new Date().toISOString()
    return { symbol, price: meta.regularMarketPrice,
      changePct: meta.regularMarketChangePercent != null ? meta.regularMarketChangePercent : null,
      currency: meta.currency ?? null, asOf, marketState, ok: true }
  } catch (e) {
    return { symbol, price: null, changePct: null, currency: null, asOf: null, marketState: null,
      ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
ipcMain.handle('market:quotes', async (e, symbols: unknown) => {
  assertSession(e)
  const list = Array.isArray(symbols)
    ? symbols.filter((s): s is string => typeof s === 'string' && s.trim().length > 0 && s.length <= 32)
        .slice(0, 40).map((s) => s.trim()) : []
  if (!list.length) return [] as MarketQuoteResult[]
  return Promise.all([...new Set(list)].map((sym) => fetchYahooChartQuote(sym)))
})
