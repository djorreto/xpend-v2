'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/toast'
import { supabaseBrowser } from '@/lib/supabase'
import { Shield, Save } from 'lucide-react'

interface Permission {
  id: string
  name: string
  description: string
  category: string
}

interface RolePermission {
  role: string
  permission_id: string
  granted: boolean
}

interface PermissionsMatrixProps {
  companyId: string
}

const roleLabels = {
  admin: 'Administrador',
  manager: 'Gerente',
  analyst: 'Analista',
  viewer: 'Visualizador'
}

const defaultPermissions: Permission[] = [
  // Dashboard
  { id: 'dashboard_view', name: 'Ver Dashboard', description: 'Acceso al dashboard principal', category: 'Dashboard' },
  
  // Sourcing Plan
  { id: 'sourcing_plan_view', name: 'Ver Sourcing Plan', description: 'Ver el plan de sourcing', category: 'Sourcing Plan' },
  { id: 'sourcing_plan_create', name: 'Crear Iniciativas', description: 'Crear nuevas iniciativas en el plan', category: 'Sourcing Plan' },
  { id: 'sourcing_plan_edit', name: 'Editar Iniciativas', description: 'Modificar iniciativas existentes', category: 'Sourcing Plan' },
  { id: 'sourcing_plan_delete', name: 'Eliminar Iniciativas', description: 'Eliminar iniciativas del plan', category: 'Sourcing Plan' },
  { id: 'sourcing_plan_export', name: 'Exportar Plan', description: 'Exportar el plan a CSV/Excel', category: 'Sourcing Plan' },
  
  // Licitaciones
  { id: 'licitaciones_view', name: 'Ver Licitaciones', description: 'Ver lista de licitaciones', category: 'Licitaciones' },
  { id: 'licitaciones_create', name: 'Crear Licitaciones', description: 'Crear nuevas licitaciones', category: 'Licitaciones' },
  { id: 'licitaciones_edit', name: 'Editar Licitaciones', description: 'Modificar licitaciones existentes', category: 'Licitaciones' },
  { id: 'licitaciones_delete', name: 'Eliminar Licitaciones', description: 'Eliminar licitaciones', category: 'Licitaciones' },
  
  // Proyectos
  { id: 'projects_view', name: 'Ver Proyectos', description: 'Ver lista de proyectos', category: 'Proyectos' },
  { id: 'projects_create', name: 'Crear Proyectos', description: 'Crear nuevos proyectos', category: 'Proyectos' },
  { id: 'projects_edit', name: 'Editar Proyectos', description: 'Modificar proyectos existentes', category: 'Proyectos' },
  { id: 'projects_delete', name: 'Eliminar Proyectos', description: 'Eliminar proyectos', category: 'Proyectos' },
  
  // Proveedores
  { id: 'suppliers_view', name: 'Ver Proveedores', description: 'Ver lista de proveedores', category: 'Proveedores' },
  { id: 'suppliers_create', name: 'Crear Proveedores', description: 'Crear nuevos proveedores', category: 'Proveedores' },
  { id: 'suppliers_edit', name: 'Editar Proveedores', description: 'Modificar proveedores existentes', category: 'Proveedores' },
  { id: 'suppliers_delete', name: 'Eliminar Proveedores', description: 'Eliminar proveedores', category: 'Proveedores' },
  
  // Reportes
  { id: 'reports_view', name: 'Ver Reportes', description: 'Acceso a reportes y análisis', category: 'Reportes' },
  { id: 'reports_export', name: 'Exportar Reportes', description: 'Exportar reportes a PDF/Excel', category: 'Reportes' },
  
  // Usuarios
  { id: 'users_view', name: 'Ver Usuarios', description: 'Ver lista de usuarios', category: 'Usuarios' },
  { id: 'users_create', name: 'Crear Usuarios', description: 'Invitar nuevos usuarios', category: 'Usuarios' },
  { id: 'users_edit', name: 'Editar Usuarios', description: 'Modificar usuarios existentes', category: 'Usuarios' },
  { id: 'users_delete', name: 'Eliminar Usuarios', description: 'Eliminar usuarios', category: 'Usuarios' },
  
  // Configuración
  { id: 'settings_view', name: 'Ver Configuración', description: 'Acceso a configuración', category: 'Configuración' },
  { id: 'settings_edit', name: 'Editar Configuración', description: 'Modificar configuración', category: 'Configuración' },
  { id: 'permissions_edit', name: 'Gestionar Permisos', description: 'Modificar permisos de roles', category: 'Configuración' }
]

const defaultRolePermissions: Record<string, string[]> = {
  admin: defaultPermissions.map(p => p.id), // Admin tiene todos los permisos
  manager: [
    'dashboard_view',
    'sourcing_plan_view', 'sourcing_plan_create', 'sourcing_plan_edit', 'sourcing_plan_export',
    'licitaciones_view', 'licitaciones_create', 'licitaciones_edit',
    'projects_view', 'projects_create', 'projects_edit',
    'suppliers_view', 'suppliers_create', 'suppliers_edit',
    'reports_view', 'reports_export',
    'users_view', 'users_create', 'users_edit',
    'settings_view'
  ],
  analyst: [
    'dashboard_view',
    'sourcing_plan_view', 'sourcing_plan_create', 'sourcing_plan_edit',
    'licitaciones_view', 'licitaciones_create', 'licitaciones_edit',
    'projects_view', 'projects_create', 'projects_edit',
    'suppliers_view', 'suppliers_create', 'suppliers_edit',
    'reports_view', 'reports_export'
  ],
  viewer: [
    'dashboard_view',
    'sourcing_plan_view',
    'licitaciones_view',
    'projects_view',
    'suppliers_view',
    'reports_view'
  ]
}

export function PermissionsMatrix({ companyId }: PermissionsMatrixProps) {
  const [permissions, setPermissions] = useState<Permission[]>(defaultPermissions)
  const [rolePermissions, setRolePermissions] = useState<Record<string, Record<string, boolean>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { addToast } = useToast()
  const supabase = supabaseBrowser()

  useEffect(() => {
    loadPermissions()
  }, [companyId])

  const loadPermissions = async () => {
    try {
      setLoading(true)

      // Cargar permisos personalizados de la empresa (si existen)
      const { data: customPermissions, error: permError } = await supabase
        .from('permissions')
        .select('*')
        .eq('company_id', companyId)

      if (!permError && customPermissions?.length > 0) {
        setPermissions(customPermissions)
      }

      // Cargar permisos de roles
      const { data: rolePermsData, error: rolePermsError } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('company_id', companyId)

      let currentRolePermissions: Record<string, Record<string, boolean>> = {}

      if (!rolePermsError && rolePermsData?.length > 0) {
        // Convertir datos de DB a formato de matriz
        rolePermsData.forEach((rp: any) => {
          if (!currentRolePermissions[rp.role]) {
            currentRolePermissions[rp.role] = {}
          }
          currentRolePermissions[rp.role][rp.permission_id] = rp.granted
        })
      } else {
        // Usar permisos por defecto
        currentRolePermissions = defaultRolePermissions
      }

      setRolePermissions(currentRolePermissions)
    } catch (err) {
      console.error('Error loading permissions:', err)
      // Usar permisos por defecto en caso de error
      setRolePermissions(defaultRolePermissions)
    } finally {
      setLoading(false)
    }
  }

  const handlePermissionChange = (role: string, permissionId: string, granted: boolean) => {
    setRolePermissions(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [permissionId]: granted
      }
    }))
  }

  const handleSavePermissions = async () => {
    try {
      setSaving(true)

      // Eliminar permisos existentes de la empresa
      await supabase
        .from('role_permissions')
        .delete()
        .eq('company_id', companyId)

      // Insertar nuevos permisos
      const permissionsToInsert = []
      for (const role in rolePermissions) {
        for (const permissionId in rolePermissions[role]) {
          permissionsToInsert.push({
            company_id: companyId,
            role,
            permission_id: permissionId,
            granted: rolePermissions[role][permissionId]
          })
        }
      }

      if (permissionsToInsert.length > 0) {
        const { error } = await supabase
          .from('role_permissions')
          .insert(permissionsToInsert)

        if (error) throw error
      }

      addToast({
        type: 'success',
        title: 'Permisos actualizados',
        message: 'Los permisos de los roles han sido guardados correctamente'
      })
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error al guardar permisos',
        message: err instanceof Error ? err.message : 'Error desconocido'
      })
    } finally {
      setSaving(false)
    }
  }

  const getCategories = () => {
    const categories = [...new Set(permissions.map(p => p.category))]
    return categories.sort()
  }

  const getPermissionsByCategory = (category: string) => {
    return permissions.filter(p => p.category === category)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Cargando permisos...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Matriz de Permisos
        </CardTitle>
        <CardDescription>
          Configura los permisos de cada tipo de usuario en tu empresa
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Matriz de permisos */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Permiso</th>
                  {Object.keys(roleLabels).map(role => (
                    <th key={role} className="text-center p-3 font-medium min-w-[120px]">
                      {roleLabels[role as keyof typeof roleLabels]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {getCategories().map(category => (
                  <React.Fragment key={category}>
                    <tr className="bg-muted/30">
                      <td colSpan={Object.keys(roleLabels).length + 1} className="p-3 font-semibold text-sm">
                        {category}
                      </td>
                    </tr>
                    {getPermissionsByCategory(category).map(permission => (
                      <tr key={permission.id} className="border-b hover:bg-muted/20">
                        <td className="p-3">
                          <div>
                            <div className="font-medium text-sm">{permission.name}</div>
                            <div className="text-xs text-muted-foreground">{permission.description}</div>
                          </div>
                        </td>
                        {Object.keys(roleLabels).map(role => (
                          <td key={role} className="text-center p-3">
                            <Checkbox
                              checked={rolePermissions[role]?.[permission.id] || false}
                              onCheckedChange={(checked) => 
                                handlePermissionChange(role, permission.id, checked as boolean)
                              }
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Botón de guardar */}
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleSavePermissions} disabled={saving}>
              {saving ? (
                <>Guardando...</>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar Permisos
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
