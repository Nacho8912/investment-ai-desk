# P3 — aislamiento y navegación de Electron

**Estado: implementación en rama, aceptación pendiente.** El PR #1 permanece en borrador; nunca fusionar directamente sin revisar toda la fase P1–P6. `main` se conserva intacta.

## Implementación

- `electron/main.ts`: `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, `webviewTag: false`; usa exclusivamente el `preload.cjs` construido, sin recurrir al `.mjs` incompatible. Registra las protecciones antes de cargar HTML o URL de desarrollo.
- `electron/window-security.ts`: bloquea eventos `will-navigate`, `will-frame-navigate`, `will-redirect` y `will-attach-webview` y niega aperturas de ventanas. Únicamente la URL literal `https://openrouter.ai/docs` puede abrirse con el navegador predeterminado; la ayuda del menú principal utiliza igualmente una URL constante. Deniega solicitudes y comprobaciones de permisos del renderer.
- `index.html`: CSP de producción `default-src 'self'`, scripts locales, conexión de red de renderer denegada (`connect-src 'none'`), objetos, base y formularios denegados. Se conserva `'unsafe-inline'` SOLO en `style-src` por estilos actuales del programa; no se permite `'unsafe-eval'` ni scripts inline en producción.
- `vite.config.ts`: relajación explícita *solo durante `vite serve`* para el preámbulo de React Refresh y WebSocket local de HMR, no aplicada al HTML empaquetado.
- `tests/p3-security.test.mjs`: invariantes de fuente para sandbox, navegación, ventanas, permisos y CSP; integrado en el workflow Windows junto con pruebas P1/P2, compilación, arranque Electron, smoke de IPC y generación NSIS.

## Evidencia y limitaciones

Comprobar siempre Actions del SHA más reciente, nunca extrapolar pruebas de commits anteriores. Referencia inicial de P3: https://github.com/Nacho8912/investment-ai-desk/actions/runs/35438514087. La prueba de humo existente cubre arranque, autenticación y puente IPC con un perfil Windows temporal; los tests P3 nuevos son de invariantes del código, **no sustituyen ensayos de navegación/ventanas/permiso en tiempo de ejecución**.

Pendiente para aceptar P3: pruebas dinámicas específicas de intentos de navegar a URLs maliciosas, redirecciones, popups, subframes, `window.open`, permisos y `fetch` del renderer; comprobar también recarga, navegación HashRouter y modo `npm run dev`; instalar y ejecutar un NSIS en PC limpio, verificar firma e icono definitivo. Los avisos de dependencias `npm audit` y P4–P6 no se consideran resueltos. P1/P2 requieren aceptación real con credenciales y datos previos.
