# P4/P5 — contratos de resultados de IA y procedencia

**Estado: implementación y pruebas sintéticas en rama; aceptación funcional con proveedor real pendiente.** PR #1 en borrador; no fusionar con `main`.

## Problema comprobado

La versión inicial hacía `JSON.parse` solo del objeto raíz y extendía el resultado sobre un informe de demostración mediante `...getMockBrief(...)`, `...getMockICSession(...)` o `...buildMockStrategy(...)`. Un `{}` podía salir como resultado `live`, incorporando datos de ejemplo. Un cast TypeScript no valida una respuesta externa.

## Cambios aplicados

- `src/agents/llm/validate.ts`: validación runtime completa de los campos obligatorios y estructuras anidadas de `ResearchBrief`, `ICSession`, `StrategyPlan` (composiciones, posiciones, votos, brókeres, propuestas de producto, pasos y notas). No acepta propiedades desconocidas, campos obligatorios ausentes, tipos incorrectos, enumeraciones ilegales, contenido excesivo, estructuras demasiado anidadas ni números no finitos. JSON cercado como bloque completo se admite; texto extraviado se rechaza.
- La app asigna exclusivamente `id`, `createdAt`, `mode: 'live'`, `disclaimer`, `ticker`/`question`/`thesis` e `input` pertinentes. El modelo no puede fijar metadatos o alterar entrada del usuario. Se rechazan participantes fuera de la lista solicitada en investigación.
- Estrategia: `monthlyContributionEur` debe coincidir con la entrada; tres grupos de porcentajes (asignación, productos por aportación, desglose mensual) suman aproximadamente 100 cada uno; los importes totales de productos y desglose deben cuadrar con la aportación mensual; ticker, porcentaje y euros deben corresponder entre producto y fila, sin duplicados. Tolerancias pequeñas para redondeo; rangos 0–100 y montos no negativos.
- `src/agents/llm/client.ts` ya **no mezcla** payload de IA con datos `mock`. El prompt solicita todos los campos y prohíbe inventar cotizaciones, ISIN, comisiones o fuentes, y aclara que se trata de una sola llamada que simula roles, no de especialistas autónomos.
- Si falla la validación, se lanza error y el orquestador existente devuelve resultado **`mode: 'mock'` con advertencia visible**. Una respuesta inválida no se etiqueta `live` ni se rellena parcialmente con contenido de demostración.
- `tests/p4-llm-validation.test.mjs` transpila y ejercita el validador real con respuestas sintéticas válidas e inválidas: objetos vacíos, JSON defectuoso, enums, campos anidados ausentes, metadatos falsificados, agentes no elegidos, datos externos adicionales, sumas y porcentajes inconsistentes, duplicados y desajustes de importe. CI ejecuta tests, TypeScript, compilación, Electron Windows, pruebas hostiles P3 e instalador.

## Límites y aceptación

**Validación estructural y aritmética NO significa veracidad financiera.** Un modelo puede devolver un informe estructuralmente perfecto con precios, tarifas o afirmaciones falsos. No existen en esta fase verificaciones independientes de fuentes, fecha de datos, identidad de ISIN, comisiones vigentes, perfil de riesgo o legitimidad de brókeres. Los `fitScore` y propuestas de producto son salida del modelo, no una evaluación confirmada por la aplicación. El modo `live` significa *respuesta obtenida del proveedor y aceptada por contrato*, nunca *hechos comprobados*.

Pendiente: pruebas end-to-end con respuestas del proveedor reales (sin registrar credenciales), fixtures más amplios con redondeo legítimo, políticas de citas/actualización de mercado, pruebas de rechazo de datos plausibles pero falsos, decisiones de producto sobre mostrar resultado parcial frente a fallback sintético. La prueba local de regresión no comprueba que la API obedezca siempre el esquema; un proveedor incumplidor generará fallback mock de forma explícita.

Evidencia de P3 antes de P4: https://github.com/Nacho8912/investment-ai-desk/actions/runs/35439566602 (pruebas hostiles de navegación, popups, CSP, permisos y subframes en Windows). Comprobar Actions sobre el SHA final de P4 antes de declarar su ejecución completada.
