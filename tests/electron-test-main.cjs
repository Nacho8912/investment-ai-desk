'use strict'
// Test-only bootstrap: select a disposable userData directory before production main.ts
// creates electron-store. No bypasses or changes to production IPC/authentication code.
const { app } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const directory = process.env.FORO_E2E_USER_DATA
if (process.env.CI !== 'true' || !directory || !path.resolve(directory).startsWith(os.tmpdir() + path.sep)) {
  throw new Error('Electron test bootstrap requires an isolated CI temp profile')
}
fs.mkdirSync(directory, { recursive: true })
app.setPath('userData', directory)
void import('../dist-electron/main.js')
