# Fase 1 — estabilización P1–P6: registro de evidencia

**19/09/2026. Estado: en curso, PR #1 EN BORRADOR. No fusionar con `main`.** Rama `stabilization/p1-p6-audit`, basada en `main` SHA `3a1d0636148cdf14576c8e102bcb2fbcb4f129c7`. Los hallazgos representan observaciones del código y ensayos delimitados, no una certificación de seguridad completa ni demostración de explotación.

## 1. Línea base, fallos encontrados y CI reproducible

Workflow `.github/workflows/stabilization.yml` en Windows, Node 22: `npm ci`, `npm run typecheck`, `npx tsc -p tsconfig.electron.json --noEmit`, 10 pruebas de fuente/validación mediante `node --test tests/security-source.test.mjs tests/ipc-validation.test.mjs`, `npm run build`, diagnóstico de `preload`, integración real de Electron usando perfil efímero, compilación del instalador NSIS x64 sin firmar y comprobación de que se genera el `.exe`.

- Línea base anterior a P1/P2: [run 35432947382](https://github.com/Nacho8912/investment-ai-desk/actions/runs/35432947382): instalación, TypeScript renderer y build exitosos (no incluía test de Electron).
- Primer intento de prueba dinámica: [run 35434094100](https://github.com/Nacho8912/investment-ai-desk/actions/runs/35434094100): el puente `window.foroAPI` no existía al arrancar la versión compilada; los checks estáticos previos habían pasado.
- Diagnóstico: Vite había generado código CommonJS con extensión `.mjs`, incompatible con el modo de carga esperado. `vite.config.ts` ahora produce `preload.cjs` y se eliminó el `dist-electron/preload.mjs` rastreado para impedir que `preloadPath()` eligiera el archivo obsoleto. [Run 35434263500](https://github.com/Nacho8912/investment-ai-desk/actions/runs/35434263500) confirmó que el puente volvió a existir.
- Una prueba de persistencia detectó un defecto en el arnés (redirigir `APPDATA` no trasladaba el `app.getPath('userData')`). Se creó `tests/electron-test-main.cjs`, exclusivo para CI, que establece un directorio temporal ANTES de importar el main de producción. No desactiva autenticación ni validación IPC.
- [Run 35434394347](https://github.com/Nacho8912/investment-ai-desk/actions/runs/35434394347): éxito en instalación, TypeScript renderer/Electron, 10 pruebas, compilación, arranque de `preload` y prueba integrada completa en Windows con datos sintéticos.
- [Run 35434468548](https://github.com/Nacho8912/investment-ai-desk/actions/runs/35434468548): instalador falló porque `public/icon.png` no tiene 256×256 píxeles; el error es de empaquetado, no de las pruebas P1/P2, que pasaron.
- **[Run 35434558046](https://github.com/Nacho8912/investment-ai-desk/actions/runs/35434558046): SUCCESS** en todos los pasos anteriores y empaquetado NSIS Windows x64. Se quitó provisionalmente la referencia al icono insuficiente en la configuración Windows: el instalador usa icono predeterminado hasta sustituir el recurso gráfico por uno válido. Solo se comprobó CREACIÓN del ejecutable sin firma, NO instalación ni lanzamiento del binario instalado.

En cada nuevo commit debe consultarse su propia ejecución, sin trasladar resultados de un SHA antiguo.

`npm ci` informa de **18 avisos de vulnerabilidad** (3 moderadas, 14 altas, 1 crítica). Falta `npm audit` y clasificación de rutas afectadas y relevancia producción/desarrollo; NO equivalen automáticamente a fallos explotables en el ejecutable. No aplicar `npm audit fix --force` sin pruebas.

## 2. P1 — Credenciales LLM: implementado, integración sintética superada, aceptación final pendiente

**Problema original:** `store:get/getAll` y el cliente React exponían o utilizaban `settings.apiKey` desde el renderer, con solicitudes autenticadas generadas allí. La variante navegador almacenaba la configuración en `localStorage`.

**Cambios realizados:** credencial y solicitudes OpenRouter trasladadas a `electron/main.ts`; `publicSettings()` siempre devuelve `apiKey:''` y el booleano `hasApiKey`; el renderer guarda la clave nueva transitoriamente en un campo de contraseña y la envía únicamente a `settings:update`, sin rehidratarla en el estado global; `settings:clearKey` permite borrarla. Electron `safeStorage` cifra claves nuevas cuando se encuentra disponible; migración de `settings.apiKey` al primer arranque. El cliente web elimina una clave heredada y funciona solo en modo demo. El proveedor debe utilizar HTTPS con validaciones de URL; la petición main rechaza redirecciones y tiene timeout. Contratos y pantallas adaptados a `hasApiKey`.

**Verificado con Electron Windows real y perfil temporal, sin clave real ni llamadas externas:** guardar, rotar y eliminar claves ficticias; lectura de configuración redactada; rechazo de intento de escribir clave en settings públicos; comprobación de que el JSON no contiene clave nueva en texto claro, contiene credencial cifrada; cerrar/iniciar sesión, reiniciar y conservar clave; insertar fixture legacy en el JSON temporal, arrancar y comprobar migración a cifrado con clave borrada de settings y watchlist intacta. El modo offline rechaza la solicitud LLM.

**Pendiente para aceptar P1:** pruebas con instalación Windows de usuario existente y copia/rollback; prueba auténtica OpenRouter (respuesta normal y fallida), revisión de DevTools/logs y escenarios de cifrado no disponible. **Riesgo residual:** si el SO no proporciona cifrado, una clave *heredada* puede conservarse provisionalmente sin cifrar bajo `llmLegacyApiKey` en almacenamiento main-only para evitar pérdida; claves NUEVAS sí exigen cifrado. Debe establecerse política segura de migración/fallo antes del cierre definitivo. La clave sigue siendo global entre cuentas hasta P6.

## 3. P2 — IPC: implementado, integración sintética superada, aceptación final pendiente

**Problema original:** `store:set` aceptaba cualquier clave y valor, incluyendo posibles modificaciones de `authUsers`, `authSession` o credenciales, y `preload` exponía `get/set` genéricos.

**Cambios realizados:** métodos específicos `data:getAll`, `data:set`, `settings:update`, `settings:clearKey`, `llm:complete`; comprobaciones de webContents/frame principal/URL/sesión en canales sensibles; allowlist de datos (`watchlist`, `briefs`, `portfolio`, `icSessions`, `strategies`) y límites de tamaño, profundidad, tipos JSON y estructura básica; autenticación valida entradas. No existe escritor general de configuración o credenciales a través de `data:set`.

**Verificado:** 10 tests de validación e invariantes; en Electron real, las lecturas y escrituras antes de login y tras logout se rechazan, se puede registrar y acceder, guardar watchlist, rechazar claves protegidas y cartera malformada y denegar acceso desde iframe secundario. Se comprobó persistencia y recuperación de la watchlist tras reinicio.

**Pendiente para aceptar P2:** adversarial tests exhaustivos de origen externo/navegación, todas las colecciones y formatos antiguos, escrituras concurrentes, integridad del instalador ya instalado; informes siguen validados superficialmente (P4). La acción autorizada por el usuario desde JS renderer sigue requiriendo mitigaciones de P3.

## 4. P3 — Sandbox y navegación: PENDIENTE

`sandbox:false` continúa configurado. El `window.open` permite temporalmente HTTPS, pero no hay allowlist estricta por host, bloqueo general `will-navigate` ni CSP robusta. Habilitar sandbox y revisar adaptación `preload.cjs`, permisos y enlaces externos en dev/producción; después prueba dinámica.

## 5. P4 — Contratos del proveedor: PENDIENTE

`parseLiveObject` comprueba JSON/raíz objeto pero no valida exhaustivamente estructuras anidadas, porcentajes, euros ni invariantes; `as ResearchBrief/ICSession/StrategyPlan` no es validación runtime. Crear esquemas completos y prueba de respuestas inválidas, sin mezclar objetos mock/live.

## 6. P5 — Veracidad de live: MITIGACIÓN PARCIAL

JSON no parseable, `null` o array lanza error y el orquestador presenta demo con aviso y `mode:'mock'`. Un JSON raíz objeto pero incompleto podría aún etiquetarse `live` tras mezclar campos simulados. Bloqueado hasta resolver P4 y probar con proveedor simulado.

## 7. P6 — Separación por usuario: PENDIENTE

Los datos, ajustes y credenciales siguen siendo globales por instalación aunque `data` requiera sesión. Migrar a almacenamiento por `userId` obtenido solo desde sesión de Electron main, resolver asignación de datos legacy con backup/rollback y comprobar usuarios A/B y reinicios. No anunciar privacidad entre usuarios del mismo PC.

## 8. Lista de aceptación pendiente

1. Hacer copia de seguridad del perfil real, probar migración sobre una COPIA y validar reversión. Nunca exponer claves en capturas/issues/logs.
2. Instalar el NSIS sin firma en equipo de pruebas Windows, lanzar, comprobar preload y los flujos de login, mercado, watchlist, cartera, IC, estrategia y cierre/reapertura; validar reputación/firma antes de distribuir.
3. Probar OpenRouter de verdad con credencial dedicada de pruebas: éxito y errores sin fugas de clave; verificar URL no fiable/redirecciones y fallo de cifrado.
4. Probar todos los contratos IPC desde frames externos, requests concurrentes y payloads límite; persistencia de todas las colecciones antiguas.
5. Sustituir el icono Windows provisional por recurso válido ≥256×256 y revalidar empaquetado y versión instalada.
6. Ejecutar `npm audit` y clasificar dependencias, sin aplicar actualizaciones rompedoras automáticamente.
7. P3–P6 deben completarse y verificarse antes de aprobar/fusionar el PR de la fase 1.

**Regla:** documentar commit, ejecución exacta y criterios pendientes; conservar siempre `main` sin cambios hasta autorización de fusión y revisión final.
