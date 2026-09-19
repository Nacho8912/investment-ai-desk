import { AGENT_ROSTER } from '../agents/roster'

export function MethodologyPage() {
  return (
    <div>
      <h1 className="page-title">Metodología</h1>
      <p className="page-sub">
        Cómo Foro Inversor estructura investigación, mesa IC y estrategia a medida ({AGENT_ROSTER.length} agentes)
      </p>
      <div className="grid grid-2">
        <div className="card">
          <h2>Investigación</h2>
          <ol>
            <li>Recopilar → Analizar → Debatir → Sintetizar → Riesgo → Brief</li>
            <li>Hechos (verde) vs juicios (violeta) vs riesgos (rojo)</li>
            <li>Desacuerdos explícitos entre agentes</li>
          </ol>
        </div>
        <div className="card">
          <h2>Mesa institucional</h2>
          <ol>
            <li>Apertura CIO → ronda → red team → votación → acta</li>
            <li>Bandas: Comprar / Mantener / Evitar / Insuficiente información</li>
          </ol>
        </div>
        <div className="card">
          <h2>Estrategia a medida</h2>
          <ol>
            <li>Capital EUR, horizonte, riesgo, metas, restricciones</li>
            <li>Asignación + universo demo UCITS + checklist</li>
            <li>Filtro de liquidez según tamaño de cuenta</li>
            <li>Brief imprimible + disenso</li>
          </ol>
        </div>
        <div className="card">
          <h2>Límites</h2>
          <ul className="clean">
            <li>Educativo; no recomendación personalizada.</li>
            <li>Demo offline completa; OpenRouter opcional.</li>
            <li>Notas fiscales = información general ES.</li>
            <li>Pasado ≠ futuro.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
