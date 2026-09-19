import { shell } from 'electron'
import type { BrowserWindow } from 'electron'

/**
 * Renderer content is only our bundled application. No page-level navigation is
 * necessary: React's HashRouter performs in-page hash updates instead.
 * Install these handlers before loadURL/loadFile to avoid a navigation race.
 */
export function hardenWindow(window: BrowserWindow): void {
  const contents = window.webContents

  // Deny new documents in both the main frame and embedded frames, including redirects.
  // Programmatic loadURL/loadFile/reload by trusted main remains possible.
  contents.on('will-navigate', (event) => event.preventDefault())
  contents.on('will-frame-navigate', (event) => event.preventDefault())
  contents.on('will-redirect', (event) => event.preventDefault())
  contents.on('will-attach-webview', (event) => event.preventDefault())

  // Renderer-controlled URLs are NOT generally safe to hand to shell.openExternal.
  // The one help destination is a fixed, exact string; do not accept arbitrary HTTPS.
  contents.setWindowOpenHandler(({ url }) => {
    if (url === 'https://openrouter.ai/docs') {
      void shell.openExternal('https://openrouter.ai/docs').catch(() => { /* no renderer error details */ })
    }
    return { action: 'deny' }
  })

  // The application requires no camera, microphone, geolocation, notifications, etc.
  // Permission requests/checks fail closed, including requests from subframes.
  contents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  contents.session.setPermissionCheckHandler(() => false)
}
