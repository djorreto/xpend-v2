'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { supabaseBrowser } from '@/lib/supabase'
import { X, Upload, User, Mail, Shield, Save, Plus, Trash, ShieldAlert } from 'lucide-react'

interface UserEditModalProps {
  isOpen: boolean
  onClose: () => void
  user: {
    id: string
    email: string
    full_name: string | null
    role: string
    avatar_url?: string
    phone?: string
    position?: string
    department?: string
    company_roles?: { role: string; company: { id: string; name: string } | null }[]
    company_id?: string | null
  } | null
  onSave: (updatedUser: any) => void
  isSuperAdminCurrent?: boolean
}

const roleLabels = {
  admin: 'Administrador',
  manager: 'Gerente',
  analyst: 'Analista',
  viewer: 'Visualizador'
}

export function UserEditModal({ isOpen, onClose, user, onSave, isSuperAdminCurrent = false }: UserEditModalProps) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    role: '',
    phone: '',
    position: '',
    department: '',
    avatar_url: ''
  })
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [companyRoles, setCompanyRoles] = useState<{ company_id: string; company_name: string; role: string }[]>([])
  const [allCompanies, setAllCompanies] = useState<{ id: string; name: string }[]>([])
  const [newCompanyId, setNewCompanyId] = useState<string>('')
  const [newCompanyRole, setNewCompanyRole] = useState<string>('viewer')
  const [superAdmin, setSuperAdmin] = useState(false)
  const { addToast } = useToast()
  const supabase = supabaseBrowser()

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        email: user.email || '',
        role: user.role || '',
        phone: user.phone || '',
        position: user.position || '',
        department: user.department || '',
        avatar_url: user.avatar_url || ''
      })
      setSuperAdmin(user.role === 'super_admin')
      const mapped = (user.company_roles || []).map(cr => ({
        company_id: cr.company?.id || '',
        company_name: cr.company?.name || 'Sin nombre',
        role: cr.role
      }))
      setCompanyRoles(mapped)
    }
  }, [user])

  useEffect(() => {
    const loadCompanies = async () => {
      const { data } = await supabase.from('companies').select('id,name').order('name')
      if (data) setAllCompanies(data)
    }
    if (isOpen) loadCompanies()
  }, [isOpen, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) return

    try {
      setLoading(true)

      const newProfileRole = superAdmin ? 'super_admin' : null

      const { data, error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name || null,
          role: newProfileRole,
          phone: formData.phone || null,
          position: formData.position || null,
          department: formData.department || null,
          avatar_url: formData.avatar_url || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating user:', error)
        throw error
      }

      // Sincronizar roles por empresa: limpiar y volver a insertar
      const rows = companyRoles.map(cr => ({
        user_id: user.id,
        company_id: cr.company_id,
        role: cr.role
      }))

      const { error: delError } = await supabase
        .from('company_user_roles')
        .delete()
        .eq('user_id', user.id)
      if (delError) throw delError

      if (rows.length > 0) {
        const { error: insError } = await supabase.from('company_user_roles').insert(rows)
        if (insError) throw insError
      }

      onSave({
        ...user,
        full_name: formData.full_name,
        role: newProfileRole || 'user',
        phone: formData.phone,
        position: formData.position,
        department: formData.department,
        avatar_url: formData.avatar_url,
        company_roles: companyRoles.map(cr => ({
          role: cr.role,
          company: { id: cr.company_id, name: cr.company_name }
        }))
      })

      addToast({
        type: 'success',
        title: 'Usuario actualizado',
        message: 'Los datos del usuario han sido actualizados correctamente'
      })

      onClose()
    } catch (err: any) {
      console.error('Error al actualizar usuario:', err)
      addToast({
        type: 'error',
        title: 'Error al actualizar usuario',
        message: err?.message || err?.error_description || JSON.stringify(err)
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    // Validar tamaño (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      addToast({
        type: 'error',
        title: 'Archivo muy grande',
        message: 'La imagen no debe superar los 5MB'
      })
      return
    }

    try {
      setUploading(true)

      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/avatar.${fileExt}`
      const filePath = `avatars/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('user-avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('user-avatars')
        .getPublicUrl(filePath)

      setFormData(prev => ({ ...prev, avatar_url: data.publicUrl }))

      addToast({
        type: 'success',
        title: 'Avatar actualizado',
        message: 'La imagen de perfil se ha actualizado correctamente'
      })
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error al subir imagen',
        message: 'No se pudo actualizar la imagen de perfil'
      })
    } finally {
      setUploading(false)
    }
  }

  const handleAddCompanyRole = () => {
    if (!newCompanyId || !newCompanyRole) return
    const companyName = allCompanies.find(c => c.id === newCompanyId)?.name || 'Empresa'
    setCompanyRoles(prev => {
      const exists = prev.some(p => p.company_id === newCompanyId)
      if (exists) {
        return prev.map(p => p.company_id === newCompanyId ? { ...p, role: newCompanyRole, company_name: companyName } : p)
      }
      return [...prev, { company_id: newCompanyId, role: newCompanyRole, company_name: companyName }]
    })
    setNewCompanyId('')
    setNewCompanyRole('viewer')
    addToast({ type: 'success', title: 'Asignación agregada', message: 'Rol por empresa pendiente de guardar' })
  }

  const handleRemoveCompanyRole = (companyId: string) => {
    setCompanyRoles(prev => prev.filter(p => p.company_id !== companyId))
    addToast({ type: 'success', title: 'Asignación eliminada', message: 'Quitar empresa pendiente de guardar' })
  }

  if (!isOpen || !user) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Editar Usuario
          </DialogTitle>
          <DialogDescription>
            Modifica la información del usuario {user.email}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={formData.avatar_url} alt={formData.full_name} />
                <AvatarFallback>
                  {formData.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <label
                htmlFor="avatar-upload"
                className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-1 cursor-pointer hover:bg-primary/90 transition-colors"
              >
                <Upload className="h-3 w-3" />
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </div>
            <div className="flex-1">
              <h3 className="font-medium">{formData.full_name || 'Sin nombre'}</h3>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click en el ícono para cambiar la imagen
              </p>
            </div>
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nombre Completo</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                placeholder="Nombre completo del usuario"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  value={formData.email}
                  disabled
                  className="bg-muted"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                El email no se puede modificar
              </p>
            </div>
          </div>

          {/* Rol global (solo toggle super admin) y cargo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Rol global</Label>
              <div className="border rounded-md p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">¿Es super admin?</p>
                    <p className="text-xs text-muted-foreground">Solo visible para super admins</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={superAdmin}
                    disabled={!isSuperAdminCurrent}
                    onChange={(e) => setSuperAdmin(e.target.checked)}
                    className="h-5 w-5"
                  />
                </div>
                {!isSuperAdminCurrent && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3" />
                    Solo un super admin puede cambiar esto.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">Cargo</Label>
              <Input
                id="position"
                value={formData.position}
                onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                placeholder="Ej: Jefe de Compras"
              />
            </div>
          </div>

          {/* Roles por empresa */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Roles por empresa</p>
                <p className="text-xs text-muted-foreground">Asigna o ajusta el rol del usuario en cada empresa</p>
              </div>
            </div>

            <div className="border rounded-md p-3 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <Label>Empresa</Label>
                  <Select value={newCompanyId} onValueChange={setNewCompanyId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {allCompanies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Rol</Label>
                  <Select value={newCompanyRole} onValueChange={setNewCompanyRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="manager">Gerente</SelectItem>
                      <SelectItem value="analyst">Analista</SelectItem>
                      <SelectItem value="viewer">Visualizador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button type="button" onClick={handleAddCompanyRole} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Asignar
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {companyRoles.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sin empresas asignadas.</p>
                )}
                {companyRoles.map((cr) => (
                  <div key={cr.company_id} className="flex items-center justify-between border rounded-md px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{cr.company_name}</p>
                      <p className="text-xs text-muted-foreground">{roleLabels[cr.role as keyof typeof roleLabels] || cr.role}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={cr.role}
                        onValueChange={(value) =>
                          setCompanyRoles((prev) =>
                            prev.map((p) => (p.company_id === cr.company_id ? { ...p, role: value } : p))
                          )
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="manager">Gerente</SelectItem>
                          <SelectItem value="analyst">Analista</SelectItem>
                          <SelectItem value="viewer">Visualizador</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handleRemoveCompanyRole(cr.company_id)}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Department and Phone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="department">Departamento</Label>
              <Input
                id="department"
                value={formData.department}
                onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                placeholder="Ej: Compras"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+56 9 1234 5678"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>Guardando...</>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
