'use client'

import type { CoverageSegment } from '@/lib/spend-coverage'

const COLOR: Record<CoverageSegment, string> = {
  modelo: '#2AD4D2',
  ia: '#7C3AED',
  manual: '#15936A',
  gris: '#D1D5DB',
  pendiente: '#F3F4F6',
}

const LABEL: Record<CoverageSegment, string> = {
  modelo: 'Reglas y modelo',
  ia: 'IA',
  manual: 'Manual',
  gris: 'Fuera del corte',
  pendiente: 'Falta',
}

export function SpendCoverageBars({
  bars,
}: {
  bars: Array<{ currency: string; shares: Record<CoverageSegment, number>; corte: number }>
}) {
  if (!bars.length) return null
  const order: CoverageSegment[] = ['modelo', 'ia', 'manual', 'gris', 'pendiente']
  return (
    <div className="space-y-3">
      {bars.map(bar => (
        <div key={bar.currency}>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{bar.currency}</span>
            <span>Dentro del corte {Math.round(bar.corte)}%</span>
          </div>
          <div className="flex h-4 overflow-hidden rounded-full border">
            {order.map(key => (
              bar.shares[key] > 0 ? (
                <div key={key} style={{ width: `${bar.shares[key]}%`, background: COLOR[key] }} title={LABEL[key]} />
              ) : null
            ))}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {order.map(key => (
          <span key={key} className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLOR[key] }} />
            {LABEL[key]}
          </span>
        ))}
      </div>
    </div>
  )
}
