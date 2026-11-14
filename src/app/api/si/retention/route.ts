import { NextResponse } from 'next/server'
import { purgeExpiredSpend, requireSpendAccess } from '@/lib/spend-access'

export const runtime = 'nodejs'

export async function POST() {
  const access = await requireSpendAccess('manager')
  if (!access.ok) return access.response
  const { deleted } = await purgeExpiredSpend(access.supabase, access.profile.company_id)
  return NextResponse.json({ success: true, deleted })
}
