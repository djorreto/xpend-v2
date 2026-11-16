import { can } from './navigation.ts'

// Perspectivas de Inicio. Cambian qué se muestra, nunca la identidad ni los permisos: cada acción sigue validándola la base de datos.
export type Perspective = 'gerencia' | 'trabajo' | 'administracion'

export const PERSPECTIVE_LABEL: Record<Perspective, string> = {
  gerencia: 'Gerencia',
  trabajo: 'Mi trabajo',
  administracion: 'Administración',
}

export function availablePerspectives(role: string): Perspective[] {
  if (role === 'viewer' || role === 'supplier') return []
  const list: Perspective[] = []
  if (can(role, 'manageTeams')) list.push('gerencia')
  list.push('trabajo')
  if (can(role, 'administer')) list.push('administracion')
  return list
}

export function defaultPerspective(role: string): Perspective {
  return availablePerspectives(role)[0] || 'trabajo'
}

// La perspectiva pedida (URL o preferencia guardada) solo vale si el rol la tiene; si no, la predeterminada.
export function resolvePerspective(requested: string | null | undefined, role: string): Perspective {
  const allowed = availablePerspectives(role)
  return allowed.find(item => item === requested) || defaultPerspective(role)
}
