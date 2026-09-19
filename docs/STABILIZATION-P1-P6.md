# Fase 1 — estabilización P1–P6

Estado: **en curso; NO apto para declarar resueltos P1–P6**. Auditoría estática del commit base `3a1d0636148cdf14576c8e102bcb2fbcb4f129c7` (`main`, 2026-09-19). Rama de trabajo `stabilization/p1-p6-audit`. No fusionar sin pruebas.

## Estado y alcance

Se han inspeccionado `electron/main.ts`, `electron/preload.ts`, `src/agents/llm/client.ts`, `src/agents/orchestrator.ts`, `src/lib/auth.ts`, `src/lib/storage.ts`, `src/hooks/useAppState.tsx`, `src/pages/SettingsPage.tsx`, `src/types/index.ts`, `package.json`. Los hallazgos siguientes describen propiedades observables del código, NO una explotación demostrada. El repositorio no proporciona todavía pruebas automatizadas ni evidencia de compilación de esta rama. El riesgo depende de contenido cargado, acceso local y modelo de amenaza.

### P1 — credenciales accesibles desde renderer (confirmado en código; pendiente prueba de exposición dinámica)
- `electron/main.ts`: `store:getAll` devuelve `settings` completas; `store:get` permite leer cualquier clave.
- `electron/preload.ts`: `foroAPI.get` y `getAll` están accesibles al renderer.
- `src/lib/storage.ts`: mantiene `settings.apiKey` en estado React; la variante navegador persiste configuración en `localStorage`.
- `src/agents/llm/client.ts`: usa `settings.apiKey` en `fetch` desde el renderer.
- Remediación diseñada: guardar API key exclusivamente en el proceso principal, exponer `settings` públicas sin clave, utilizar métodos IPC limitados `llm:complete`, `settings:getPublic`, `settings:update` (sin retorno de secretos), separar credenciales de estado y no almacenar claves en localStorage. Preferir almacén de credenciales del sistema o cifrado respaldado por el SO; revisar modelo de amenazas. Migración cuidadosa de instalaciones anteriores.
- Aceptación: pruebas de que `getAll`, `get`, estado React y logs no muestran la clave; la petición al proveedor sale desde main; migración y uso de la clave probados.

### P2 — escritura IPC arbitraria (confirmado en código)
- `ipcMain.handle('store:set', (_e,key,value) => store.set(key,value))` acepta cualquier clave; el preload expone `set` genérico. No hay validación de claves, estructura ni procedencia del frame.
- Remediación diseñada: eliminar API genérica, permitir solo operaciones tipadas (watchlist, cartera, informes y ajustes públicos); validación de origen/frame y esquemas runtime; límites de tamaño; serialización de escrituras.
- Aceptación: intentos de modificar `authUsers`, `authSession` y credenciales mediante IPC de datos devuelven error; los flujos legítimos siguen funcionando.

### P3 — sandbox desactivado y navegación externa (confirmado en código)
- `BrowserWindow.webPreferences`: `contextIsolation:true`, `nodeIntegration:false`, `sandbox:false`.
- `setWindowOpenHandler` pasa cualquier URL a `shell.openExternal(url)` sin filtrar esquema o host. Es otro vector que debe incluirse en el endurecimiento.
- Remediación diseñada: habilitar `sandbox:true` tras adaptar preload, bloquear `will-navigate` no autorizada, permitir únicamente `https:` con lista de destinos o confirmación contextual, establecer CSP restringida en producción, controlar permisos.
- Aceptación: arranque dev y release con sandbox activo; intentos de `javascript:`, `file:`, `mailto:` o URLs no aprobadas no se abren automáticamente; verificación de CSP.

### P4 — respuesta LLM sin esquema runtime (confirmado en código)
- `JSON.parse` sin validación de objetos anidados, arrays, porcentajes o importes; se fusionan respuestas con plantillas demo. `as ResearchBrief` no valida en runtime.
- Remediación diseñada: esquemas estrictos para `ResearchBrief`, `ICSession`, `StrategyPlan` (p. ej. Zod o validadores equivalentes); comprobar invariantes monetarias: finitud, intervalos, porcentajes ~100%, cuotas y suma de euros a céntimos; evitar mezclar atributos demo y live sin procedencia explícita.
- Aceptación: rechazar payloads vacíos, `null`, arrays, estructuras incompletas, números negativos/no finitos y porcentajes incoherentes; nunca guardar resultados inválidos.

### P5 — modo live falso al recibir JSON inválido (confirmado; corrección parcial en esta rama)
- Estado inicial: los bloques `catch` en `runLiveResearch`, `runLiveIC` y `runLiveStrategy` devolvían plantillas demo con `mode:'live'` cuando fallaba `JSON.parse`.
- Cambio aplicado: `parseLiveObject` rechaza JSON inválido/array/null; los errores pasan al orquestador, que hace fallback a simulación con `mode:'mock'` y advertencia; los errores HTTP dejan de concatenar cuerpos arbitrarios del proveedor.
- **Limitación pendiente:** JSON objeto estructuralmente inválido sigue aceptándose sin esquema (P4); un objeto JSON válido se mezcla todavía con demo. Por tanto P5 está mitigado solo para JSON no válido y valores raíz no objeto, NO completamente cerrado.
- Aceptación final: etiqueta `live` solo para informe completamente validado y trazable; fallback debe mostrar `mock` y origen explícito. Ejecutar pruebas con respuestas malformadas y estructuras parciales.

### P6 — datos no aislados por usuario (confirmado en código; pendiente prueba entre dos cuentas)
- `authUsers` admite varios usuarios, pero `watchlist`, `briefs`, `portfolio`, `icSessions`, `strategies` y `settings` son claves globales en `electron-store`. `useAppState` carga `getAll` sin `userId`; la ruta web usa `localStorage` global.
- Remediación diseñada: namespace `users/<userId>/...` administrado en main; obtener identidad solo de sesión principal, nunca confiar en userId del renderer; migrar datos globales con consentimiento o asignación explícita; separar ajustes globales de preferencias del usuario; limpiar estado React al cambiar de sesión.
- Aceptación: crear usuarios A/B, guardar cartera e informes en A, cerrar sesión, entrar como B y comprobar aislamiento bidireccional; reabrir app y repetir. Pruebas de migración y rollback de datos.

## Cambios ya aplicados a la rama
- `.gitignore` añadido para futuros secretos, dependencias y artefactos. **No desindexa** los artefactos `dist-electron/` ya rastreados; desindexarlos requiere commit posterior tras verificar empaquetado.
- `src/agents/llm/client.ts`: corrección parcial P5 descrita arriba; supresión de cuerpos de error HTTP no confiables. No se ha ejecutado `npm ci`, `npm run typecheck`, `npm run build` ni la aplicación.

## Secuencia para completar la fase
1. Capturar baseline: `npm ci`, `npm run typecheck`, `npm run build`, `npm run dev`, ejecución del instalador Windows. Documentar comandos, entorno y salida.
2. Migración unificada de datos y credenciales con copia de seguridad y rollback.
3. P1/P2: mover secretos y peticiones a main, IPC tipado y validado, sin APIs genéricas expuestas.
4. P3: habilitar sandbox, bloquear navegación y enlaces externos no permitidos, CSP.
5. P4/P5: esquemas e invariantes, origen real/mock explícito, pruebas con fallos del proveedor.
6. P6: aislamiento por identidad de sesión autenticada y pruebas de dos usuarios.
7. CI, pruebas de regresión y revisión antes de abrir PR. Mantener `main` sin cambios.

## Estado de verificación
- Hecho: lectura del código y preparación de rama/cambios de GitHub.
- No hecho: compilación, tests, ejecución de Electron, seguridad dinámica, validación de compatibilidad de Windows, comprobación efectiva del modelo OpenRouter ni pruebas de Yahoo Finance.
- Decisión: no fusionar ni declarar la aplicación estable hasta contar con pruebas de aceptación por cada P1–P6.
