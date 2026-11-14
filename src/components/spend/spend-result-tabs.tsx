'use client'

import Link from 'next/link'

const TABS = [
  { id: 'plan', label: 'Plan' },
  { id: 'kraljic', label: 'Kraljic' },
  { id: 'informe', label: 'Informe' },
] as const

export function SpendResultTabs({
  uploadId,
  current,
}: {
  uploadId: string
  current: 'plan' | 'kraljic' | 'informe'
}) {
  const href = {
    plan: `/sourcing-intelligence/${uploadId}/plan`,
    kraljic: `/sourcing-intelligence/${uploadId}/kraljic`,
    informe: `/sourcing-intelligence/${uploadId}/insights`,
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex rounded-lg border bg-white p-1">
        {TABS.map(tab => (
          <Link
            key={tab.id}
            href={href[tab.id]}
            className={`rounded-md px-3 py-1.5 text-sm ${tab.id === current ? 'bg-[#1B4D3E] text-white' : 'text-muted-foreground'}`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">Resultado de este archivo. Para cambiar una categoría, vuelve a Revisar.</p>
    </div>
  )
}
