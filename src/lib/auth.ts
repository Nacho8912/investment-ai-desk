import type { AuthResult, AuthSessionInfo } from '../types'

const LS_USERS = 'foro-inversor-auth-users'
const LS_SESSION = 'foro-inversor-auth-session'
const LS_MEMORY = 'foro-inversor-auth-memory'

interface LocalUser {
  id: string
  username: string
  salt: string
  hash: string
  createdAt: string
}

function hasElectronAuth(): boolean {
  return typeof window !== 'undefined' && !!window.foroAPI?.auth
}

function normalizeUsername(u: string) {
  return u.trim().toLowerCase()
}

async function pbkdf2Hex(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)))
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 120_000, hash: 'SHA-256' },
    keyMaterial,
    256,
  )
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function randomHex(bytes: number) {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function loadLocalUsers(): LocalUser[] {
  try {
    return JSON.parse(localStorage.getItem(LS_USERS) || '[]') as LocalUser[]
  } catch {
    return []
  }
}

function saveLocalUsers(users: LocalUser[]) {
  localStorage.setItem(LS_USERS, JSON.stringify(users))
}

function setLocalSession(session: AuthSessionInfo | null, remember: boolean) {
  if (!session) {
    localStorage.removeItem(LS_SESSION)
    sessionStorage.removeItem(LS_MEMORY)
    return
  }
  const payload = JSON.stringify(session)
  sessionStorage.setItem(LS_MEMORY, payload)
  if (remember) localStorage.setItem(LS_SESSION, payload)
  else localStorage.removeItem(LS_SESSION)
}

function getLocalSession(): AuthSessionInfo | null {
  try {
    const mem = sessionStorage.getItem(LS_MEMORY)
    if (mem) return JSON.parse(mem) as AuthSessionInfo
    const saved = localStorage.getItem(LS_SESSION)
    if (saved) {
      const s = JSON.parse(saved) as AuthSessionInfo
      sessionStorage.setItem(LS_MEMORY, saved)
      return s
    }
  } catch {
    /* ignore */
  }
  return null
}

export async function authHasUsers(): Promise<boolean> {
  if (hasElectronAuth()) return window.foroAPI.auth.hasUsers()
  return loadLocalUsers().length > 0
}

export async function authGetSession(): Promise<AuthSessionInfo | null> {
  if (hasElectronAuth()) return window.foroAPI.auth.getSession()
  return getLocalSession()
}

export async function authRegister(username: string, password: string): Promise<AuthResult> {
  if (hasElectronAuth()) return window.foroAPI.auth.register(username, password)

  const u = normalizeUsername(username)
  if (!u || u.length < 3) return { ok: false, error: 'El usuario/email debe tener al menos 3 caracteres.' }
  if (password.length < 8) return { ok: false, error: 'La contraseña debe tener al menos 8 caracteres.' }
  const users = loadLocalUsers()
  if (users.some((x) => x.username === u)) {
    return { ok: false, error: 'Ese usuario ya existe. Inicie sesión o elija otro.' }
  }
  const salt = randomHex(16)
  const hash = await pbkdf2Hex(password, salt)
  const user: LocalUser = {
    id: `u-${Date.now()}-${randomHex(4)}`,
    username: u,
    salt,
    hash,
    createdAt: new Date().toISOString(),
  }
  users.push(user)
  saveLocalUsers(users)
  const session: AuthSessionInfo = { userId: user.id, username: user.username, remember: false }
  setLocalSession(session, false)
  return { ok: true, session }
}

export async function authLogin(
  username: string,
  password: string,
  remember = false,
): Promise<AuthResult> {
  if (hasElectronAuth()) return window.foroAPI.auth.login(username, password, remember)

  const u = normalizeUsername(username)
  if (!u || !password) return { ok: false, error: 'Indique usuario y contraseña.' }
  const users = loadLocalUsers()
  const user = users.find((x) => x.username === u)
  if (!user) return { ok: false, error: 'Usuario o contraseña incorrectos.' }
  const hash = await pbkdf2Hex(password, user.salt)
  if (hash !== user.hash) return { ok: false, error: 'Usuario o contraseña incorrectos.' }
  const session: AuthSessionInfo = { userId: user.id, username: user.username, remember }
  setLocalSession(session, remember)
  return { ok: true, session }
}

export async function authLogout(): Promise<void> {
  if (hasElectronAuth()) {
    await window.foroAPI.auth.logout()
    return
  }
  setLocalSession(null, false)
}
