'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { supabaseBrowser } from '@/lib/supabase'
import { UserPlus, Mail, Save } from 'lucide-react'

interface UserInviteModalProps {
  isOpen: boolean
  onClose: () => void
  companyId: string
  onUserCreated: (newUser: any) => void
}

export function UserInviteModal({ isOpen, onClose, companyId, onUserCreated }: UserInviteModalProps) {
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'viewer',
    position: '',
    department: '',
    phone: ''
  })
  const [loading, setLoading] = useState(false)
  const { addToast } = useToast()
  const supabase = supabaseBrowser()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.email) {
      addToast({
        type: 'error',
        title: 'Email requerido',
        message: 'El email es obligatorio'
      })
      return
    }

    try {
      setLoading(true)

      // Crear el usuario en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: formData.email,
        email_confirm: true, // Auto-confirmar email
        user_metadata: {
          full_name: formData.full_name
        }
      })

      if (authError) throw authError

      if (authData.user) {
        // Crear el perfil en la tabla profiles
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            email: formData.email,
            full_name: formData.full_name || null,
            role: formData.role,
            company_id: companyId,
            position: formData.position || null,
            department: formData.department || null,
            phone: formData.phone || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (profileError) throw profileError

        onUserCreated(profileData)

        addToast({
          type: 'success',
          title: 'Usuario creado',
          message: `${formData.email} ha sido agregado a la empresa`
        })

        // Reset form
        setFormData({
          email: '',
          full_name: '',
          role: 'viewer',
          position: '',
          department: '',
          phone: ''
        })

        onClose()
      }
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error al crear usuario',
        message: err instanceof Error ? err.message : 'Error desconocido'
      })
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invitar Usuario
          </DialogTitle>
          <DialogDescription>
            Agrega un nuevo usuario a tu empresa
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="usuario@empresa.com"
                required
              />
            </div>
          </div>

          {/* Nombre */}
          <div className="space-y-2">
            <Label htmlFor="full_name">Nombre Completo</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              placeholder="Nombre completo del usuario"
            />
          </div>

          {/* Rol */}
          <div className="space-y-2">
            <Label htmlFor="role">Rol</Label>
            <Select value={formData.role} onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Visualizador</SelectItem>
                <SelectItem value="analyst">Analista</SelectItem>
                <SelectItem value="manager">Gerente</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Cargo */}
          <div className="space-y-2">
            <Label htmlFor="position">Cargo</Label>
            <Input
              id="position"
              value={formData.position}
              onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
              placeholder="Ej: Jefe de Compras"
            />
          </div>

          {/* Departamento */}
          <div className="space-y-2">
            <Label htmlFor="department">Departamento</Label>
            <Input
              id="department"
              value={formData.department}
              onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
              placeholder="Ej: Compras"
            />
          </div>

          {/* Teléfono */}
          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="+56 9 1234 5678"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>Creando...</>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Crear Usuario
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
