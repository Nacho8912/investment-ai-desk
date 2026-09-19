import type { AgentContribution, AgentId, ICSession, ResearchBrief, Stance, Conviction } from '../../types'
import { getAgent } from '../roster'

const DISCLAIMER =
  'Foro Inversor no está autorizado por la CNMV como asesor ni actúa como bróker (no ejecuta órdenes ni custodia). No es recomendación personalizada. Rentabilidad pasada ≠ futura.'

function agentName(id: AgentId): string {
  return getAgent(id)?.name ?? id
}

function contrib(
  agentId: AgentId,
  stage: string,
  summary: string,
  facts: string[],
  judgments: string[],
  risks: string[] = [],
  extra: Partial<AgentContribution> = {},
): AgentContribution {
  return {
    agentId,
    agentName: agentName(agentId),
    stage,
    summary,
    facts,
    judgments,
    risks,
    ...extra,
  }
}

/** Briefs mock deterministas — AAPL, VWCE, ITX */
export function getMockBrief(tickerRaw: string, question: string, selected: AgentId[]): ResearchBrief {
  const ticker = tickerRaw.trim().toUpperCase() || 'AAPL'
  const key = ['AAPL', 'VWCE', 'ITX', 'SAN'].includes(ticker) ? ticker : 'AAPL'
  const full = MOCK_BRIEFS[key]
  const filtered = full.contributions.filter(
    (c) => selected.includes(c.agentId) || c.agentId === 'cumplimiento',
  )
  return {
    ...full,
    id: `brief-${key}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    ticker: key,
    question: question || full.question,
    contributions: filtered.length ? filtered : full.contributions,
    mode: 'mock',
    disclaimer: DISCLAIMER,
  }
}

const MOCK_BRIEFS: Record<string, Omit<ResearchBrief, 'id' | 'createdAt' | 'mode' | 'disclaimer' | 'question'> & { question: string }> = {
  AAPL: {
    ticker: 'AAPL',
    question: '¿Qué calidad tiene el negocio de Apple y qué riesgos relevantes hay?',
    stages: ['recopilar', 'analizar', 'debatir', 'sintetizar', 'checklist-riesgo', 'brief-final'],
    contributions: [
      contrib(
        'renta-variable',
        'analizar',
        'Negocio de alta calidad con ecosistema sticky y márgenes elevados (demostración).',
        [
          'Ejemplo: mix de iPhone + servicios suele aportar la mayor parte de ingresos.',
          'Ejemplo: márgenes brutos históricamente altos vs. hardware puro.',
          'Ejemplo: caja neta y generación de FCF recurrentes en periodos recientes.',
        ],
        [
          'Moat percibido: ecosistema + switching costs + marca.',
          'El crecimiento puede depender más de servicios y precios que de unidades.',
        ],
        ['Concentración en iPhone', 'Riesgo geopolítico en cadena de suministro'],
        { stance: 'mantener', conviction: 'alta' },
      ),
      contrib(
        'valoracion-cuant',
        'analizar',
        'Múltiplos elevados respecto a media histórica; la calidad ya está parcialmente descontada (demo).',
        [
          'Ejemplo demo: P/E forward ~28–32× según supuestos de consenso ficticios.',
          'Ejemplo: FCF yield ilustrativo ~3–4%.',
        ],
        [
          'Prima de valoración justifica calidad, pero deja poco margen de error.',
          'Escenarios de desaceleración de márgenes serían sensibles al múltiplo.',
        ],
        ['Compresión de múltiplos si el crecimiento de servicios se frena'],
        { stance: 'mantener', conviction: 'media' },
      ),
      contrib(
        'tecnico',
        'analizar',
        'Tendencia de medio plazo alcista en el ejemplo; volatilidad típica de mega-cap tech.',
        ['Ejemplo: precio por encima de medias móviles 50/200 (datos demo).'],
        ['Timing táctico menos relevante que la tesis de calidad a largo plazo.'],
        ['Drawdowns del 20–35% han ocurrido en el sector en ciclos de riesgo-off'],
        { stance: 'mantener', conviction: 'media' },
      ),
      contrib(
        'macro',
        'analizar',
        'Consumo discrecional y tipos reales elevados pueden pesar sobre hardware premium.',
        ['Ejemplo: ciclo de tipos y dólar fuerte afectan a resultados reportados.'],
        ['Escenario base: aterrizaje suave compatible con demanda estable de servicios.'],
        ['Recesión de consumo en EE. UU. / China'],
        { stance: 'mantener', conviction: 'media' },
      ),
      contrib(
        'dividendos',
        'analizar',
        'Dividendo modesto; el retorno al accionista se apoya más en recompra (demo).',
        ['Ejemplo: yield bajo vs. mercado amplio; payout conservador.'],
        ['Perfil más de total return que de renta.'],
        [],
        { stance: 'mantener', conviction: 'media' },
      ),
      contrib(
        'esg',
        'analizar',
        'Gobernanza generalmente sólida; foco en cadena de suministro y privacidad (educativo).',
        ['Ejemplo: reportes de sostenibilidad publicados (referencia genérica demo).'],
        ['Riesgos ESG más operativos que reputacionales extremos en el escenario base.'],
        ['Escrutinio laboral / proveedores'],
        { stance: 'mantener', conviction: 'media' },
      ),
      contrib(
        'liquidez',
        'analizar',
        'Liquidez excelente; spreads estrechos en mercados principales.',
        ['Ejemplo: uno de los valores más negociados del mundo (demo).'],
        ['Impacto de mercado irrelevante para tamaños retail típicos.'],
        [],
        { stance: 'comprar', conviction: 'alta' },
      ),
      contrib(
        'fiscal',
        'analizar',
        'Notas educativas ES: plusvalías en IRPF; dividendos sujetos a retención según régimen.',
        ['Información general: no sustituye asesoramiento fiscal personalizado.'],
        ['La fiscalidad de recompras es indirecta vía apreciación.'],
        [],
        { stance: 'insuficiente', conviction: 'baja' },
      ),
      contrib(
        'scouting',
        'analizar',
        'Catalizadores típicos: ciclo de producto, eventos de servicios, resultados trimestrales.',
        ['Ejemplo demo: ventana de atención alrededor de lanzamientos y earnings.'],
        ['No anticipar surprises; usar catalizadores como calendario de revisión.'],
        [],
        { stance: 'mantener', conviction: 'media' },
      ),
      contrib(
        'smallcaps-growth',
        'analizar',
        'No es small cap; perfil mega-cap con crecimiento más maduro.',
        [],
        ['Asimetría upside/downside distinta a growth temprano.'],
        [],
        { stance: 'mantener', conviction: 'media' },
      ),
      contrib(
        'etfs-fondos',
        'analizar',
        'Si el objetivo es exposición tech/EE. UU., un ETF amplio puede diversificar mejor el riesgo idiosincrático.',
        ['Ejemplo: AAPL suele tener peso material en índices S&P 500 / MSCI World (demo).'],
        ['Single-stock vs. ETF: trade-off concentración vs. simplicidad.'],
        [],
        { stance: 'mantener', conviction: 'media' },
      ),
      contrib(
        'renta-fija',
        'analizar',
        'Poco relevante como activo de duration; el «bono» implícito es la calidad del FCF.',
        [],
        ['En carteras mixtas, AAPL es sleeve de renta variable, no sustituto de RF.'],
        [],
        { stance: 'insuficiente', conviction: 'baja' },
      ),
      contrib(
        'riesgo-cartera',
        'checklist-riesgo',
        'Riesgo de concentración si ya hay overweight en tech EE. UU. vía ETF + acción.',
        ['Ejemplo: correlación alta con NASDAQ en episodios de riesgo.'],
        ['Limitar peso single-name; revisar overlap con VWCE/S&P.'],
        ['Correlación con resto de cartera growth', 'Divisa USD para inversor EUR'],
        { stance: 'mantener', conviction: 'alta' },
      ),
      contrib(
        'abogado-diablo',
        'debatir',
        'La tesis de calidad puede ocultar complacencia: valoración + dependencia de iPhone.',
        [
          'Hecho ilustrativo: caídas históricas tras ciclos de producto decepcionantes.',
          'Hecho ilustrativo: presión regulatoria Antitrust / App Store en varias jurisdicciones.',
        ],
        [
          '¿Y si el crecimiento de servicios se satura?',
          '¿Y si un ciclo de hardware débil coincide con compresión de múltiplos?',
        ],
        ['Regulación de comisiones de tienda', 'Sustitución por Android en emergentes'],
        { stance: 'evitar', conviction: 'media', dissentNote: 'Más cauto que el consenso de la mesa' },
      ),
      contrib(
        'cumplimiento',
        'brief-final',
        'Recordatorio: contenido educativo y de demostración. No es recomendación personalizada.',
        ['El producto no ejecuta órdenes ni custodia activos.'],
        ['El usuario debe contrastar con fuentes oficiales y, si procede, con un profesional autorizado.'],
        [],
      ),
    ],
    synthesis: {
      title: 'Brief sintético — AAPL (demostración)',
      bullCase: [
        'Ecosistema y servicios con alta recurrencia (juicio).',
        'Balance y FCF robustos en el ejemplo demo.',
        'Liquidez y cobertura analítica excelentes.',
      ],
      bearCase: [
        'Valoración exige ejecución casi impecable.',
        'Dependencia del ciclo iPhone y de China/cadena de suministro.',
        'Riesgo regulatorio sobre el modelo de App Store.',
      ],
      risks: [
        'Concentración sectorial/tech en cartera.',
        'Compresión de múltiplos.',
        'Eventos geopolíticos en supply chain.',
      ],
      uncertainties: [
        'Ritmo real de crecimiento de Servicios a 3–5 años.',
        'Elasticidad de demanda a precios premium en desaceleración.',
      ],
      finalStance: 'mantener',
      executiveSummary:
        'En modo demostración, el consenso inclina a Mantener: negocio de calidad, pero con valoración y riesgos de concentración que desaconsejan euforia. El Abogado del diablo vota más cauto. No es asesoramiento financiero.',
    },
    disagreements: [
      {
        topic: 'Nivel de valoración vs. calidad',
        positions: [
          { agent: 'Analista de renta variable', view: 'Prima justificable por moat' },
          { agent: 'Analista de valoración cuantitativa', view: 'Poco margen de error en múltiplos' },
          { agent: 'Abogado del diablo', view: 'Asimetría sesgada a la baja si fallan catalizadores' },
        ],
      },
    ],
  },

  VWCE: {
    ticker: 'VWCE',
    question: '¿Es VWCE un núcleo razonable de cartera a largo plazo?',
    stages: ['recopilar', 'analizar', 'debatir', 'sintetizar', 'checklist-riesgo', 'brief-final'],
    contributions: [
      contrib(
        'etfs-fondos',
        'analizar',
        'ETF UCITS de renta variable global: herramienta típica de núcleo diversificado (demo).',
        [
          'Ejemplo: exposición FTSE All-World (desarrollados + emergentes).',
          'Ejemplo: acumulación (Acc) — reinversión de dividendos en el fondo.',
          'Ejemplo: TER competitivo en su categoría (dato ilustrativo).',
        ],
        [
          'Adecuado como building block de RV global para horizontes largos.',
          'Réplica y tracking deben revisarse en el KIID/factsheet oficial.',
        ],
        ['Tracking error', 'Riesgo de contraparte en réplica sintética si aplicara (verificar)'],
        { stance: 'comprar', conviction: 'alta' },
      ),
      contrib(
        'macro',
        'analizar',
        'Beta al crecimiento global y a la prima de riesgo de RV; sensible a tipos reales y USD.',
        ['Ejemplo: peso elevado en EE. UU. / tech en índices globales actuales (demo).'],
        ['Diversificación geográfica no elimina riesgo de mercado.'],
        ['Bear market global', 'Fortaleza extrema del EUR vs. cesta de divisas'],
        { stance: 'mantener', conviction: 'media' },
      ),
      contrib(
        'renta-fija',
        'analizar',
        'VWCE es 100% RV; no aporta duration de bonos. Para tipos, hace falta un sleeve de RF aparte.',
        [],
        ['Complementar con ETF de RF según horizonte y tolerancia.'],
        [],
        { stance: 'insuficiente', conviction: 'media' },
      ),
      contrib(
        'riesgo-cartera',
        'checklist-riesgo',
        'Buen diversificador idiosincrático; el riesgo principal es beta de mercado.',
        ['Ejemplo: drawdowns históricos de RV global ~30–50% en crisis (orden de magnitud educativo).'],
        ['Definir horizonte ≥10 años reduce la probabilidad de vender en pánico.'],
        ['Sesgo home bias si se combina mal con acciones locales'],
        { stance: 'comprar', conviction: 'alta' },
      ),
      contrib(
        'fiscal',
        'analizar',
        'Notas ES (educativas): los ETF UCITS acumulativos pueden diferir la tributación de dividendos vs. distribución.',
        ['Régimen concreto depende de situación personal — consultar profesional.'],
        ['Traspasos entre fondos españoles tienen particularidades; ETF cotizados suelen seguir reglas de acciones.'],
        [],
        { stance: 'mantener', conviction: 'baja' },
      ),
      contrib(
        'liquidez',
        'analizar',
        'Liquidez generalmente buena en bolsas europeas principales; vigilar spread en horarios ilíquidos.',
        ['Ejemplo demo: negociado en Xetra / Borsa Italiana etc.'],
        ['Usar órdenes limitadas en aperturas volátiles.'],
        ['Spread intradía en sesiones de baja actividad'],
        { stance: 'comprar', conviction: 'alta' },
      ),
      contrib(
        'valoracion-cuant',
        'analizar',
        'El índice no está «barato» ni «caro» de forma binaria; CAPE/forward P/E globales en zona media-alta (demo).',
        [],
        ['El dollar-cost averaging mitiga el timing.'],
        ['Década de retornos reales más bajos si se parte de múltiplos elevados'],
        { stance: 'mantener', conviction: 'media' },
      ),
      contrib(
        'esg',
        'analizar',
        'No es un ETF ESG excluido; incluye sectores amplios del mercado.',
        [],
        ['Si hay mandato ESG estricto, valorar variantes con screening.'],
        [],
        { stance: 'mantener', conviction: 'media' },
      ),
      contrib(
        'abogado-diablo',
        'debatir',
        '«Comprar el mundo» no inmuniza: concentración EE. UU./tech y riesgo de década perdida tras valoraciones altas.',
        ['Hecho ilustrativo: pesos sectoriales cambian con el tiempo.'],
        ['¿Está el usuario preparado emocionalmente para -40%?'],
        ['Sobreconfianza por diversificación aparente'],
        { stance: 'mantener', conviction: 'media', dissentNote: 'Acepta el núcleo pero exige plan de aportaciones' },
      ),
      contrib(
        'cumplimiento',
        'brief-final',
        'Demo educativa. Verifique folleto/KIID del emisor antes de cualquier decisión.',
        [],
        [],
        [],
      ),
      contrib(
        'renta-variable',
        'analizar',
        'No analiza una empresa: es un vehículo indexado multi-emisor.',
        [],
        ['La «calidad» es la del mercado cotizado global.'],
        [],
        { stance: 'comprar', conviction: 'media' },
      ),
      contrib(
        'scouting',
        'analizar',
        'Catalizadores: revisiones de índice, ciclos de tipos, seasonality de aportaciones.',
        [],
        ['Mejor calendario de aportaciones que intentar acertar el mínimo.'],
        [],
        { stance: 'comprar', conviction: 'media' },
      ),
    ],
    synthesis: {
      title: 'Brief sintético — VWCE (demostración)',
      bullCase: [
        'Diversificación amplia en un solo vehículo UCITS.',
        'Costes contenidos y operativa sencilla (demo).',
        'Adecuado como núcleo de RV para horizontes largos.',
      ],
      bearCase: [
        'No elimina el riesgo de mercado ni la concentración geográfica actual.',
        'Retornos futuros inciertos tras periodos de múltiplos elevados.',
        'Sin sleeve de RF no amortigua tipos/recesión.',
      ],
      risks: ['Drawdown de mercado', 'Sesgo EE. UU./tech', 'Error de seguimiento'],
      uncertainties: ['Rentabilidad real a 10 años', 'Evolución del peso emergente'],
      finalStance: 'comprar',
      executiveSummary:
        'Consenso demo: Comprar/ Mantener como núcleo de cartera, condicionado a horizonte largo y tolerancia a volatilidad. Complementar con renta fija según perfil. No es asesoramiento financiero.',
    },
    disagreements: [
      {
        topic: '¿Entrada única o aportaciones periódicas?',
        positions: [
          { agent: 'Especialista en ETFs y fondos', view: 'Núcleo válido; DCA razonable' },
          { agent: 'Analista de valoración cuantitativa', view: 'Múltiplos no baratos → priorizar DCA' },
          { agent: 'Abogado del diablo', view: 'Sin plan de aportaciones, riesgo conductual alto' },
        ],
      },
    ],
  },

  ITX: {
    ticker: 'ITX',
    question: 'Inditex (IBEX): calidad del modelo y riesgos de valoración',
    stages: ['recopilar', 'analizar', 'debatir', 'sintetizar', 'checklist-riesgo', 'brief-final'],
    contributions: [
      contrib(
        'renta-variable',
        'analizar',
        'Modelo vertically integrated de moda con rotación alta y escala global (demo IBEX).',
        [
          'Ejemplo: marca Zara como motor; integración diseño-producción-distribución.',
          'Ejemplo: márgenes y ROIC históricamente atractivos en el sector (ilustrativo).',
        ],
        ['Moat: escala + velocidad de respuesta a tendencias + logística.'],
        ['Moda cíclica', 'Ejecución en e-commerce y costes'],
        { stance: 'mantener', conviction: 'alta' },
      ),
      contrib(
        'valoracion-cuant',
        'analizar',
        'Suele cotizar con prima vs. retail europeo por calidad; vigilar PEG y FCF (demo).',
        ['Ejemplo demo: múltiplos por encima de peers de menor calidad.'],
        ['Prima merecida solo si el growth/márgenes se sostienen.'],
        ['De-rating si el LFL se debilita'],
        { stance: 'mantener', conviction: 'media' },
      ),
      contrib(
        'macro',
        'analizar',
        'Sensible a consumo europeo/latam y a costes energéticos/logísticos.',
        [],
        ['Escenario de estanflación europea sería headwind.'],
        ['Debilidad del consumidor UE'],
        { stance: 'mantener', conviction: 'media' },
      ),
      contrib(
        'esg',
        'analizar',
        'Sector con foco en cadena textil, residuos y condiciones laborales (educativo).',
        [],
        ['Progreso en sostenibilidad es material reputacional.'],
        ['Riesgo supply-chain social'],
        { stance: 'mantener', conviction: 'media' },
      ),
      contrib(
        'dividendos',
        'analizar',
        'Históricamente repartidora; yield y payout dependen del ciclo (demo).',
        [],
        ['Perfil total return + dividendo, no high-yield puro.'],
        [],
        { stance: 'mantener', conviction: 'media' },
      ),
      contrib(
        'fiscal',
        'analizar',
        'Acción española: plusvalías y dividendos bajo IRPF según tramos (nota general).',
        ['No es asesoramiento fiscal.'],
        [],
        [],
        { stance: 'insuficiente', conviction: 'baja' },
      ),
      contrib(
        'liquidez',
        'analizar',
        'Alta liquidez en IBEX / mercados españoles.',
        [],
        [],
        [],
        { stance: 'comprar', conviction: 'alta' },
      ),
      contrib(
        'scouting',
        'analizar',
        'Catalizadores: resultados, guidance de márgenes, aperturas/online, tipo de cambio.',
        [],
        [],
        [],
        { stance: 'mantener', conviction: 'media' },
      ),
      contrib(
        'riesgo-cartera',
        'checklist-riesgo',
        'Home bias: muchos inversores ES ya tienen exposición vía fondos/IBEX.',
        [],
        ['Revisar overlap con índices españoles.'],
        ['Concentración geográfica ES/EU'],
        { stance: 'mantener', conviction: 'media' },
      ),
      contrib(
        'abogado-diablo',
        'debatir',
        '¿La excelencia operativa ya está en el precio? Competencia online y fatiga del consumidor.',
        [],
        ['Un miss de márgenes puede castigar fuerte tras años de outperformance.'],
        ['Competencia Shein/Temu en precio', 'Riesgo de moda fallida en temporada'],
        { stance: 'evitar', conviction: 'media', dissentNote: 'Prefiere esperar mejor entrada' },
      ),
      contrib(
        'cumplimiento',
        'brief-final',
        'Ejemplo IBEX de demostración. No es recomendación.',
        [],
        [],
        [],
      ),
      contrib(
        'tecnico',
        'analizar',
        'Estructura de largo plazo alcista en el ejemplo demo; respetar soportes mayores.',
        [],
        [],
        [],
        { stance: 'mantener', conviction: 'media' },
      ),
      contrib(
        'etfs-fondos',
        'analizar',
        'Alternativa: ETF IBEX/Europa si se busca diversificar el single-name.',
        [],
        [],
        [],
        { stance: 'mantener', conviction: 'media' },
      ),
    ],
    synthesis: {
      title: 'Brief sintético — ITX Inditex (demostración IBEX)',
      bullCase: [
        'Modelo operativo diferencial en moda.',
        'Marca y escala global.',
        'Liquidez y seguimiento elevados en mercado español.',
      ],
      bearCase: [
        'Prima de valoración.',
        'Ciclo de consumo europeo.',
        'Riesgos ESG de cadena textil.',
      ],
      risks: ['Home bias', 'Miss de márgenes', 'Competencia ultra-fast fashion'],
      uncertainties: ['Elasticidad del consumidor 2026+', 'Mix online vs tienda'],
      finalStance: 'mantener',
      executiveSummary:
        'Consenso demo: Mantener. Calidad alta, pero el Abogado del diablo marca valoración y ciclo. Verificar overlap con IBEX. No es asesoramiento financiero.',
    },
    disagreements: [
      {
        topic: '¿Entrar ya o esperar pullback?',
        positions: [
          { agent: 'Analista de renta variable', view: 'Calidad para mantener' },
          { agent: 'Abogado del diablo', view: 'Evitar hasta mejor precio' },
          { agent: 'Analista técnico', view: 'Respetar estructura; no forzar' },
        ],
      },
    ],
  },

  SAN: {
    ticker: 'SAN',
    question: 'Banco Santander — riesgos de crédito, tipos y capital (demo)',
    stages: ['recopilar', 'analizar', 'debatir', 'sintetizar', 'checklist-riesgo', 'brief-final'],
    contributions: [
      contrib(
        'renta-variable',
        'analizar',
        'Banco diversificado LatAm/Europa; sensible a ciclo de crédito y NIM (demo).',
        [],
        ['Calidad intrínseca ligada a underwriting y regulación.'],
        ['Provisiones', 'Riesgo LatAm'],
        { stance: 'mantener', conviction: 'media' },
      ),
      contrib(
        'macro',
        'analizar',
        'Beneficiario potencial de tipos altos vía margen; riesgo si llega recesión con paro.',
        [],
        [],
        ['Aterrizaje duro'],
        { stance: 'mantener', conviction: 'media' },
      ),
      contrib(
        'dividendos',
        'analizar',
        'Política de retribución relevante para inversores de renta; sujeta a capital regulatorio.',
        [],
        [],
        ['Recorte si CET1 se tensiona'],
        { stance: 'mantener', conviction: 'media' },
      ),
      contrib(
        'abogado-diablo',
        'debatir',
        'Bancos parecen «baratos» hasta que el ciclo de crédito gira.',
        [],
        ['Apalancamiento intrínseco del modelo bancario.'],
        [],
        { stance: 'evitar', conviction: 'media' },
      ),
      contrib(
        'riesgo-cartera',
        'checklist-riesgo',
        'Correlacionado con ciclo ES/EU y con otros financieros de cartera.',
        [],
        [],
        [],
        { stance: 'mantener', conviction: 'media' },
      ),
      contrib(
        'cumplimiento',
        'brief-final',
        'Demo IBEX financiero. No es recomendación.',
        [],
        [],
        [],
      ),
    ],
    synthesis: {
      title: 'Brief sintético — SAN (demostración)',
      bullCase: ['Diversificación geográfica', 'Apalancamiento a tipos (fase)'],
      bearCase: ['Ciclo de crédito', 'Regulación de capital'],
      risks: ['LatAm', 'Provisiones', 'Sentimiento hacia bancos'],
      uncertainties: ['Trayectoria de tipos BCE', 'Calidad crediticia 12–24m'],
      finalStance: 'mantener',
      executiveSummary: 'Demo: Mantener con cautela cíclica. Disenso del red team hacia Evitar. No es asesoramiento.',
    },
    disagreements: [
      {
        topic: '¿Value trap bancario?',
        positions: [
          { agent: 'Estratega de dividendos e ingresos', view: 'Renta atractiva si capital estable' },
          { agent: 'Abogado del diablo', view: 'Evitar hasta clarificar ciclo' },
        ],
      },
    ],
  },
}

/** Sesión completa de Mesa Institucional (IC) — demo impresionante */
export function getMockICSession(tickerRaw: string, thesis: string): ICSession {
  const ticker = tickerRaw.trim().toUpperCase() || 'AAPL'
  const key = ['AAPL', 'VWCE', 'ITX'].includes(ticker) ? ticker : 'AAPL'
  const base = MOCK_IC[key]
  return {
    ...base,
    id: `ic-${key}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    ticker: key,
    thesis: thesis || base.thesis,
    mode: 'mock',
    disclaimer: DISCLAIMER,
  }
}

const stanceLabel = (s: Stance) =>
  ({ comprar: 'Comprar', mantener: 'Mantener', evitar: 'Evitar', insuficiente: 'Insuficiente información' })[s]

function vote(id: AgentId, stance: Stance, conviction: Conviction, oneLiner: string) {
  return { agentId: id, agentName: agentName(id), stance, conviction, oneLiner }
}

const MOCK_IC: Record<string, Omit<ICSession, 'id' | 'createdAt' | 'mode' | 'disclaimer' | 'thesis' | 'ticker'> & { thesis: string; ticker: string }> = {
  AAPL: {
    ticker: 'AAPL',
    thesis: 'Apple como posición de calidad a largo plazo con techo de valoración moderado.',
    openingBrief:
      'El CIO abre la sesión: objetivo — evaluar si AAPL merece capital incremental frente a un ETF global. Horizonte ilustrativo 5+ años. Datos de mercado: demostración. Se solicita rigor, disenso explícito y votación formal.',
    rounds: [
      {
        agentId: 'renta-variable',
        agentName: agentName('renta-variable'),
        view: 'Negocio excepcional; el debate no es la calidad sino el precio y la concentración.',
        facts: ['Ecosistema y servicios (demo)', 'FCF recurrente (demo)'],
        judgments: ['Moat amplio', 'Crecimiento más maduro'],
      },
      {
        agentId: 'valoracion-cuant',
        agentName: agentName('valoracion-cuant'),
        view: 'Múltiplos descontando excelencia; upside asimétrico limitado en escenario base.',
        facts: ['P/E forward ilustrativo elevado'],
        judgments: ['Mantener, no incrementar agresivamente'],
      },
      {
        agentId: 'macro',
        agentName: agentName('macro'),
        view: 'Fondo macro neutral-cauto para hardware premium.',
        facts: ['Tipos reales y consumo (demo)'],
        judgments: ['No vetar, pero sin prisa'],
      },
      {
        agentId: 'riesgo-cartera',
        agentName: agentName('riesgo-cartera'),
        view: 'Solo si el peso tech EE. UU. agregado permanece bajo control.',
        facts: ['Overlap con índices globales'],
        judgments: ['Tope de posición single-name'],
      },
      {
        agentId: 'scouting',
        agentName: agentName('scouting'),
        view: 'Calendario de producto y earnings como puntos de revisión, no de trading especulativo.',
        facts: [],
        judgments: ['Catalizadores = checkpoints'],
      },
      {
        agentId: 'liquidez',
        agentName: agentName('liquidez'),
        view: 'Sin fricciones de ejecución relevantes.',
        facts: ['Liquidez top-tier'],
        judgments: ['Neutro operativo'],
      },
    ],
    challenges: [
      {
        from: 'Abogado del diablo',
        to: 'Analista de renta variable',
        challenge:
          'Si el moat es tan claro, ¿por qué el mercado no lo ha pagado ya por completo? ¿Qué falsaría la tesis en 24 meses?',
        reply:
          'Falsación: estancamiento de Servicios + ciclo iPhone débil + múltiplo en percentil alto. Por eso propongo Mantener, no Comprar agresivo.',
      },
      {
        from: 'Abogado del diablo',
        to: 'Agente de riesgo y cartera',
        challenge:
          '¿No estamos racionalizando una posición que el inversor ya tiene vía VWCE/S&P?',
        reply:
          'Correcto: el overlap es el riesgo oculto. Sin presupuesto de riesgo libre, el voto es Mantener/ Evitar incremento.',
      },
    ],
    votes: [
      vote('renta-variable', 'mantener', 'alta', 'Calidad sí; incrementar solo con disciplina de peso'),
      vote('valoracion-cuant', 'mantener', 'media', 'Poco margen de seguridad en múltiplos'),
      vote('tecnico', 'mantener', 'media', 'Estructura ok; no es señal de compra táctica'),
      vote('macro', 'mantener', 'media', 'Fondo aceptable, no exuberante'),
      vote('riesgo-cartera', 'mantener', 'alta', 'Condicionado a límites de concentración'),
      vote('etfs-fondos', 'mantener', 'media', 'Preferible reforzar núcleo ETF si faltaba RV'),
      vote('dividendos', 'mantener', 'baja', 'No es tesis de renta'),
      vote('esg', 'mantener', 'media', 'Sin veto ESG material en demo'),
      vote('liquidez', 'comprar', 'alta', 'Ejecución impecable — voto operativo'),
      vote('scouting', 'mantener', 'media', 'Esperar checkpoints'),
      vote('smallcaps-growth', 'mantener', 'baja', 'Perfil maduro'),
      vote('fiscal', 'insuficiente', 'baja', 'Sin datos fiscales personales'),
      vote('renta-fija', 'insuficiente', 'baja', 'Fuera de mandato RF'),
      vote('abogado-diablo', 'evitar', 'media', 'Mejor esperar o rotar a índice'),
      vote('cumplimiento', 'insuficiente', 'alta', 'No emite recomendación de inversión'),
    ],
    recommendation: 'mantener',
    convictionAggregate: 'media',
    actaMemo: `ACTA DE COMITÉ DE INVERSIONES (DEMOSTRACIÓN) — AAPL

Presidencia / CIO: se declara abierta la mesa. Tesis presentada: calidad a largo plazo con techo de valoración.

1) Apertura: se acepta que la calidad del negocio es alta (hecho relativo al modelo; juicios sobre moat).
2) Ronda de vistas: mayoría se inclina a Mantener. Liquidez vota Comprar (criterio operativo). Valoración y Riesgo subrayan margen de seguridad limitado y overlap con índices.
3) Red team: el Abogado del diablo desafía complacencia y overlap; propone Evitar incremento.
4) Votación formal: banda recomendada → MANTENER (convicción agregada MEDIA).
5) Condiciones: (i) tope de peso single-name, (ii) revisión tras earnings/ciclo de producto, (iii) no incrementar si tech EE. UU. ya está overweight.

Disenso registrado: Abogado del diablo (Evitar); Liquidez (Comprar); Cumplimiento y Fiscal (Insuficiente — fuera de mandato de recomendación).

Recomendación de mesa (educativa): Mantener. No es asesoramiento financiero ni oferta de servicios de inversión.`,
    dissentSummary:
      'Disenso material: Abogado del diablo (Evitar) vs. mayoría Mantener; Liquidez (Comprar) por criterios de microestructura, no de valoración.',
  },

  VWCE: {
    ticker: 'VWCE',
    thesis: 'Usar VWCE como núcleo de renta variable global mediante aportaciones periódicas.',
    openingBrief:
      'CIO: decisión de asignación estratégica, no stock-picking. Se evalúa VWCE como building block. Modo demostración.',
    rounds: [
      {
        agentId: 'etfs-fondos',
        agentName: agentName('etfs-fondos'),
        view: 'Vehículo adecuado como núcleo UCITS Acc.',
        facts: ['FTSE All-World', 'TER contenido (demo)'],
        judgments: ['Comprar / reforzar con DCA'],
      },
      {
        agentId: 'riesgo-cartera',
        agentName: agentName('riesgo-cartera'),
        view: 'Riesgo = beta; gestionar con horizonte y sleeve de RF.',
        facts: [],
        judgments: ['Aprobar con política de aportaciones'],
      },
      {
        agentId: 'renta-fija',
        agentName: agentName('renta-fija'),
        view: 'VWCE no sustituye bonos; proponer cartera mixta según edad/objetivo.',
        facts: [],
        judgments: ['Complementar, no reemplazar'],
      },
      {
        agentId: 'valoracion-cuant',
        agentName: agentName('valoracion-cuant'),
        view: 'Entrada fraccionada preferible a lump-sum único tras múltiplos elevados (demo).',
        facts: [],
        judgments: ['DCA'],
      },
      {
        agentId: 'fiscal',
        agentName: agentName('fiscal'),
        view: 'Notas generales ES sobre acumulación vs distribución; sin dictamen personalizado.',
        facts: [],
        judgments: ['Insuficiente sin encaje personal'],
      },
    ],
    challenges: [
      {
        from: 'Abogado del diablo',
        to: 'Especialista en ETFs y fondos',
        challenge: '¿Diversificación real o concentración disfrazada en EE. UU./tech?',
        reply: 'Concentración de mercado actual es real; se mitiga con horizonte y, si se desea, tilts conscientes — no con ilusión de seguridad.',
      },
      {
        from: 'Abogado del diablo',
        to: 'Agente de riesgo y cartera',
        challenge: '¿El cliente sobrevivirá un -40% sin vender?',
        reply: 'Solo con educación previa y plan escrito de aportaciones. Si no, reducir beta o aumentar RF.',
      },
    ],
    votes: [
      vote('etfs-fondos', 'comprar', 'alta', 'Núcleo válido'),
      vote('riesgo-cartera', 'comprar', 'alta', 'Con plan de horizonte'),
      vote('macro', 'mantener', 'media', 'Beta global aceptable'),
      vote('valoracion-cuant', 'comprar', 'media', 'Vía DCA'),
      vote('renta-fija', 'mantener', 'media', 'Aprobar RV + diseñar RF'),
      vote('liquidez', 'comprar', 'alta', 'Ejecutable'),
      vote('fiscal', 'insuficiente', 'baja', 'Sin datos personales'),
      vote('esg', 'mantener', 'media', 'No ESG-screened'),
      vote('abogado-diablo', 'mantener', 'media', 'Sí con condiciones conductuales'),
      vote('cumplimiento', 'insuficiente', 'alta', 'Sin recomendación personalizada'),
      vote('scouting', 'comprar', 'media', 'Aportar en calendario'),
      vote('renta-variable', 'comprar', 'media', 'Exposición a mercado cotizado'),
      vote('dividendos', 'mantener', 'baja', 'Acc — no busca yield'),
      vote('tecnico', 'mantener', 'baja', 'Timing secundario'),
      vote('smallcaps-growth', 'mantener', 'baja', 'No es small-cap'),
    ],
    recommendation: 'comprar',
    convictionAggregate: 'alta',
    actaMemo: `ACTA DE COMITÉ (DEMO) — VWCE

Decisión de mesa: COMPRAR / reforzar como núcleo de RV global, preferentemente con aportaciones periódicas.
Condiciones: (1) horizonte largo, (2) definir sleeve de renta fija, (3) documentar tolerancia a drawdown.
Disenso: menor — Abogado del diablo condiciona a disciplina conductual; Fiscal/Cumplimiento no emiten buy-call.
No es asesoramiento financiero.`,
    dissentSummary: 'Disenso limitado; debate centrado en condiciones de ejecución y conducta, no en el vehículo en sí.',
  },

  ITX: {
    ticker: 'ITX',
    thesis: 'Inditex como compounder europeo de calidad dentro del IBEX.',
    openingBrief: 'CIO: evaluación single-name IBEX. Separar calidad de negocio vs. precio de entrada. Demo.',
    rounds: [
      {
        agentId: 'renta-variable',
        agentName: agentName('renta-variable'),
        view: 'Uno de los mejores modelos de retail europeos.',
        facts: ['Integración vertical (demo)'],
        judgments: ['Mantener / calidad'],
      },
      {
        agentId: 'valoracion-cuant',
        agentName: agentName('valoracion-cuant'),
        view: 'Prima exigente.',
        facts: [],
        judgments: ['No perseguir'],
      },
      {
        agentId: 'esg',
        agentName: agentName('esg'),
        view: 'Cadena textil bajo escrutinio; monitorear.',
        facts: [],
        judgments: ['Sin veto automático en demo'],
      },
      {
        agentId: 'riesgo-cartera',
        agentName: agentName('riesgo-cartera'),
        view: 'Cuidado con home bias español.',
        facts: [],
        judgments: ['Tope de peso'],
      },
    ],
    challenges: [
      {
        from: 'Abogado del diablo',
        to: 'Analista de renta variable',
        challenge: '¿Cuánto de la excelencia ya está en el precio?',
        reply: 'Gran parte; por eso Mantener > Comprar agresivo.',
      },
    ],
    votes: [
      vote('renta-variable', 'mantener', 'alta', 'Calidad'),
      vote('valoracion-cuant', 'mantener', 'media', 'Prima'),
      vote('abogado-diablo', 'evitar', 'media', 'Esperar entrada'),
      vote('macro', 'mantener', 'media', 'Consumo EU'),
      vote('esg', 'mantener', 'media', 'Vigilancia'),
      vote('dividendos', 'mantener', 'media', 'Total return'),
      vote('riesgo-cartera', 'mantener', 'alta', 'Home bias'),
      vote('liquidez', 'comprar', 'alta', 'Liquidez IBEX'),
      vote('tecnico', 'mantener', 'media', 'Estructura'),
      vote('scouting', 'mantener', 'media', 'Earnings'),
      vote('etfs-fondos', 'mantener', 'media', 'Alternativa índice EU'),
      vote('fiscal', 'insuficiente', 'baja', 'Nota general'),
      vote('cumplimiento', 'insuficiente', 'alta', 'Sin recomendación'),
      vote('renta-fija', 'insuficiente', 'baja', 'N/A'),
      vote('smallcaps-growth', 'mantener', 'baja', 'Large cap'),
    ],
    recommendation: 'mantener',
    convictionAggregate: 'media',
    actaMemo: `ACTA IC (DEMO) — ITX

Recomendación de mesa: MANTENER.
Disenso: Abogado del diablo (Evitar) por valoración; Liquidez (Comprar) por microestructura.
Condiciones: controlar home bias; revisar márgenes y LFL.
No es asesoramiento financiero.`,
    dissentSummary: 'Red team más cauto (Evitar); resto mayoritario en Mantener.',
  },
}

export { DISCLAIMER, stanceLabel }
