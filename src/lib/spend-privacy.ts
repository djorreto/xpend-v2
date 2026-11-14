export const EXTERNAL_AI_DISABLED =
  'La IA externa está desactivada para esta empresa. Un administrador puede autorizarla en Configuración.'

export const SPEND_ROLE_DENIED = 'Tu rol no puede acceder al gasto de la empresa.'

export const RETENTION_DAY_OPTIONS = [90, 180, 365, 730] as const

export type ExternalAiSettings = {
  enabled: boolean
  accepted_at: string | null
  accepted_by: string | null
  retention_days: number
}

export function normalizeRetentionDays(value: unknown): number {
  const days = Number(value)
  return (RETENTION_DAY_OPTIONS as readonly number[]).includes(days) ? days : 365
}

export function readExternalAi(settings: unknown): ExternalAiSettings {
  const bag = settings && typeof settings === 'object' ? (settings as { external_ai?: unknown }).external_ai : null
  const raw = bag && typeof bag === 'object' ? (bag as Record<string, unknown>) : {}
  const explicit = bag && typeof bag === 'object' && 'enabled' in raw
  return {
    enabled: explicit ? raw.enabled === true : true,
    accepted_at: typeof raw.accepted_at === 'string' ? raw.accepted_at : null,
    accepted_by: typeof raw.accepted_by === 'string' ? raw.accepted_by : null,
    retention_days: normalizeRetentionDays(raw.retention_days),
  }
}

export function externalAiAllowed(settings: unknown): boolean {
  return readExternalAi(settings).enabled
}

export function retainUntilFromSettings(settings: unknown, from = new Date()): string {
  const until = new Date(from.getTime())
  until.setUTCDate(until.getUTCDate() + readExternalAi(settings).retention_days)
  return until.toISOString()
}

export function canReadSpendRole(role?: string | null) {
  return role === 'analyst' || role === 'manager' || role === 'admin' || role === 'super_admin'
}

export function canManageSpendRole(role?: string | null) {
  return role === 'manager' || role === 'admin' || role === 'super_admin'
}
