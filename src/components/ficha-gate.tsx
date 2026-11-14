'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

type LinkRow = {
  licitacion?: {
    id: string
    name?: string | null
    status?: string | null
  } | null
}

export function FichaGate({
  planId,
  hasOwner,
  links,
}: {
  planId: string
  hasOwner: boolean
  links: LinkRow[]
}) {
  const router = useRouter()
  const licitacion = links.find(link => link.licitacion)?.licitacion
  const status = licitacion?.status || ''
  let title = 'Siguiente compuerta'
  let detail = 'Abre la licitación de esta iniciativa.'
  let href = `/licitaciones/new?planId=${planId}`
  let cta = 'Abrir licitación'

  if (!hasOwner) {
    title = 'Falta el dueño'
    detail = 'Sin responsable, esta iniciativa no entra a un proceso.'
    href = `/sourcing-plan/${planId}/edit`
    cta = 'Nombrar dueño'
  } else if (!licitacion) {
    title = 'Falta el proceso'
    detail = 'La licitación, las bases y el expediente viven desde aquí.'
  } else if (status === 'planned' || status === 'bases_review') {
    title = 'Falta publicar'
    detail = 'Adjunta las bases y publícalas. Ese paso queda con nombre y fecha.'
    href = `/licitaciones/${licitacion.id}/edit`
    cta = 'Ir a publicar'
  } else if (status === 'published' || status === 'evaluation') {
    title = 'Falta la nota técnica y la adjudicación'
    detail = 'Primero se cierra la nota. Después otra persona adjudica, salvo excepción escrita.'
    href = `/licitaciones/${licitacion.id}/edit`
    cta = 'Ir a la nota'
  } else if (status === 'awarded' || status === 'contract_signed') {
    title = 'Adjudicada. El ahorro está comprometido'
    detail = 'Todavía no es caja. El expediente guarda el acta y las cartas.'
    href = `/licitaciones/${licitacion.id}`
    cta = 'Ver expediente'
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium text-petrol-blue/50">Ficha de la iniciativa</p>
          <p className="mt-1 text-lg font-medium text-petrol-blue">{title}</p>
          <p className="mt-1 text-sm text-petrol-blue/60">{detail}</p>
        </div>
        <Button onClick={() => router.push(href)}>{cta}</Button>
      </CardContent>
    </Card>
  )
}
