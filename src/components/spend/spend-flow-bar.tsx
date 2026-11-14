'use client'

import Link from 'next/link'
import { SPEND_STEPS, hrefForStep, type SpendStep } from '@/lib/spend-flow'

const ORDER: SpendStep[] = SPEND_STEPS.map(step => step.id)

export function SpendFlowBar({
  current,
  uploadId,
  pending = 0,
}: {
  current: SpendStep
  uploadId?: string
  pending?: number
}) {
  const currentIndex = ORDER.indexOf(current)

  return (
    <nav aria-label="Flujo de gasto" className="rounded-lg border bg-white px-3 py-3">
      <ol className="flex flex-wrap items-center gap-1">
        {SPEND_STEPS.map((step, index) => {
          const active = step.id === current
          const done = index < currentIndex
          const href = hrefForStep(step.id, uploadId)
          const isDownload = step.id === 'descargar'
          const needsAnalysis = !uploadId && step.id !== 'cargar'
          const label = step.id === 'revisar' && pending > 0 ? `${step.label} (${pending})` : step.label
          const className = [
            'inline-flex items-center rounded-md px-2.5 py-1 text-sm',
            active ? 'bg-[#1B4D3E] text-white' : done ? 'text-[#1B4D3E] font-medium' : 'text-muted-foreground',
          ].join(' ')
          const hint = needsAnalysis ? 'Abre un análisis de la tabla para ver este paso' : step.hint

          return (
            <li key={step.id} className="flex items-center gap-1">
              {index > 0 && <span className="px-1 text-muted-foreground" aria-hidden>→</span>}
              {needsAnalysis ? (
                <span className={className} title={hint}>{label}</span>
              ) : isDownload ? (
                <a href={href} className={className} title={hint}>
                  {label}
                </a>
              ) : (
                <Link href={href} className={className} title={hint}>
                  {label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
