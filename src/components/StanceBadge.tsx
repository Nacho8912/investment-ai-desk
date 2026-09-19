import type { Stance } from '../types'

const LABELS: Record<Stance, string> = {
  comprar: 'Comprar',
  mantener: 'Mantener',
  evitar: 'Evitar',
  insuficiente: 'Insuficiente información',
}

export function StanceBadge({ stance }: { stance: Stance }) {
  return <span className={`badge stance-${stance}`}>{LABELS[stance]}</span>
}
