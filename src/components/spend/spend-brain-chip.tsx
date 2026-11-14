'use client'

import Link from 'next/link'
import { Brain } from 'lucide-react'
import { BRAIN, modelInUseLabel } from '@/lib/spend-brain'

export function SpendBrainChip({
  tab = 'modelo',
}: {
  tab?: 'modelo' | 'base' | 'entrenamiento' | 'taxonomia' | 'reglas'
}) {
  const trained = BRAIN.model.status === 'publicado'
  return (
    <Link
      href={`/sourcing-intelligence/cerebro?tab=${tab}`}
      title={modelInUseLabel()}
      className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
    >
      <Brain className="h-4 w-4" style={{ color: '#2AD4D2' }} />
      <span className="font-medium">Cerebro</span>
      <span className="text-muted-foreground">
        {trained ? BRAIN.model.name : 'Sin modelo propio'}
      </span>
    </Link>
  )
}
