import { app, BrowserWindow, ipcMain, shell, Menu } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import crypto from 'node:crypto'

const require = createRequire(import.meta.url)
const Store = require('electron-store') as typeof import('electron-store')
const fs = require('node:fs') as typeof import('node:fs')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
process.env.DIST = path.join(__dirname, '../dist')

interface AuthUserRecord {
  id: string
  username: string
  salt: string
  hash: string
  createdAt: string
}

interface AuthSessionRecord {
  userId: string
  username: string
  remember: boolean
  loggedInAt: string
}

const store = new Store({
  name: 'foro-inversor',
  defaults: {
    settings: {
      mockMode: true,
      apiKey: '',
      apiBaseUrl: 'https://openrouter.ai/api/v1',
      model: 'openai/gpt-4o-mini',
      disclaimerAccepted: false,
    },
    watchlist: [
      { ticker: 'AAPL', name: 'Apple Inc.', note: 'Ejemplo demo' },
      { ticker: 'VWCE', name: 'Vanguard FTSE All-World UCITS ETF', note: 'Ejemplo demo' },
      { ticker: 'ITX', name: 'Inditex', note: 'Ejemplo IBEX — demo' },
      { ticker: 'SAN', name: 'Banco Santander', note: 'Ejemplo IBEX — demo' },
    ],
    briefs: [],
    icSessions: [],
    strategies: [],
    portfolio: [
      { ticker: 'VWCE', name: 'Vanguard FTSE All-World', shares: 120, avgCost: 98.5, currency: 'EUR' },
      { ticker: 'AAPL', name: 'Apple Inc.', shares: 15, avgCost: 175.2, currency: 'USD' },
      { ticker: 'ITX', name: 'Inditex', shares: 40, avgCost: 38.1, currency: 'EUR' },
    ],
    authUsers: [] as AuthUserRecord[],
    authSession: null as AuthSessionRecord | null,
  },
})

const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEYLEN = 64

function normalizeUsername(u: string) {
  return u.trim().toLowerCase()
}

function hashPassword(password: string, saltHex: string): string {
  const salt = Buffer.from(saltHex, 'hex')
  const derived = crypto.scryptSync(password, salt, KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  })
  return derived.toString('hex')
}

function verifyPassword(password: string, saltHex: string, hashHex: string): boolean {
  const computed = hashPassword(password, saltHex)
  const a = Buffer.from(computed, 'hex')
  const b = Buffer.from(hashHex, 'hex')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

let mainWindow: BrowserWindow | null = null
/** Sesión en memoria (siempre); persistida solo si remember=true */
let memorySession: AuthSessionRecord | null = null

function preloadPath() {
  for (const name of ['preload.mjs', 'preload.js', 'preload.cjs']) {
    const p = path.join(__dirname, name)
    if (fs.existsSync(p)) return p
  }
  return path.join(__dirname, 'preload.mjs')
}

function iconPath() {
  const p = path.join(__dirname, '../public/icon.png')
  return fs.existsSync(p) ? p : undefined
}

function buildMenu() {
  const isMac = process.platform === 'darwin'
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{ label: app.name, submenu: [{ role: 'about' as const }, { type: 'separator' as const }, { role: 'quit' as const }] }] : []),
    {
      label: 'Archivo',
      submenu: [
        ...(isMac ? [] : [{ role: 'quit' as const, label: 'Salir' }]),
        { role: 'close' as const, label: 'Cerrar ventana' },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo' as const, label: 'Deshacer' },
        { role: 'redo' as const, label: 'Rehacer' },
        { type: 'separator' as const },
        { role: 'cut' as const, label: 'Cortar' },
        { role: 'copy' as const, label: 'Copiar' },
        { role: 'paste' as const, label: 'Pegar' },
        { role: 'selectAll' as const, label: 'Seleccionar todo' },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload' as const, label: 'Recargar' },
        { role: 'toggleDevTools' as const, label: 'Herramientas de desarrollo' },
        { type: 'separator' as const },
        { role: 'resetZoom' as const, label: 'Zoom real' },
        { role: 'zoomIn' as const, label: 'Acercar' },
        { role: 'zoomOut' as const, label: 'Alejar' },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const, label: 'Pantalla completa' },
      ],
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'No es asesoramiento financiero',
          click: () => {
            shell.openExternal('https://openrouter.ai/docs')
          },
        },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1100,
    minHeight: 720,
    title: 'Foro Inversor',
    backgroundColor: '#070b14',
    icon: iconPath(),
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(process.env.DIST!, 'index.html'))
  }
}

app.whenReady().then(() => {
  // Restaurar sesión «mantener sesión» al arrancar
  const saved = store.get('authSession') as AuthSessionRecord | null
  if (saved?.remember) memorySession = saved
  else {
    store.set('authSession', null)
    memorySession = null
  }

  buildMenu()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('store:get', (_e, key: string) => store.get(key))
ipcMain.handle('store:set', (_e, key: string, value: unknown) => {
  store.set(key, value)
  return true
})
ipcMain.handle('store:getAll', () => ({
  settings: store.get('settings'),
  watchlist: store.get('watchlist'),
  briefs: store.get('briefs'),
  portfolio: store.get('portfolio'),
  icSessions: store.get('icSessions'),
  strategies: store.get('strategies'),
}))
ipcMain.handle('app:getVersion', () => app.getVersion())

ipcMain.handle('auth:hasUsers', () => {
  const users = (store.get('authUsers') as AuthUserRecord[]) || []
  return users.length > 0
})

ipcMain.handle('auth:getSession', () => {
  if (memorySession) {
    return { username: memorySession.username, userId: memorySession.userId, remember: memorySession.remember }
  }
  return null
})

ipcMain.handle('auth:register', (_e, payload: { username: string; password: string }) => {
  const username = normalizeUsername(payload?.username || '')
  const password = payload?.password || ''
  if (!username || username.length < 3) {
    return { ok: false, error: 'El usuario/email debe tener al menos 3 caracteres.' }
  }
  if (password.length < 8) {
    return { ok: false, error: 'La contraseña debe tener al menos 8 caracteres.' }
  }
  const users = ([...(store.get('authUsers') as AuthUserRecord[])] || []) as AuthUserRecord[]
  if (users.some((u) => u.username === username)) {
    return { ok: false, error: 'Ese usuario ya existe. Inicie sesión o elija otro.' }
  }
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = hashPassword(password, salt)
  const user: AuthUserRecord = {
    id: `u-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    username,
    salt,
    hash,
    createdAt: new Date().toISOString(),
  }
  users.push(user)
  store.set('authUsers', users)
  const session: AuthSessionRecord = {
    userId: user.id,
    username: user.username,
    remember: false,
    loggedInAt: new Date().toISOString(),
  }
  memorySession = session
  store.set('authSession', null)
  return { ok: true, session: { username: session.username, userId: session.userId, remember: false } }
})

ipcMain.handle(
  'auth:login',
  (_e, payload: { username: string; password: string; remember?: boolean }) => {
    const username = normalizeUsername(payload?.username || '')
    const password = payload?.password || ''
    const remember = !!payload?.remember
    if (!username || !password) {
      return { ok: false, error: 'Indique usuario y contraseña.' }
    }
    const users = (store.get('authUsers') as AuthUserRecord[]) || []
    const user = users.find((u) => u.username === username)
    if (!user || !verifyPassword(password, user.salt, user.hash)) {
      return { ok: false, error: 'Usuario o contraseña incorrectos.' }
    }
    const session: AuthSessionRecord = {
      userId: user.id,
      username: user.username,
      remember,
      loggedInAt: new Date().toISOString(),
    }
    memorySession = session
    store.set('authSession', remember ? session : null)
    return { ok: true, session: { username: session.username, userId: session.userId, remember } }
  },
)

ipcMain.handle('auth:logout', () => {
  memorySession = null
  store.set('authSession', null)
  return { ok: true }
})

/** Cotización Yahoo Finance (chart v8) — sin API key; suele ir con retraso de mercado. */
interface MarketQuoteResult {
  symbol: string
  price: number | null
  changePct: number | null
  currency: string | null
  asOf: string | null
  marketState: string | null
  ok: boolean
  error?: string
}

async function fetchYahooChartQuote(symbol: string): Promise<MarketQuoteResult> {
  const encoded = encodeURIComponent(symbol)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=1d`
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
    })
    if (!res.ok) {
      return {
        symbol,
        price: null,
        changePct: null,
        currency: null,
        asOf: null,
        marketState: null,
        ok: false,
        error: `HTTP ${res.status}`,
      }
    }
    const data = (await res.json()) as {
      chart?: {
        result?: Array<{
          meta?: {
            regularMarketPrice?: number
            regularMarketChangePercent?: number
            currency?: string
            regularMarketTime?: number
            currentTradingPeriod?: {
              regular?: { start?: number; end?: number }
            }
          }
        }>
        error?: { code?: string; description?: string } | null
      }
    }
    const err = data.chart?.error
    const meta = data.chart?.result?.[0]?.meta
    if (err || !meta || meta.regularMarketPrice == null) {
      return {
        symbol,
        price: null,
        changePct: null,
        currency: null,
        asOf: null,
        marketState: null,
        ok: false,
        error: err?.description || err?.code || 'Sin datos de cotización',
      }
    }
    const nowSec = Math.floor(Date.now() / 1000)
    const reg = meta.currentTradingPeriod?.regular
    let marketState: string | null = null
    if (reg?.start != null && reg?.end != null) {
      marketState = nowSec >= reg.start && nowSec <= reg.end ? 'REGULAR' : 'CLOSED'
    }
    const asOf =
      meta.regularMarketTime != null
        ? new Date(meta.regularMarketTime * 1000).toISOString()
        : new Date().toISOString()
    return {
      symbol,
      price: meta.regularMarketPrice,
      changePct:
        meta.regularMarketChangePercent != null ? meta.regularMarketChangePercent : null,
      currency: meta.currency ?? null,
      asOf,
      marketState,
      ok: true,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      symbol,
      price: null,
      changePct: null,
      currency: null,
      asOf: null,
      marketState: null,
      ok: false,
      error: msg,
    }
  }
}

ipcMain.handle('market:quotes', async (_e, symbols: unknown) => {
  const list = Array.isArray(symbols)
    ? symbols.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim())
    : []
  if (list.length === 0) return [] as MarketQuoteResult[]
  const unique = [...new Set(list)]
  const results = await Promise.all(unique.map((sym) => fetchYahooChartQuote(sym)))
  return results
})
