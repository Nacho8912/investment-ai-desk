export type AgentId = string

export type Stance = 'comprar' | 'mantener' | 'evitar' | 'insuficiente'
export type Conviction = 'alta' | 'media' | 'baja'
export type RiskTolerance = 'conservador' | 'moderado' | 'dinamico' | 'agresivo'
export type InvestGoal = 'crecimiento' | 'ingresos' | 'preservacion' | 'equilibrado'
export type HorizonCode = 'corto' | 'medio' | 'largo' | 'jubilacion'

export interface AgentMeta {
  id: AgentId
  name: string
  shortName: string
  role: string
  description: string
  methodology: string
  color: string
  icon: string
  isChair?: boolean
  defaultSelected: boolean
}

export interface AgentContribution {
  agentId: AgentId
  agentName: string
  stage: string
  summary: string
  facts: string[]
  judgments: string[]
  risks: string[]
  stance?: Stance
  conviction?: Conviction
  dissentNote?: string
}

export interface ResearchBrief {
  id: string
  createdAt: string
  ticker: string
  question: string
  mode: 'mock' | 'live'
  stages: string[]
  contributions: AgentContribution[]
  synthesis: {
    title: string
    bullCase: string[]
    bearCase: string[]
    risks: string[]
    uncertainties: string[]
    finalStance: Stance
    executiveSummary: string
  }
  disagreements: { topic: string; positions: { agent: string; view: string }[] }[]
  disclaimer: string
}

export interface ICVote {
  agentId: AgentId
  agentName: string
  stance: Stance
  conviction: Conviction
  oneLiner: string
}

export interface ICSession {
  id: string
  createdAt: string
  ticker: string
  thesis: string
  mode: 'mock' | 'live'
  openingBrief: string
  rounds: {
    agentId: AgentId
    agentName: string
    view: string
    facts: string[]
    judgments: string[]
  }[]
  challenges: { from: string; to: string; challenge: string; reply?: string }[]
  votes: ICVote[]
  recommendation: Stance
  convictionAggregate: Conviction
  actaMemo: string
  dissentSummary: string
  disclaimer: string
}

export interface StrategyConstraints {
  esg: boolean
  noCrypto: boolean
  spainRetail: boolean
  preferAccumulating: boolean
  maxSingleStockPct: number
}

export interface StrategyInput {
  /** Aportación mensual primaria (EUR). Default 50. */
  monthlyContributionEur: number
  /** Capital inicial / cartera ya invertida (opcional). Default 0. */
  capitalEur: number
  /** Día del mes preferido para la compra (1–28), opcional. */
  contributionDay?: number
  horizon: HorizonCode
  risk: RiskTolerance
  goal: InvestGoal
  constraints: StrategyConstraints
  notes?: string
}

export interface AllocationSlice {
  key: string
  label: string
  pct: number
  color: string
  rationale: string
}

export interface ProductIdea {
  ticker: string
  name: string
  assetClass: string
  suggestedPct: number
  /** % de la aportación mensual (alias de suggestedPct). */
  pctOfContribution: number
  /** Euros de esta cuota mensual asignados a este producto. */
  eurosThisMonth: number
  minCapitalHint: string
  why: string
  liquidity: 'alta' | 'media' | 'baja'
  demoLabel: string
}

export interface MonthlyBreakdownRow {
  ticker: string
  name: string
  pct: number
  euros: number
  why: string
}


export interface BrokerIdea {
  id: string
  name: string
  fitScore: number // 1-10
  bestFor: string
  whyFits: string
  pros: string[]
  cons: string[]
  monthlyDcaFriendly: boolean
  ucitsEtfs: boolean
  spainRetailNotes: string
  feeNotes: string
  demoLabel: string
}

export interface StrategyStep {
  title: string
  detail: string
}

export interface StrategyPlan {
  id: string
  createdAt: string
  mode: 'mock' | 'live'
  input: StrategyInput
  title: string
  monthlyContributionEur: number
  nearTermView: string
  longTermThesis: string
  allocation: AllocationSlice[]
  products: ProductIdea[]
  /** Reparto detallado de la cuota mensual. */
  monthlyBreakdown: MonthlyBreakdownRow[]
  /** Guía paso a paso en español. */
  steps: StrategyStep[]
  /** Brokers recomendados para este plan. */
  brokers: BrokerIdea[]
  rebalancing: string[]
  riskChecklist: string[]
  agentNotes: AgentContribution[]
  disagreements: { topic: string; positions: { agent: string; view: string }[] }[]
  executiveBrief: string
  disclaimer: string
}

export interface WatchItem {
  ticker: string
  name: string
  note?: string
}

export interface Holding {
  ticker: string
  name: string
  shares: number
  avgCost: number
  currency: string
}

export interface AppSettings {
  mockMode: boolean
  apiKey: string
  apiBaseUrl: string
  model: string
  disclaimerAccepted: boolean
}

export interface ToastMessage {
  id: string
  type: 'info' | 'success' | 'warn' | 'error'
  text: string
}

export interface PersistedState {
  settings: AppSettings
  watchlist: WatchItem[]
  briefs: ResearchBrief[]
  portfolio: Holding[]
  icSessions?: ICSession[]
  strategies?: StrategyPlan[]
}

export interface AuthSessionInfo {
  userId: string
  username: string
  remember: boolean
}

export interface AuthResult {
  ok: boolean
  error?: string
  session?: AuthSessionInfo
}

export interface MarketQuoteResult {
  symbol: string
  price: number | null
  changePct: number | null
  currency: string | null
  asOf: string | null
  marketState: string | null
  ok: boolean
  error?: string
}

declare global {
  interface Window {
    foroAPI: {
      get: (key: string) => Promise<unknown>
      set: (key: string, value: unknown) => Promise<boolean>
      getAll: () => Promise<PersistedState>
      getVersion: () => Promise<string>
      getQuotes: (symbols: string[]) => Promise<MarketQuoteResult[]>
      auth: {
        hasUsers: () => Promise<boolean>
        getSession: () => Promise<AuthSessionInfo | null>
        register: (username: string, password: string) => Promise<AuthResult>
        login: (username: string, password: string, remember?: boolean) => Promise<AuthResult>
        logout: () => Promise<{ ok: boolean }>
      }
    }
  }
}

export {}
