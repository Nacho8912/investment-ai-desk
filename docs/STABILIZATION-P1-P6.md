# Fase 1 — auditoría y estabilización P1–P6

**Estado: en curso. PR #1 en borrador; NO fusionar con `main`.** Base inmutable identificada: `3a1d0636148cdf14576c8e102bcb2fbcb4f129c7` (19-09-2026). Rama exclusiva `stabilization/p1-p6-audit`. Los problemas descritos son observaciones del código, no evidencia de una explotación.

## Línea base reproducible y evidencia

Se creó `.github/workflows/stabilization.yml`, con Windows y Node.js 22. Ejecuta `npm ci`, `npm run typecheck`, `npx tsc -p tsconfig.electron.json --noEmit`, `node --test tests/security-source.test.mjs tests/ipc-validation.test.mjs` y `npm run build`. La ejecución de línea base previa a P1/P2 (run 35432947382) completó correctamente instalación, comprobación de TypeScript del renderer y compilación. Los controles posteriores se ejecutan sobre cada cambio y su resultado definitivo debe verificarse en https://github.com/Nacho8912/investment-ai-desk/actions antes de aprobar.

No fue posible clonar el repositorio en el entorno de trabajo inicial por un fallo DNS; GitHub Actions ha proporcionado un entorno reproducible independiente, pero **no sustituye** arrancar Electron, probar el instalador ni ejercer las credenciales reales. Las ejecuciones posteriores detectaron y permitieron corregir tres errores TypeScript en claves nuevas de electron-store; una ejecución de tests falló porque Node 22 Windows no admite `node --test tests` como se esperaba. El workflow se corrigió para enumerar los dos archivos de test explícitamente. No confundir resultados de commits antiguos con el commit actual.

`npm ci` informa de 18 avisos de vulnerabilidad de dependencias (3 moderados, 14 altos, 1 crítico); NO se han analizado aún sus rutas de explotación ni su alcance en producción. Pendiente `npm audit` con triaje y actualizaciones controladas; evitar `npm audit fix --force` indiscriminado.

## P1 — API key expuesta al renderer

**Original confirmado:** los manejadores `store:get` y `store:getAll` devolvían configuración completa; `preload.ts` exponía `get` genérico y el cliente `src/agents/llm/client.ts` enviaba `Authorization` desde React. El estado y el almacenamiento web podían contener la clave.

**Implementación actual en rama:**
- `electron/main.ts` migra la clave heredada desde `settings.apiKey`, escribe una credencial cifrada con `safeStorage` si el SO proporciona cifrado y borra el valor del objeto de configuración. Las nuevas claves requieren cifrado disponible. Si el SO no proporciona cifrado, **una clave heredada se preserva sin cifrar bajo `llmLegacyApiKey` en el almacén del proceso principal para evitar pérdida silenciosa**. Este riesgo residual exige una política de migración/advertencia antes de declarar P1 cerrado.
- `publicSettings` solo devuelve `apiKey: ''` y `hasApiKey` booleano. `data:getAll` emplea esa proyección; se ha eliminado el lector genérico.
- `settings:update` recibe por separado la clave nueva, la cifra en main y nunca la devuelve. `settings:clearKey` borra credenciales. En la pantalla de ajustes la clave recién introducida existe transitoriamente en el campo mientras se escribe, pero no se incorpora al estado global ni se rehidrata tras guardar.
- `llm:complete` usa la clave y realiza `fetch` en main con timeout, HTTPS, rechazo de redirecciones y mensajes HTTP sin volcar el cuerpo del proveedor. La capa cliente de React únicamente invoca el puente de Electron. El modo web elimina cualquier clave heredada en su `localStorage` y se limita a demo; no puede seguir utilizando IA live desde navegador.
- `src/agents/orchestrator.ts` y `HomePage.tsx` usan `hasApiKey`, no el secreto, para activar la IA.

**Compatibilidad que cambia intencionalmente:** URLs de proveedores exigen HTTPS y nombre DNS, sin IP/localhost, credenciales embebidas, query ni hash. Las claves antiguas se migran en el primer arranque; se requiere ensayo real de migración y recuperación. Las claves siguen siendo globales entre usuarios locales hasta P6; no afirmar aislamiento multicuenta.

**Aceptar P1 solo después de:** instalación real con clave previa y sin ella; copia de seguridad/recuperación; comprobar que `getAll`, estado React, logs y DevTools no devuelven la clave; probar alta, rotación, eliminación y petición a OpenRouter válida y fallida en Windows; comprobar comportamiento al no haber cifrado, integridad y restauración ante fallo de migración.

## P2 — IPC arbitrario

**Original confirmado:** `store:set` aceptaba cualquier clave/valor y el renderer disponía de `foroAPI.set`, incluido acceso potencial a `authUsers`, `authSession` y credenciales.

**Implementación actual en rama:**
- Eliminados los manejadores `store:get`, `store:set` y la API genérica preload; reemplazados por `data:getAll` (solo datos permitidos/redactados), `data:set` con allowlist estricta de `watchlist`, `briefs`, `portfolio`, `icSessions` y `strategies`, `settings:update`, `settings:clearKey` y `llm:complete`.
- Los manejadores contrastan WebContents, frame principal, URL de inicio permitida y sesión iniciada para operaciones sobre datos/credenciales. Las rutas de autenticación comprueban procedencia y validan el tipo/tamaño de sus entradas.
- `data:set` valida que las colecciones sean arrays de objetos, tamaño máximo, profundidad, tipos JSON y claves peligrosas; valida campos básicos de watchlist y cartera, además de id/fecha/modo en informes. No se permite alterar `settings` ni claves de autenticación mediante `data:set`. Se acota el número/tamaño de símbolos de cotización. `settings:update` valida configuración y URL del proveedor.
- Tests de invariantes de fuente en `tests/security-source.test.mjs` y de ejecución de validador real aislado en `tests/ipc-validation.test.mjs` verifican claves protegidas, formas de entrada, no-finitos, polución de prototipos, tamaño y profundidad.

**Limitaciones:** aún no hay ensayos integrados con Electron ni tests de origen/frame reales; los informes solamente tienen validación superficial, pendiente P4. `data:set` no añade todavía bloqueo/serialización explícita de escrituras concurrentes: comprobar orden y persistencia en regresión. El renderer sigue ejecutando JS capaz de pedir acciones autorizadas de su sesión; P3 será necesario para reducir superficie XSS. No declarar P2 cerrado sin pruebas de host.

**Aceptar P2 solo después de:** invocar IPC en Windows desde frame no autorizado y frame principal legítimo, antes/después de login y logout; comprobar rechazo de `authUsers`, `authSession`, `llmApiCredential`, `settings`, objetos malformados, payloads enormes; comprobar guardado/recuperación de cada colección real con datos de la versión previa, y ausencia de condiciones de carrera.

## P3 — sandbox y navegación: pendiente

En `electron/main.ts` sigue `sandbox:false`. Se limita `window.open` a esquema HTTPS como mitigación menor, pero sin allowlist de hosts ni protección general `will-navigate`/CSP. Próxima fase: activar sandbox tras adaptar preload, política de navegación/URLs externas, CSP y permisos; comprobar desarrollo y versión distribuida.

## P4 — validación LLM: pendiente

`parseLiveObject` solo valida JSON y objeto raíz; el cliente todavía mezcla un objeto incompleto con un informe mock y hace casts TypeScript, no esquemas completos ni invariantes financieras. Requiere validación estructural runtime para `ResearchBrief`, `ICSession`, `StrategyPlan` y control de importes, porcentajes y procedencia de datos.

## P5 — falsos resultados live: mitigación parcial

JSON inválido/null/array provoca error y el orquestador devuelve resultado mock con advertencia. JSON con estructura incorrecta pero raíz objeto todavía puede etiquetarse live: bloquear hasta cerrar P4. La eliminación del cuerpo arbitrario del error HTTP reduce filtración en errores.

## P6 — datos entre cuentas: pendiente

`watchlist`, `briefs`, `portfolio`, `icSessions`, `strategies`, `settings` y las credenciales de proveedor aún son globales para la instalación, aunque IPC exige una sesión. Crear namespace por `userId` tomado exclusivamente de sesión del proceso principal; migrar datos globales con estrategia explícita y rollback, aislar usuarios A/B y credenciales, y repetir pruebas tras reiniciar. No anunciar privacidad entre usuarios de un mismo PC hasta cerrar P6.

## Lista manual de regresión y aceptación

- Confirmar instalación y arranque Electron en Windows, sin contraseña/clave previa y con instalación existente; realizar copia recuperable antes de migrar.
- Registrar usuario, login, «recordarme», logout, relogin y uso normal de cartera, watchlist, informes y estrategias.
- Guardar configuración pública sin clave, introducir clave nueva, realizar petición real de OpenRouter, reiniciar, comprobar clave persistente sin exposición, rotar/eliminar clave y probar fallos del proveedor. Nunca pegar credenciales reales en issues, logs o capturas.
- Rechazar IPC de frame secundario, web no confiable y sin sesión; verificar intento de escribir claves reservadas y estructuras maliciosas.
- Verificar diferencia mock/live cuando la API responde mal; P4/P5 seguirán abiertos para JSON objeto estructuralmente inválido.
- Empaquetar `npm run pack:win`, instalar y abrir ejecutable, comprobar preload, rutas, menú, Yahoo, cierre y recuperación tras reinicio.
- Ejecutar `npm audit` y clasificar vulnerabilidades directas/transitivas y de desarrollo/producción. Evitar actualizaciones incompatibles no verificadas.

## Reglas de mantenimiento

1. Consultar siempre la ejecución de GitHub Actions **del último SHA**, no una anterior; guardar URL, resultado y logs de fallos.
2. Mantener PR #1 en borrador, rama independiente, sin fusión en `main`.
3. No declarar P1/P2 completamente verificados antes de pruebas dinámicas y migración; no declarar P3–P6 cerrados.
4. No publicar claves ni datos privados en el repositorio público.
