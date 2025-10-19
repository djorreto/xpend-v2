'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Settings, 
  Building2, 
  User, 
  Bell, 
  Shield,
  Save,
  Loader2,
  Briefcase,
  Plus,
  Edit,
  Trash2
} from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/loading'
import { ErrorMessage } from '@/components/ui/error'
import { useToast } from '@/components/ui/toast'
import { PermissionsMatrix } from '@/components/forms/permissions-matrix'

interface CompanySettings {
  name: string
  description: string | null
  logo_url: string | null
  settings: {
    currency: string
    timezone: string
    notifications: {
      email: boolean
      push: boolean
    }
  }
}

interface UserSettings {
  full_name: string | null
  email: string
  role: string
}

export default function SettingsPage() {
  const supabase = supabaseBrowser()
  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [companySettings, setCompanySettings] = useState<CompanySettings>({
    name: '',
    description: '',
    logo_url: null,
    settings: {
      currency: 'USD',
      timezone: 'UTC',
      notifications: {
        email: true,
        push: true
      }
    }
  })
  const [userSettings, setUserSettings] = useState<UserSettings>({
    full_name: '',
    email: '',
    role: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [departments, setDepartments] = useState<any[]>([])
  const [newDepartmentName, setNewDepartmentName] = useState('')
  const [editingDepartment, setEditingDepartment] = useState<any>(null)
  const { addToast } = useToast()

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get current user
      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser()
      if (userError || !authUser) {
        throw new Error('Usuario no autenticado')
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (profileError || !profile) {
        throw new Error('Perfil no encontrado')
      }

      setUser({
        name: profile.full_name || authUser.email,
        email: authUser.email,
        role: profile.role
      })

      setUserSettings({
        full_name: profile.full_name,
        email: authUser.email,
        role: profile.role
      })

      // Get company info
      if (profile.company_id) {
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', profile.company_id)
          .single()

        if (!companyError && companyData) {
          setCompany(companyData)
          setCompanySettings({
            name: companyData.name || '',
            description: companyData.description || '',
            logo_url: companyData.logo_url || null,
            settings: {
              currency: companyData.settings?.currency || 'USD',
              timezone: companyData.settings?.timezone || 'UTC',
              notifications: {
                email: companyData.settings?.notifications?.email ?? true,
                push: companyData.settings?.notifications?.push ?? true
              }
            }
          })
        }

        // Load departments
        const { data: departmentsData, error: deptsError } = await supabase
          .from('departments')
          .select('*')
          .eq('company_id', profile.company_id)
          .order('name')

        if (!deptsError && departmentsData) {
          setDepartments(departmentsData)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar configuración')
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudieron cargar la configuración'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveCompanySettings = async () => {
    if (!company) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('companies')
        .update({
          name: companySettings.name,
          description: companySettings.description,
          settings: companySettings.settings
        })
        .eq('id', company.id)

      if (error) throw error

      addToast({
        type: 'success',
        title: 'Configuración guardada',
        message: 'La configuración de la empresa ha sido actualizada'
      })
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo guardar la configuración'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveUserSettings = async () => {
    if (!user) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: userSettings.full_name
        })
        .eq('id', user.id)

      if (error) throw error

      addToast({
        type: 'success',
        title: 'Perfil actualizado',
        message: 'Tu perfil ha sido actualizado'
      })
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo actualizar el perfil'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleAddDepartment = async () => {
    if (!newDepartmentName.trim() || !company) return

    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('departments')
        .insert({
          name: newDepartmentName.trim(),
          company_id: company.id,
          is_active: true
        })
        .select()
        .single()

      if (error) throw error

      setDepartments(prev => [...prev, data])
      setNewDepartmentName('')
      addToast({
        type: 'success',
        title: 'Gerencia creada',
        message: `La gerencia "${data.name}" ha sido creada`
      })
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'No se pudo crear la gerencia'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateDepartment = async (id: string, name: string) => {
    if (!name.trim()) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('departments')
        .update({ name: name.trim() })
        .eq('id', id)

      if (error) throw error

      setDepartments(prev => prev.map(d => d.id === id ? { ...d, name: name.trim() } : d))
      setEditingDepartment(null)
      addToast({
        type: 'success',
        title: 'Gerencia actualizada',
        message: 'El nombre de la gerencia ha sido actualizado'
      })
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo actualizar la gerencia'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleToggleDepartmentStatus = async (id: string, currentStatus: boolean) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('departments')
        .update({ is_active: !currentStatus })
        .eq('id', id)

      if (error) throw error

      setDepartments(prev => prev.map(d => d.id === id ? { ...d, is_active: !currentStatus } : d))
      addToast({
        type: 'success',
        title: currentStatus ? 'Gerencia desactivada' : 'Gerencia activada',
        message: `La gerencia ha sido ${currentStatus ? 'desactivada' : 'activada'}`
      })
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo cambiar el estado de la gerencia'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteDepartment = async (id: string, name: string) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar la gerencia "${name}"?`)) {
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', id)

      if (error) throw error

      setDepartments(prev => prev.filter(d => d.id !== id))
      addToast({
        type: 'success',
        title: 'Gerencia eliminada',
        message: `La gerencia "${name}" ha sido eliminada`
      })
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo eliminar la gerencia'
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <MainLayout user={user} companyName={company?.name || 'Spendora'}>
        <LoadingSpinner />
      </MainLayout>
    )
  }

  if (error) {
    return (
      <MainLayout user={user} companyName={company?.name || 'Spendora'}>
        <ErrorMessage
          title="Error al cargar configuración"
          message={error}
          onRetry={loadSettings}
        />
      </MainLayout>
    )
  }

  return (
    <MainLayout user={user} companyName={company?.name || 'Spendora'}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
          <p className="text-muted-foreground">
            Gestiona la configuración de tu empresa y perfil
          </p>
        </div>

        {/* Company Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Building2 className="h-5 w-5" />
              <span>Configuración de la Empresa</span>
            </CardTitle>
            <CardDescription>
              Información básica y configuración de tu empresa
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Nombre de la Empresa</Label>
                <Input
                  id="companyName"
                  value={companySettings.name}
                  onChange={(e) => setCompanySettings(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Moneda por Defecto</Label>
                <Select 
                  value={companySettings.settings?.currency || 'USD'} 
                  onValueChange={(value) => setCompanySettings(prev => ({
                    ...prev,
                    settings: { ...prev.settings, currency: value }
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD - Dólar Americano</SelectItem>
                    <SelectItem value="EUR">EUR - Euro</SelectItem>
                    <SelectItem value="GBP">GBP - Libra Esterlina</SelectItem>
                    <SelectItem value="MXN">MXN - Peso Mexicano</SelectItem>
                    <SelectItem value="CLP">CLP - Peso Chileno</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={companySettings.description || ''}
                onChange={(e) => setCompanySettings(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe brevemente tu empresa..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Zona Horaria</Label>
              <Select 
                value={companySettings.settings?.timezone || 'UTC'} 
                onValueChange={(value) => setCompanySettings(prev => ({
                  ...prev,
                  settings: { ...prev.settings, timezone: value }
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">America/New_York</SelectItem>
                  <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                  <SelectItem value="America/Mexico_City">America/Mexico_City</SelectItem>
                  <SelectItem value="America/Santiago">America/Santiago</SelectItem>
                  <SelectItem value="Europe/Madrid">Europe/Madrid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleSaveCompanySettings} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar Configuración
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* User Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Configuración del Perfil</span>
            </CardTitle>
            <CardDescription>
              Información personal y preferencias de usuario
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nombre Completo</Label>
                <Input
                  id="fullName"
                  value={userSettings.full_name || ''}
                  onChange={(e) => setUserSettings(prev => ({ ...prev, full_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={userSettings.email}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Rol</Label>
              <Input
                id="role"
                value={userSettings.role}
                disabled
                className="bg-muted"
              />
            </div>

            <Button onClick={handleSaveUserSettings} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar Perfil
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Departments Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Briefcase className="h-5 w-5" />
              <span>Gerencias</span>
            </CardTitle>
            <CardDescription>
              Configura las gerencias o departamentos de tu empresa
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Add New Department */}
            <div className="space-y-2">
              <Label htmlFor="newDepartment">Nueva Gerencia</Label>
              <div className="flex gap-2">
                <Input
                  id="newDepartment"
                  value={newDepartmentName}
                  onChange={(e) => setNewDepartmentName(e.target.value)}
                  placeholder="Ej: Finanzas, Operaciones, TI..."
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddDepartment()
                    }
                  }}
                />
                <Button onClick={handleAddDepartment} disabled={saving || !newDepartmentName.trim()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar
                </Button>
              </div>
            </div>

            {/* Departments List */}
            <div className="space-y-2">
              <Label>Gerencias Configuradas</Label>
              {departments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No hay gerencias configuradas. Agrega la primera gerencia arriba.
                </p>
              ) : (
                <div className="space-y-2">
                  {departments.map((dept) => (
                    <div
                      key={dept.id}
                      className={cn(
                        "flex items-center justify-between p-3 border rounded-lg",
                        !dept.is_active && "opacity-60 bg-muted"
                      )}
                    >
                      {editingDepartment?.id === dept.id ? (
                        <div className="flex-1 flex gap-2">
                          <Input
                            value={editingDepartment.name}
                            onChange={(e) => setEditingDepartment({ ...editingDepartment, name: e.target.value })}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleUpdateDepartment(dept.id, editingDepartment.name)
                              }
                            }}
                            className="flex-1"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateDepartment(dept.id, editingDepartment.name)}
                            disabled={saving}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingDepartment(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-3">
                            <span className={cn(
                              "font-medium",
                              !dept.is_active && "line-through"
                            )}>
                              {dept.name}
                            </span>
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-xs font-medium",
                              dept.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                            )}>
                              {dept.is_active ? "Activa" : "Inactiva"}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingDepartment(dept)}
                              disabled={saving}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleDepartmentStatus(dept.id, dept.is_active)}
                              disabled={saving}
                            >
                              {dept.is_active ? "Desactivar" : "Activar"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteDepartment(dept.id, dept.name)}
                              disabled={saving}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Las gerencias te permiten organizar las licitaciones por departamento. 
                Las gerencias inactivas no aparecerán al crear nuevas licitaciones pero se 
                mantendrán asociadas a las licitaciones existentes.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Notifications Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bell className="h-5 w-5" />
              <span>Notificaciones</span>
            </CardTitle>
            <CardDescription>
              Configura cómo y cuándo recibir notificaciones
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Notificaciones por Email</Label>
                  <p className="text-sm text-muted-foreground">
                    Recibe notificaciones importantes por correo electrónico
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={companySettings.settings?.notifications?.email || false}
                  onChange={(e) => setCompanySettings(prev => ({
                    ...prev,
                    settings: {
                      ...prev.settings,
                      notifications: {
                        ...prev.settings?.notifications,
                        email: e.target.checked
                      }
                    }
                  }))}
                  className="h-4 w-4"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Notificaciones Push</Label>
                  <p className="text-sm text-muted-foreground">
                    Recibe notificaciones en tiempo real en el navegador
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={companySettings.settings?.notifications?.push || false}
                  onChange={(e) => setCompanySettings(prev => ({
                    ...prev,
                    settings: {
                      ...prev.settings,
                      notifications: {
                        ...prev.settings?.notifications,
                        push: e.target.checked
                      }
                    }
                  }))}
                  className="h-4 w-4"
                />
              </div>
            </div>

            <Button onClick={handleSaveCompanySettings} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar Notificaciones
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Permissions Matrix - Solo visible para admins */}
        {user?.role === 'admin' && (
          <PermissionsMatrix companyId={company?.id} />
        )}
      </div>
    </MainLayout>
  )
}