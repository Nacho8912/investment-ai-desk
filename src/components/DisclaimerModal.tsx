import { useAppState } from '../hooks/useAppState'

export function DisclaimerModal() {
  const { settings, acceptDisclaimer } = useAppState()
  if (settings.disclaimerAccepted) return null

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <span className="badge warn">Aviso importante</span>
        <h2>Antes de continuar</h2>
        <p>
          <strong>Foro Inversor</strong> es un escritorio de análisis con agentes de IA.
          Antes de continuar:
        </p>
        <ul className="clean">
          <li><strong>No está autorizado por la CNMV</strong> como asesor financiero ni ofrece recomendación personalizada.</li>
          <li><strong>No es un bróker</strong>: no ejecuta órdenes ni custodia activos.</li>
          <li><strong>Rentabilidad pasada ≠ resultados futuros.</strong></li>
          <li>Sin API, el plan usa reglas locales; con OpenRouter, salida live (verifique siempre ISINs y tarifas).</li>
        </ul>
        <div className="row" style={{ marginTop: 18 }}>
          <button className="btn btn-primary" onClick={() => void acceptDisclaimer()}>
            He leído y acepto — entrar en la app
          </button>
        </div>
      </div>
    </div>
  )
}
