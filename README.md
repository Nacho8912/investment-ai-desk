# Foro Inversor

Escritorio profesional multi-agente para **investigación**, **mesa institucional (IC)** y **estrategia a medida** por capital.

**Stack:** Electron + React + TypeScript + Vite · UI en **español (es-ES)** · tema dark tipo terminal financiero.

> **Aviso:** No es asesoramiento financiero ni un bróker. La rentabilidad pasada no garantiza resultados futuros. Los datos demo son ejemplos ilustrativos.

## Requisitos

- Node.js **20+**
- npm 9+

## Instalación y arranque

```bash
cd /workspace/investment-ai-desk
npm install
npm run dev
```

`npm run dev` abre la **ventana Electron** (Vite + main/preload).

### Build del renderer / empaquetado

```bash
npm run build          # dist/ + dist-electron/
npm run pack:dir       # carpeta empaquetada (electron-builder --dir)
npm run pack:win       # instalador NSIS Windows (x64) → release/
```

La configuración `electron-builder` (objetivo **Windows NSIS**) está en `package.json` → clave `"build"`. En Linux de desarrollo también hay target AppImage.

## Modo demostración (por defecto)

Sin API key la app es usable al completo:

- Investigación mock (AAPL, VWCE, ITX, SAN)
- Mesa institucional con acta y votos
- **Estrategia a medida** según capital EUR, riesgo, horizonte y restricciones
- 32 agentes en plantilla

## OpenRouter (modo live opcional)

Foro Inversor usa un cliente **OpenAI-compatible**. El preset por defecto apunta a **OpenRouter**:

| Campo | Valor por defecto |
|--------|-------------------|
| Base URL | `https://openrouter.ai/api/v1` |
| Modelo | `z-ai/glm-5.3-flashx` (cambiable, p. ej. `anthropic/claude-3.5-sonnet`) |
| API key | vacía (péguela en **Ajustes**; se guarda en `electron-store`, **nunca en el repo**) |

Pasos:

1. Cree una clave en [OpenRouter](https://openrouter.ai/).
2. Abra **Ajustes** en la app.
3. Pegue la API key (no la comparta ni la suba a git).
4. Confirme Base URL `https://openrouter.ai/api/v1` y el modelo deseado.
5. **Desactive** «Modo demostración» y guarde.

En live se envían las cabeceras recomendadas por OpenRouter: `HTTP-Referer` y `X-Title: Foro Inversor`.  
Si la llamada falla, hay **fallback automático al mock**.

> Otros proveedores OpenAI-compatible también funcionan cambiando Base URL + modelo + key.

## Módulos

1. Aviso legal de primer arranque  
2. Inicio (watchlist / briefs / cotizaciones Yahoo Finance con retraso de mercado)  
3. **Estrategia a medida** (flagship por capital)  
4. **Mesa institucional**  
5. Investigación multi-agente  
6. Plantilla de agentes (≥30)  
7. Cartera sandbox  
8. Metodología  
9. Ajustes (OpenRouter)

## Estructura

```
electron/           main, preload, menú nativo, electron-store
src/agents/         roster (32), orchestrator, mock/, llm/ (OpenRouter)
src/pages/          pantallas React
public/icon.png     icono de aplicación
```

## Seguridad

- No hay secretos en el código ni en `.env` de ejemplo con claves reales.
- `.gitignore` excluye `node_modules`, `dist`, `release`, `.env`.
- La API key solo vive en almacenamiento local de la app.

## Licencia

Uso educativo / demostración. Sin garantías.
