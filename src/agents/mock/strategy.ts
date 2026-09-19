import type {
  AgentContribution,
  AllocationSlice,
  BrokerIdea,
  ProductIdea,
  StrategyInput,
  StrategyPlan,
  StrategyStep,
  MonthlyBreakdownRow,
  RiskTolerance,
  InvestGoal,
  HorizonCode,
} from '../../types'
import { getAgent } from '../roster'
import { DISCLAIMER } from './demos'

const VERIFY = 'verifique tarifas actuales en el bróker'

function note(
  agentId: string,
  summary: string,
  facts: string[],
  judgments: string[],
  risks: string[] = [],
): AgentContribution {
  const a = getAgent(agentId)
  return {
    agentId,
    agentName: a?.name ?? agentId,
    stage: 'estrategia',
    summary,
    facts,
    judgments,
    risks,
  }
}

function mixFor(risk: RiskTolerance, goal: InvestGoal, horizon: HorizonCode): AllocationSlice[] {
  let rv = 60, rf = 30, cash = 5, alt = 5
  if (risk === 'conservador') { rv = 30; rf = 55; cash = 10; alt = 5 }
  if (risk === 'moderado') { rv = 50; rf = 40; cash = 5; alt = 5 }
  if (risk === 'dinamico') { rv = 70; rf = 22; cash = 3; alt = 5 }
  if (risk === 'agresivo') { rv = 85; rf = 10; cash = 2; alt = 3 }
  if (goal === 'preservacion') { rv = Math.min(rv, 35); rf = 100 - rv - 10; cash = 10; alt = 0 }
  if (goal === 'ingresos') { rv = Math.min(rv, 45); rf = 45; cash = 5; alt = 5 }
  if (goal === 'crecimiento') { rv = Math.max(rv, 65); cash = Math.min(cash, 5) }
  if (horizon === 'corto') { cash += 10; rv = Math.max(15, rv - 15); rf = 100 - rv - cash - alt }
  if (horizon === 'jubilacion' && risk !== 'agresivo') { rf = Math.max(rf, 35); rv = 100 - rf - cash - alt }

  const slices: AllocationSlice[] = [
    { key: 'rv', label: 'Renta variable global', pct: rv, color: '#3b82f6', rationale: 'Motor de crecimiento a largo plazo.' },
    { key: 'rf', label: 'Renta fija / liquidez de tipos', pct: rf, color: '#22c55e', rationale: 'Amortiguador y matching parcial de horizonte.' },
    { key: 'cash', label: 'Liquidez / monetario', pct: cash, color: '#94a3b8', rationale: 'Colchón operativo y rebalanceo.' },
    { key: 'alt', label: 'Alternativos ligeros (REIT/infra ETF)', pct: alt, color: '#a855f7', rationale: 'Satélite opcional; evitar opacos.' },
  ]
  const sum = slices.reduce((s, x) => s + x.pct, 0)
  if (sum !== 100 && slices[0]) slices[0].pct += 100 - sum
  return slices.filter((s) => s.pct > 0)
}

/** Nº de productos según tamaño de la cuota mensual (evitar sobre-fragmentación). */
function maxProductsForMonthly(monthly: number): number {
  if (monthly < 30) return 2
  if (monthly <= 150) return 3
  if (monthly <= 400) return 4
  return 5
}

type RawProduct = Omit<ProductIdea, 'eurosThisMonth' | 'pctOfContribution' | 'suggestedPct'> & {
  weight: number
}

function pickMonthlyProducts(input: StrategyInput, allocation: AllocationSlice[]): RawProduct[] {
  const monthly = input.monthlyContributionEur
  const maxN = maxProductsForMonthly(monthly)
  const rv = allocation.find((a) => a.key === 'rv')?.pct ?? 0
  const rf = allocation.find((a) => a.key === 'rf')?.pct ?? 0
  const cash = allocation.find((a) => a.key === 'cash')?.pct ?? 0

  const candidates: RawProduct[] = []

  // Núcleo RV — siempre si hay peso
  if (rv > 0) {
    if (input.constraints.esg) {
      candidates.push({
        ticker: 'VWCE-ESG',
        name: 'ETF World ESG screened UCITS (universo Acc; verifique ISIN en el bróker)',
        assetClass: 'RV ESG',
        weight: rv,
        minCapitalHint: 'Núcleo ESG líquido',
        why: 'Exposición global con screening ESG; UCITS Acc preferible para diferir dividendos.',
        liquidity: 'media',
        demoLabel: VERIFY,
      })
    } else {
      candidates.push({
        ticker: 'VWCE',
        name: 'Vanguard FTSE All-World UCITS ETF Acc (VWCE / ISIN IE00BK5BQT80)',
        assetClass: 'RV global',
        weight: rv,
        minCapitalHint: 'Núcleo diversificado en una sola línea',
        why: 'Building block UCITS Acc de renta variable global; base del DCA mensual.',
        liquidity: 'alta',
        demoLabel: VERIFY,
      })
    }
  }

  // RF
  if (rf > 0) {
    const shortDuration =
      input.horizon === 'corto' || input.risk === 'conservador' || input.goal === 'preservacion'
    candidates.push({
      ticker: shortDuration ? 'EIB5' : 'AGGH',
      name: shortDuration
        ? 'ETF euro gov short duration UCITS'
        : 'ETF agregados globales / euro gov UCITS',
      assetClass: shortDuration ? 'RF corta' : 'RF duration media',
      weight: rf,
      minCapitalHint: 'Sleeve de tipos en un ETF líquido',
      why: shortDuration
        ? 'Reduce sensibilidad a tipos con horizonte corto o perfil cauteloso.'
        : 'Amortiguador de cartera; duration aproximada al horizonte.',
      liquidity: 'alta',
      demoLabel: VERIFY,
    })
  }

  // Monetario / liquidez
  if (cash > 0) {
    candidates.push({
      ticker: 'CASH-EU',
      name: 'Monetario / ETF money market UCITS',
      assetClass: 'Liquidez',
      weight: cash,
      minCapitalHint: 'Parte de la cuota en liquidez operativa',
      why: 'Colchón dentro de la cuota para imprevistos y rebalanceos; no sustituye el fondo de emergencia fuera de bróker.',
      liquidity: 'alta',
      demoLabel: VERIFY,
    })
  }

  // Satélite solo si la cuota permite más líneas y el perfil lo admite
  if (maxN >= 4 && !input.constraints.esg && input.risk !== 'conservador' && monthly >= 150) {
    const altW = allocation.find((a) => a.key === 'alt')?.pct ?? 0
    if (altW > 0) {
      candidates.push({
        ticker: 'EPRA',
        name: 'ETF REITs Europa/Global UCITS',
        assetClass: 'Alternativos',
        weight: altW,
        minCapitalHint: 'Satélite solo si la cuota no se fragmenta',
        why: 'Exposición inmobiliaria cotizada; más líquida que inmueble directo.',
        liquidity: 'media',
        demoLabel: VERIFY,
      })
    } else if (rv >= 50) {
      candidates.push({
        ticker: 'SXRV',
        name: 'iShares NASDAQ 100 UCITS ETF (p. ej. SXRV / EQQQ — confirme ISIN)',
        assetClass: 'RV tech satélite',
        weight: Math.min(15, Math.round(rv * 0.2)),
        minCapitalHint: 'Satélite ≤15% consciente del overlap tech',
        why: 'Tilt tecnológico opcional; vigilancia de concentración EE. UU./tech.',
        liquidity: 'alta',
        demoLabel: VERIFY,
      })
      // Reducir peso del núcleo RV
      const core = candidates.find((c) => c.ticker === 'VWCE' || c.ticker === 'VWCE-ESG')
      if (core) core.weight = Math.max(10, core.weight - candidates[candidates.length - 1]!.weight)
    }
  }

  // Recortar a maxN priorizando mayor peso
  let picked = [...candidates].sort((a, b) => b.weight - a.weight).slice(0, maxN)

  // Cuota muy pequeña: preferir 1–2 y explicar
  if (monthly < 30 && picked.length > 2) {
    picked = picked.slice(0, 2)
  }

  // Si tras recorte queda 1 producto y la cuota no es minúscula, forzar diversificación mínima
  if (picked.length === 1 && monthly >= 30 && candidates.length >= 2) {
    const second = candidates.find((c) => c.ticker !== picked[0]!.ticker)
    if (second) {
      // repartir 60/40 del peso del primero
      const w = picked[0]!.weight
      picked[0]!.weight = Math.round(w * 0.6)
      picked.push({ ...second, weight: Math.max(1, w - picked[0]!.weight) })
    }
  }

  // Normalizar pesos a 100
  const wSum = picked.reduce((s, p) => s + p.weight, 0) || 1
  return picked.map((p) => ({ ...p, weight: (p.weight / wSum) * 100 }))
}

/** Redondeo sensible a céntimos; el último producto absorbe el resto. */
function allocateEuros(monthly: number, weights: number[]): { pcts: number[]; euros: number[] } {
  const n = weights.length
  if (n === 0) return { pcts: [], euros: [] }
  const pcts = weights.map((w) => Math.round(w * 10) / 10)
  // Ajustar % para sumar 100
  let pctSum = pcts.reduce((s, p) => s + p, 0)
  if (pctSum !== 100 && n > 0) {
    pcts[n - 1] = Math.round((pcts[n - 1]! + (100 - pctSum)) * 10) / 10
  }
  const euros: number[] = []
  let assigned = 0
  for (let i = 0; i < n - 1; i++) {
    const e = Math.round(((monthly * pcts[i]!) / 100) * 100) / 100
    euros.push(e)
    assigned += e
  }
  euros.push(Math.round((monthly - assigned) * 100) / 100)
  return { pcts, euros }
}

function productsFor(input: StrategyInput, allocation: AllocationSlice[]): ProductIdea[] {
  const monthly = input.monthlyContributionEur
  const raw = pickMonthlyProducts(input, allocation)
  const { pcts, euros } = allocateEuros(
    monthly,
    raw.map((r) => r.weight),
  )
  return raw.map((r, i) => ({
    ticker: r.ticker,
    name: r.name,
    assetClass: r.assetClass,
    suggestedPct: pcts[i]!,
    pctOfContribution: pcts[i]!,
    eurosThisMonth: euros[i]!,
    minCapitalHint: r.minCapitalHint,
    why: r.why,
    liquidity: r.liquidity,
    demoLabel: r.demoLabel,
  }))
}


const BROKER_DEMO_LABEL = VERIFY

type BrokerSeed = Omit<BrokerIdea, 'fitScore' | 'whyFits' | 'demoLabel'> & {
  baseScore: number
  tags: string[]
}

const BROKER_CATALOG: BrokerSeed[] = [
  {
    id: 'trade-republic',
    name: 'Trade Republic',
    baseScore: 7,
    bestFor: 'DCA mensual pequeño en ETF UCITS con plan de ahorro',
    pros: [
      'Planes de ahorro ETF a 0 € de comisión en muchos UCITS (modelo habitual publicado)',
      'App simple; fracciones en savings plans',
      'Buen encaje con cuotas tipo 50 €/mes',
    ],
    cons: [
      'Universo y herramientas de análisis más limitados que IBKR',
      'Intereses / cash y condiciones pueden cambiar — revise la app',
    ],
    monthlyDcaFriendly: true,
    ucitsEtfs: true,
    spainRetailNotes: 'Opera en ES vía pasaporte UE; cuenta en EUR; informe fiscal 2024+ vía modelo 720/datos del bróker según su situación.',
    feeNotes: 'Savings plans ETF: 0 € típico; trading puntual fuera de plan puede tener comisión fija pequeña. Confirme lista de ETF elegibles.',
    tags: ['dca', 'lowfee', 'ucits', 'spain', 'retail'],
  },
  {
    id: 'scalable',
    name: 'Scalable Capital',
    baseScore: 6.5,
    bestFor: 'Planes de ahorro ETF recurrentes (Broker / Prime)',
    pros: [
      'ETF savings plans muy orientados a DCA',
      'Prime puede compensar si opera con frecuencia (valore coste mensual)',
      'UCITS europeos en el núcleo',
    ],
    cons: [
      'Sin Prime, límites/comisiones del plan free pueden no encajar',
      'Menos «banco local ES» que MyInvestor',
    ],
    monthlyDcaFriendly: true,
    ucitsEtfs: true,
    spainRetailNotes: 'Accesible a residentes ES; revise residencia fiscal y reporting.',
    feeNotes: 'Free vs Prime: en Free, savings plans baratos/0 € en selección; Prime cobra cuota mensual a cambio de trading más libre. Compare con su volumen.',
    tags: ['dca', 'lowfee', 'ucits', 'spain', 'retail'],
  },
  {
    id: 'myinvestor',
    name: 'MyInvestor',
    baseScore: 7,
    bestFor: 'Retail ES que quiere fondos indexados + ETF en entorno español',
    pros: [
      'Entidad española conocida; onboarding y soporte en ES',
      'Fondos indexados y ETF; operativa retail clara',
      'Encaja perfiles conservadores / ingresos / preservación',
    ],
    cons: [
      'Comisiones ETF puntuales pueden ser menos agresivas que TR/Scalable en savings plans',
      'Universo más acotado que IBKR',
    ],
    monthlyDcaFriendly: true,
    ucitsEtfs: true,
    spainRetailNotes: 'Bróker/banco español; reporting fiscal local más natural para residente ES.',
    feeNotes: 'Fondos indexados a menudo 0 € de suscripción en selección; ETF: revise tarifa vigente (puede haber mínimo por orden). Confirme en su web.',
    tags: ['spain', 'ucits', 'retail', 'conservador', 'ingresos', 'local'],
  },
  {
    id: 'ibkr',
    name: 'Interactive Brokers (IBKR)',
    baseScore: 6,
    bestFor: 'Capital creciente, muchos productos o operativa avanzada',
    pros: [
      'Universo enorme (UCITS, acciones, opciones, FX)',
      'Costes competitivos a medida que sube el volumen',
      'Herramientas profesionales (TWS / Client Portal)',
    ],
    cons: [
      'Curva de aprendizaje alta para 50 €/mes simples',
      'FX, comisiones mínimas y estructura de cuenta exigen atención',
      'Overkill si solo quiere 1–2 ETF en DCA',
    ],
    monthlyDcaFriendly: false,
    ucitsEtfs: true,
    spainRetailNotes: 'Cuenta internacional usable desde ES; declare según normativa (incl. posibles obligaciones informativas).',
    feeNotes: 'Comisiones variables por mercado; en ETF europeos a menudo muy bajas en €, pero mínimos y conversión FX importan. Sin «savings plan» al estilo TR — programe usted el DCA.',
    tags: ['advanced', 'ucits', 'wide', 'premium'],
  },
  {
    id: 'degiro',
    name: 'DEGIRO',
    baseScore: 6,
    bestFor: 'ETF core baratos; vigilancia de comisiones de conectividad/custodia',
    pros: [
      'Selección Core / Free ETF con comisiones muy bajas en compra puntual',
      'Plataforma conocida en Europa',
      'UCITS en bolsas EU',
    ],
    cons: [
      'Cuota de conectividad / custodia anual: léala antes de abrir',
      'Menos cómodo que TR/Scalable para DCA automático fraccionado',
    ],
    monthlyDcaFriendly: false,
    ucitsEtfs: true,
    spainRetailNotes: 'Usado por retail ES; revise entidad custodiante y reporting.',
    feeNotes: 'Core Selection: 0 € + €1 handling típico en algunos ETF (condiciones publicadas — verifique). Auto-FX y custody/connectivity pueden sumar.',
    tags: ['lowfee', 'ucits', 'spain', 'retail'],
  },
  {
    id: 'renta4',
    name: 'Renta 4',
    baseScore: 5,
    bestFor: 'Quien prioriza bróker tradicional español y atención local',
    pros: [
      'Entidad española consolidada',
      'Oficinas / asesoramiento presencial (si lo valora)',
      'Amplia gama fondos nacionales',
    ],
    cons: [
      'Comisiones suele ser más altas que neobrokers para ETF DCA pequeño',
      'Peor ratio coste/beneficio en 50 €/mes indexado puro',
    ],
    monthlyDcaFriendly: false,
    ucitsEtfs: true,
    spainRetailNotes: 'Bróker español regulado; encaje fiscal/local fuerte.',
    feeNotes: 'Tarifas ETF/fondos según tarifa publicada (suelen superar a TR/MyInvestor en ticket pequeño). Pida tarifa vigente.',
    tags: ['spain', 'local', 'conservador', 'tradicional', 'premium'],
  },
  {
    id: 'selfbank',
    name: 'Self Bank (Singular Bank)',
    baseScore: 5,
    bestFor: 'Alternativa tradicional ES con fondos y ETF',
    pros: ['Marca española', 'Fondos y ETF para retail', 'Soporte en ES'],
    cons: ['Costes a menudo superiores a neobrokers DCA', 'Menos «plan de ahorro ETF a 0 €»'],
    monthlyDcaFriendly: false,
    ucitsEtfs: true,
    spainRetailNotes: 'Entidad ES; útil si ya es cliente del grupo.',
    feeNotes: 'Consulte tarifa de corretaje ETF y custodia vigentes — varían por producto.',
    tags: ['spain', 'local', 'tradicional', 'conservador'],
  },
  {
    id: 'indexa',
    name: 'Indexa Capital',
    baseScore: 5.5,
    bestFor: 'Si prefiere cartera gestionada (roboadvisor) en lugar de DIY',
    pros: [
      'Carteras indexadas diversificadas con rebalanceo automático',
      'Muy usado en ES; traspasos de fondos sin peaje fiscal típico',
      'Menos fricción operativa mensual',
    ],
    cons: [
      'No es un bróker DIY: usted no elige ticker a ticker cada mes',
      'Comisión de gestión sobre patrimonio (además del TER de fondos)',
      'Modelo distinto al plan ETF manual de esta app',
    ],
    monthlyDcaFriendly: true,
    ucitsEtfs: true,
    spainRetailNotes: 'Gestor automatizado ES; aportaciones periódicas por domiciliación.',
    feeNotes: 'Comisión de gestión decreciente por tramos (cifras públicas en su web; confirme tramo). TER de fondos aparte. No hay «compra VWCE» manual.',
    tags: ['spain', 'robo', 'managed', 'dca', 'retail'],
  },
]

/** Rank 3–5 brokers for this monthly plan (Spain retail / UCITS / DCA). */
export function recommendBrokers(input: StrategyInput, products: ProductIdea[]): BrokerIdea[] {
  const monthly = input.monthlyContributionEur
  const nProducts = products.length
  const spain = input.constraints.spainRetail
  const conserv = input.risk === 'conservador' || input.goal === 'preservacion' || input.goal === 'ingresos'
  const advanced = monthly >= 400 || nProducts >= 4 || input.risk === 'agresivo' || (input.capitalEur >= 25000)
  const smallDca = monthly < 100

  const scored: BrokerIdea[] = BROKER_CATALOG.map((b) => {
    let score = b.baseScore
    const reasons: string[] = []

    if (smallDca && b.monthlyDcaFriendly) {
      score += 2.2
      reasons.push(`cuota ${monthly} €/mes: prioriza planes de ahorro ETF baratos`)
    }
    if (smallDca && !b.monthlyDcaFriendly && b.id !== 'indexa') {
      score -= 1.2
      reasons.push('menos óptimo para tickets mensuales muy pequeños')
    }
    if (spain && b.tags.includes('spain')) {
      score += 1.1
      reasons.push('encaje retail España / UCITS')
    }
    if (spain && b.tags.includes('local')) {
      score += 0.4
    }
    if (b.ucitsEtfs && (spain || products.some((p) => /UCITS|VWCE|ETF/i.test(p.name + p.ticker)))) {
      score += 0.6
    }
    if (conserv && (b.tags.includes('conservador') || b.tags.includes('local') || b.id === 'myinvestor')) {
      score += 1.0
      reasons.push(`perfil ${input.risk}/${input.goal}: entorno ES o más «guiado»`)
    }
    if (advanced && b.tags.includes('advanced')) {
      score += 2.0
      reasons.push('capital/universo amplio → IBKR gana peso')
    }
    if (advanced && b.id === 'trade-republic') score -= 0.3
    if (!smallDca && monthly >= 200 && b.id === 'ibkr') score += 0.8
    if (input.goal === 'crecimiento' && b.tags.includes('dca')) score += 0.3
    if (b.id === 'indexa' && input.notes && /gestionado|robo|indexa|no quiero elegir/i.test(input.notes)) {
      score += 2.5
      reasons.push('preferencia declarada por gestión delegada')
    }
    if (b.id === 'indexa' && !/gestionado|robo|indexa/i.test(input.notes || '')) {
      // keep as alternative model, slight penalty vs DIY for this DIY plan
      score -= 0.4
    }

    score = Math.max(1, Math.min(10, Math.round(score * 10) / 10))

    const why =
      reasons.length > 0
        ? `Encaje ${score}/10: ${reasons.slice(0, 2).join('; ')}.`
        : `Encaje ${score}/10 con su cuota de ${monthly} € y ${nProducts} producto(s).`

    return {
      id: b.id,
      name: b.name,
      fitScore: score,
      bestFor: b.bestFor,
      whyFits: why,
      pros: b.pros,
      cons: b.cons,
      monthlyDcaFriendly: b.monthlyDcaFriendly,
      ucitsEtfs: b.ucitsEtfs,
      spainRetailNotes: b.spainRetailNotes,
      feeNotes: b.feeNotes,
      demoLabel: BROKER_DEMO_LABEL,
    }
  })

  scored.sort((a, b) => b.fitScore - a.fitScore)

  // Always keep 1 premium alternative (IBKR or Renta 4)
  const top: BrokerIdea[] = []
  const premiumIds = new Set(['ibkr', 'renta4'])
  for (const b of scored) {
    if (top.length >= 4) break
    top.push(b)
  }
  const hasPremium = top.some((b) => premiumIds.has(b.id))
  if (!hasPremium) {
    const prem = scored.find((b) => premiumIds.has(b.id))
    if (prem) {
      // replace lowest or append if room
      if (top.length >= 4) top[top.length - 1] = { ...prem, whyFits: prem.whyFits + ' Alternativa premium: más universo/servicio a costa de complejidad o precio.' }
      else top.push({ ...prem, whyFits: prem.whyFits + ' Alternativa premium incluida para comparar trade-offs.' })
    }
  }

  // Annotate the premium one
  const out = top
    .sort((a, b) => b.fitScore - a.fitScore)
    .slice(0, 5)
    .map((b) => {
      if (premiumIds.has(b.id) && !b.whyFits.includes('premium') && !b.whyFits.includes('Alternativa')) {
        return {
          ...b,
          whyFits: b.whyFits + ' (alternativa premium: más capacidad, más fricción).',
        }
      }
      return b
    })

  return out
}

function buildSteps(input: StrategyInput, products: ProductIdea[]): StrategyStep[] {
  const m = input.monthlyContributionEur
  const day = input.contributionDay && input.contributionDay >= 1 && input.contributionDay <= 28
    ? input.contributionDay
    : 1
  const buyList = products
    .map(
      (p) =>
        `• ${p.ticker} (${p.name}): ${p.eurosThisMonth.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € (${p.pctOfContribution}%)`,
    )
    .join('\n')

  const steps: StrategyStep[] = [
    {
      title: 'Elegir bróker de la lista recomendada e abrir/verificar cuenta',
      detail:
        'Use uno de los brokers recomendados para este plan (sección Brokers). Priorice el de mayor fitScore si su cuota es pequeña y quiere planes de ahorro ETF. Compruebe que cotiza los UCITS del reparto (p. ej. VWCE) en EUR y que admite fracciones o tickets bajos. Foro Inversor no ejecuta órdenes ni custodia activos.',
    },
    {
      title: `Programar transferencia mensual de ${m.toLocaleString('es-ES')} €`,
      detail: `Configure una transferencia recurrente (domiciliación o regla en su banco) de ${m.toLocaleString('es-ES')} € hacia la cuenta de efectivo del bróker, idealmente unos días antes del día ${day} de cada mes para que el saldo esté disponible. No invierta dinero que necesite a corto plazo para gastos fijos.`,
    },
    {
      title: `El día ${day}: comprar el reparto de esta cuota`,
      detail: `Con el efectivo disponible, ejecute compras según el reparto de este mes:\n${buyList}\n\nUse orden a mercado solo en ETFs muy líquidos en horario de negociación; si prefiere control de precio, una orden limitada cercana al último precio. Redondee al céntimo o a la fracción mínima que permita el bróker; si sobran unos céntimos, acumúlelos en el núcleo (primer producto) el mes siguiente.`,
    },
    {
      title: 'Revisar cada 6–12 meses (no cada semana)',
      detail:
        'Compruebe que los % acumulados se acercan a la asignación objetivo. Use aportaciones futuras para rellenar tramos infraponderados antes de vender (nota fiscal general ES). No rebalancee por titulares diarios. Tras un drawdown fuerte (−20% o más) o un cambio de ingresos/horizonte, revise el plan con calma.',
    },
    {
      title: 'No invertir el colchón de emergencia',
      detail:
        'Mantenga 3–12 meses de gastos esenciales fuera de esta cartera (cuenta remunerada o monetario de acceso inmediato). La parte «CASH-EU» de la cuota es liquidez operativa dentro del plan, no sustituye el fondo de emergencia personal.',
    },
  ]

  if (input.capitalEur > 0) {
    steps.splice(2, 0, {
      title: `Capital inicial ya invertido: ${input.capitalEur.toLocaleString('es-ES')} €`,
      detail: `Tiene un capital previo de ${input.capitalEur.toLocaleString('es-ES')} €. Este plan se centra en cómo repartir la cuota mensual de ${m.toLocaleString('es-ES')} €. Gradualmente, las aportaciones DCA irán diluyendo el timing del capital inicial. No es necesario liquidar todo de golpe salvo que la mezcla actual sea incompatible con su perfil (consulte un profesional si aplica).`,
    })
  }

  if (m < 30) {
    steps.push({
      title: 'Cuota pequeña: menos productos a propósito',
      detail: `Con ${m.toLocaleString('es-ES')} €/mes, limitar a 1–2 ETF líquidos evita comisiones, spreads y complejidad inútil. Cuando la cuota suba (≥30–50 €), podrá añadir un tercer building block sin fragmentar.`,
    })
  }

  steps.push({
    title: 'Aviso regulatorio',
    detail:
      'Foro Inversor no está autorizado por la CNMV como asesor financiero ni actúa como bróker: no ejecuta órdenes. Rentabilidad pasada ≠ futura. Confirme ISINs, tarifas y fiscalidad en su intermediario.',
  })

  return steps
}

function fmtEur(n: number) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function buildMockStrategy(input: StrategyInput): StrategyPlan {
  const monthly = input.monthlyContributionEur > 0 ? input.monthlyContributionEur : 50
  const normalized: StrategyInput = {
    ...input,
    monthlyContributionEur: monthly,
    capitalEur: input.capitalEur >= 0 ? input.capitalEur : 0,
  }

  const allocation = mixFor(normalized.risk, normalized.goal, normalized.horizon)
  let products = productsFor(normalized, allocation)
  if (normalized.constraints.noCrypto) {
    products = products.filter((p) => !/crypto|btc|eth/i.test(p.ticker + p.name))
  }

  const monthlyBreakdown: MonthlyBreakdownRow[] = products.map((p) => ({
    ticker: p.ticker,
    name: p.name,
    pct: p.pctOfContribution,
    euros: p.eurosThisMonth,
    why: p.why,
  }))

  const steps = buildSteps(normalized, products)
  const brokers = recommendBrokers(normalized, products)
  const remainderNote =
    Math.abs(products.reduce((s, p) => s + p.eurosThisMonth, 0) - monthly) < 0.02
      ? 'Los euros suman exactamente la cuota (redondeo a céntimos; el último producto absorbe el resto).'
      : 'Revise el redondeo: el último producto absorbe céntimos residuales.'

  const agentNotes: AgentContribution[] = [
    note(
      'asignacion',
      `Plan DCA mensual de ${fmtEur(monthly)} € (${normalized.risk} / ${normalized.goal}).`,
      [
        `Aportación mensual: ${monthly} EUR`,
        normalized.capitalEur > 0
          ? `Capital inicial opcional: ${normalized.capitalEur} EUR`
          : 'Sin capital inicial (solo cuota mensual)',
        `Horizonte: ${normalized.horizon}`,
        `Productos este mes: ${products.length} (máx. recomendado para esta cuota: ${maxProductsForMonthly(monthly)})`,
      ],
      [
        'Reparto multi-producto de la cuota — no volcar el 100% en un solo activo salvo cuota minúscula.',
        remainderNote,
      ],
      ['Error de modelo', 'Cambio de régimen macro', 'Sobre-fragmentación'],
    ),
    note(
      'productos-retail-es',
      'Universo preferente UCITS negociable en Europa / operativa retail ES.',
      ['Priorizar vehículos con KIID y liquidez razonable.', 'Pocos ETF líquidos > muchas ideas exóticas.'],
      [normalized.constraints.spainRetail ? 'Filtro España/UCITS activado.' : 'Sin filtro estricto de domicilio.'],
    ),
    note(
      'liquidez',
      monthly < 30
        ? 'Cuota <30 €: 1–2 productos para no morir de comisiones/spread.'
        : monthly <= 150
          ? 'Cuota 30–150 €: hasta 3 building blocks diversificados.'
          : 'Cuota amplia: hasta 4–5 líneas líquidas sin satélites opacos.',
      [`Ticket y spreads: ${VERIFY}`],
      ['Diversificar la cuota entre clases de activo, no concentrar en un solo ticker.'],
      ['Spread en aperturas', 'Productos de bajo AUM'],
    ),
    note(
      'renta-fija',
      'Sleeve de RF dimensionado al riesgo y horizonte dentro de la misma cuota mensual.',
      [],
      ['No sustituye un ALM profesional.'],
    ),
    note(
      'fiscal',
      'Notas ES: Acc puede diferir dividendos; plusvalías según IRPF. Confirme con su asesor fiscal.',
      ['Consulte un profesional autorizado para su caso.'],
      [normalized.constraints.preferAccumulating ? 'Preferencia Acc indicada por el usuario.' : 'Sin preferencia Acc.'],
    ),
    note(
      'behavioral',
      `Automatizar la transferencia de ${fmtEur(monthly)} € reduce el riesgo de timing y de «saltar un mes».`,
      [],
      ['Definir qué hará en un −30% antes de empezar.', 'DCA reduce el sesgo de market timing.'],
      ['Vender en pánico', 'Home bias', 'Saltar aportaciones'],
    ),
    note(
      'fx-multicurrency',
      'VWCE y peers globales implican exposición USD y otras divisas para inversor EUR.',
      [],
      ['Cobertura FX tiene coste; no siempre necesaria a largo plazo.'],
    ),
    note(
      'jubilacion',
      'Encaje de horizonte: cuanto más largo, más tolerable la beta de RV .',
      [],
      ['No es un plan de pensiones regulado.'],
    ),
    note(
      'esg',
      normalized.constraints.esg
        ? 'Mandato ESG activado: priorizar variantes screened.'
        : 'Sin mandato ESG estricto; núcleo de mercado amplio.',
      [],
      ['ESG ≠ ausencia de riesgo de mercado.'],
    ),
    note(
      'abogado-diablo',
      products.length === 1
        ? '¿De verdad la cuota es tan pequeña que justifica un solo producto? Si puede, añada un segundo sleeve.'
        : '¿Está el usuario sobreajustando a titulares recientes? ¿Sobrevivirá el drawdown?',
      [],
      ['Una cartera «perfecta» sobre el papel falla sin disciplina.'],
      ['Complejidad innecesaria', 'Exceso de confianza', 'Concentración 100%'],
    ),
    note(
      'cumplimiento',
      'Salida con aviso regulatorio: no somos asesor CNMV ni bróker.',
      ['La app no es un bróker.'],
      [],
    ),
    note(
      'cio-mesa',
      `Validación CIO: cuota ${fmtEur(monthly)} € ↔ ${products.length} líneas ↔ liquidez ↔ horizonte.`,
      [],
      ['Aprobar plan con revisión 6–12 meses y tras ±20% de mercado.'],
    ),
  ]

  const title = `Plan mensual — ${fmtEur(monthly)} €/mes (${etiquetaRiesgo(normalized.risk)})`
  const nearTermView =
    normalized.horizon === 'corto'
      ? 'Vista próximo tramo: priorizar liquidez y duration corta dentro de la cuota; evitar apuestas binarias. Sin feed live de mercado en este modo.'
      : 'Vista próximo tramo: mantener la transferencia automática; no reaccionar a ruido semanal.'

  const longTermThesis = `Tesis largo plazo: aportando ${fmtEur(monthly)} € cada mes a un núcleo diversificado UCITS alineado a ${normalized.goal}, con RF según tolerancia ${normalized.risk}, se construye posición de forma gradual para horizonte ${normalized.horizon}. No garantiza rentabilidad. Pasado ≠ futuro.`

  const tableLines = monthlyBreakdown.map(
    (r) =>
      `• ${r.ticker}: ${r.pct}% → ${fmtEur(r.euros)} € este mes — ${r.why}`,
  )

  const executiveBrief = [
    title,
    '',
    `De tus ${fmtEur(monthly)} € este mes, compra exactamente este reparto:`,
    ...tableLines,
    '',
    remainderNote,
    '',
    `Objetivo: ${normalized.goal} · Riesgo: ${normalized.risk} · Horizonte: ${normalized.horizon}`,
    normalized.capitalEur > 0
      ? `Capital inicial ya invertido (opcional): ${normalized.capitalEur.toLocaleString('es-ES')} EUR`
      : 'Capital inicial: 0 (solo DCA mensual)',
    normalized.contributionDay
      ? `Día de aportación preferido: ${normalized.contributionDay}`
      : 'Día de aportación: 1 (por defecto)',
    normalized.constraints.esg ? 'Restricción: ESG preferente.' : '',
    normalized.constraints.noCrypto ? 'Restricción: sin cripto.' : '',
    normalized.constraints.spainRetail ? 'Restricción: enfoque retail ES / UCITS.' : '',
    '',
    'ASIGNACIÓN ESTRATÉGICA:',
    ...allocation.map((a) => `• ${a.label}: ${a.pct}% — ${a.rationale}`),
    '',
    'BROKERS RECOMENDADOS PARA TU PLAN:',
    ...brokers.map(
      (b, i) =>
        `${i + 1}. ${b.name} — fit ${b.fitScore}/10 — ${b.bestFor}\n   ${b.whyFits}\n   Tarifas: ${b.feeNotes}`,
    ),
    brokers[0]
      ? `Acción: abra cuenta en ${brokers[0].name} (u otro de la lista) y ejecute el reparto allí.`
      : '',
    '',
    'PASO A PASO:',
    ...steps.map((s, i) => `${i + 1}. ${s.title}\n   ${s.detail}`),
    '',
    'VISTA CORTO PLAZO:',
    nearTermView,
    '',
    'TESIS LARGO PLAZO:',
    longTermThesis,
    '',
    'REBALANCEO:',
    '• Revisar bandas ±5 pp o al menos cada 6–12 meses.',
    '• Aportaciones nuevas hacia tramos infraponderados (DCA).',
    '',
    DISCLAIMER,
  ]
    .filter(Boolean)
    .join('\n')

  return {
    id: `strat-${Date.now()}`,
    createdAt: new Date().toISOString(),
    mode: 'mock',
    input: normalized,
    title,
    monthlyContributionEur: monthly,
    nearTermView,
    longTermThesis,
    allocation,
    products,
    monthlyBreakdown,
    steps,
    brokers,
    rebalancing: [
      'Umbral ±5 puntos porcentuales respecto a la banda objetivo .',
      'Usar la cuota mensual hacia tramos infraponderados antes de vender (nota fiscal general ES).',
      'Revisión obligatoria cada 6–12 meses o tras drawdown severo / cambio de horizonte.',
      'No rebalancear por titulares diarios.',
      remainderNote,
    ],
    riskChecklist: [
      '¿El número de productos es manejable para esta cuota mensual?',
      '¿Hay overlap tech/EE. UU. oculto entre ETF + satélites?',
      '¿Colchón de emergencia (fuera del bróker) de 3–12 meses de gastos?',
      '¿Tolera el drawdown histórico típico de esta mezcla?',
      '¿Restricciones ESG/cripto/domicilio respetadas?',
      '¿Se ha leído el disclaimer (no asesoramiento, no bróker)?',
      products.length === 1
        ? '¿Justifica la cuota un único producto? (solo si es muy pequeña)'
        : '¿La cuota está repartida en varios productos y no al 100% en uno solo?',
    ],
    agentNotes,
    disagreements: [
      {
        topic: '¿Cuánta renta variable dentro de la cuota?',
        positions: [
          { agent: 'Arquitecto de asignación de activos', view: 'Bandas según perfil declarado' },
          { agent: 'Agente de riesgo y cartera', view: 'Sesgar a la baja si no hay colchón de liquidez' },
          { agent: 'Abogado del diablo', view: 'El perfil auto-declarado suele ser optimista' },
        ],
      },
      {
        topic: '¿Cuántos ETF con 50 €/mes?',
        positions: [
          { agent: 'Analista de liquidez y microstructure', view: '2–3 líquidos máximo; evitar micro-tickets' },
          { agent: 'Especialista en ETFs y fondos', view: 'Núcleo + RF + monetario suele bastar' },
          { agent: 'Especialista productos retail España', view: 'Priorizar UCITS con KIID y horarios EU' },
        ],
      },
    ],
    executiveBrief,
    disclaimer: DISCLAIMER,
  }
}

function etiquetaRiesgo(r: RiskTolerance) {
  return ({ conservador: 'Conservador', moderado: 'Moderado', dinamico: 'Dinámico', agresivo: 'Agresivo' })[r]
}
