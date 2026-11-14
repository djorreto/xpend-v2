import { NextResponse } from 'next/server'
import { requireSpendAccess } from '@/lib/spend-access'
import { trainedModelInfo } from '@/lib/spend-model'
import { BRAIN, modelInUseLabel } from '@/lib/spend-brain'

export const runtime = 'nodejs'

export async function GET() {
  const access = await requireSpendAccess('analyst')
  if (!access.ok) return access.response
  const packed = await trainedModelInfo()
  return NextResponse.json({
    label: modelInUseLabel(),
    brain: BRAIN.model,
    packed,
  })
}
