# P3 — aislamiento y navegación de Electron

**Estado: implementación en rama y pruebas dinámicas sintéticas Windows superadas; aceptación final pendiente.** El PR #1 permanece en borrador; no fusionar sin revisar toda la fase P1–P6. `main` sigue intacta.

## Implementación

- `electron/main.ts`: `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, `webviewTag: false`; usa exclusivamente el `preload.cjs` construido. Registra protecciones antes de cargar la página.
- `electron/window-security.ts`: bloquea eventos `will-navigate`, `will-frame-navigate`, `will-redirect` y `will-attach-webview`, y niega ventanas arbitrarias. Solo la URL literal `https://openrouter.ai/docs` está permitida para apertura externa desde popup; la ayuda del menú usa esa dirección fija. Deniega solicitudes y comprobaciones de permisos del renderer.
- `index.html`: CSP de producción `default-src 'self'`, scripts locales, conexiones de red del renderer prohibidas (`connect-src 'none'`), objetos, base y formularios denegados. `'unsafe-inline'` permanece únicamente en `style-src` por compatibilidad; no existe `unsafe-eval` ni scripts inline en producción.
- `vite.config.ts`: excepción separada para preámbulo React Refresh y WebSocket HMR únicamente durante `vite serve`, no aplicada al HTML empaquetado.
- `tests/p3-security.test.mjs`: invariantes de código; `tests/p3-electron-hostile.mjs`: prueba integrada con Electron real en Windows y perfil temporal que comprueba que el puente sigue disponible sin globals Node, que se rechazan `fetch` HTTPS e inyección de script inline por CSP, popup arbitrario, geolocalización y acceso al puente desde iframe, que la navegación por enlace externo no cambia de documento y que HashRouter sigue funcionando. Las pruebas existentes de P1/P2 y la creación NSIS siguen ejecutándose.

## Evidencia reproducible

- [Ejecución específica de pruebas hostiles P3 satisfactoria](https://github.com/Nacho8912/investment-ai-desk/actions/runs/35439566602), SHA `fb701025bb34ff553afdc029e82a0b368f98b97e`: TypeScript, tests de fuente, compilación, Electron real e IPC, prueba hostil P3, NSIS x64 y comprobación de artefacto generado.
- [Ejecución de P4 que repite P3 y añade validación de informes](https://github.com/Nacho8912/investment-ai-desk/actions/runs/35439725361), SHA `bc193127622d0e36aa0ab3fbdf0be9f7e45f0f23`: éxito de todos los pasos del workflow antes del commit de documentación posterior.
- Consultar siempre los checks de la última revisión de la rama, no extrapolar el resultado de un commit a otro que cambie código o workflow.

## Límites de aceptación

El test dinámico cubre un conjunto determinado de ataques sintéticos, **no es una auditoría de penetración**. Aún faltan ensayos de redirect HTTP real y frame externo adversarial, reintentos con permisos adicionales, navegación tras recarga, apertura permitida de documentación, pruebas del servidor `npm run dev`/HMR y la ejecución del NSIS instalado en un PC limpio. La generación de un `.exe` no prueba la instalación. Firma e icono definitivo pendientes. P1/P2 necesitan aceptación con credenciales y datos previos reales. El triaje de dependencias y P4–P6 son cuestiones independientes.
