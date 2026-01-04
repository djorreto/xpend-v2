'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { supabaseBrowser } from '@/lib/supabase'
import { UserPlus, Mail, Save, ShieldCheck, Tag, Building2, Loader2 } from 'lucide-react'
import { isValidRut, formatRut, cleanRut } from '@/lib/rut-utils'

interface UserInviteModalProps {
  isOpen: boolean
  onClose: () => void
  companyId?: string // si no viene, lo asigna el super admin
  onUserCreated: (newUser: any) => void
  companyName?: string
}

interface CompanyOption {
  id: string
  name: string
  tax_id: string | null
  category: string | null
}

export function UserInviteModal({ isOpen, onClose, companyId, companyName, onUserCreated }: UserInviteModalProps) {
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'viewer',
    position: '',
    department: '',
    phone: '',
    company_id: companyId || '',
    newCompanyName: '',
    newCompanyRut: '',
    newCompanyCategory: ''
  })
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [loading, setLoading] = useState(false)
  const { addToast } = useToast()
  const supabase = supabaseBrowser()

  const isSuperAdmin = !companyId

  const loadCompanies = async () => {
    const { data, error } = await supabase
      .from('companies')
      .select('id, name, tax_id, category')
      .order('name', { ascending: true })
    if (!error && data) setCompanies(data)
  }

  // Pre-cargar empresas si es super admin
  if (isSuperAdmin && companies.length === 0) {
    loadCompanies()
  }

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

      let targetCompanyId = companyId || formData.company_id

      // Si es super admin y no seleccionó empresa, intenta crear nueva
      if (!targetCompanyId) {
        const rut = formData.newCompanyRut.trim()
        if (!isValidRut(rut)) {
          addToast({ type: 'error', title: 'RUT inválido', message: 'Formato esperado 12345678-9' })
          setLoading(false)
          return
        }

        // Verificar duplicado
        const { data: existing, error: findError } = await supabase
          .from('companies')
          .select('id')
          .eq('tax_id', cleanRut(rut))
          .single()
        if (existing?.id) {
          addToast({ type: 'error', title: 'Empresa ya existe', message: 'RUT duplicado' })
          setLoading(false)
          return
        }

        // Crear empresa nueva
        const { data: newCo, error: coError } = await supabase
          .from('companies')
          .insert({
            name: formData.newCompanyName,
            tax_id: cleanRut(rut),
            category: formData.newCompanyCategory || 'Sin categoría'
          })
          .select()
          .single()

        if (coError || !newCo) throw coError
        targetCompanyId = newCo.id
      }

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
            role: null, // rol global (solo super_admin); usamos roles por empresa
            company_id: targetCompanyId,
            position: formData.position || null,
            department: formData.department || null,
            phone: formData.phone || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (profileError) throw profileError

        // Insertar rol por empresa
        const { error: roleError } = await supabase.from('company_user_roles').insert({
          user_id: profileData.id,
          company_id: targetCompanyId,
          role: formData.role
        })
        if (roleError) throw roleError

        onUserCreated({
          ...profileData,
          company_roles: [
            {
              role: formData.role,
              company: { id: targetCompanyId, name: companies.find(c => c.id === targetCompanyId)?.name || companyName || '' }
            }
          ]
        })

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
          phone: '',
          company_id: companyId || '',
          newCompanyName: '',
          newCompanyRut: '',
          newCompanyCategory: ''
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

          {isSuperAdmin && (
            <div className="space-y-4 border rounded-lg p-3">
          <p className="text-sm font-medium">Empresa destino</p>
              <div className="space-y-2">
                <Label>Selecciona empresa existente</Label>
                <Select
                  value={formData.company_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, company_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map(co => (
                      <SelectItem key={co.id} value={co.id}>
                        {co.name} {co.tax_id ? `(${formatRut(co.tax_id)})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <p className="text-xs text-muted-foreground">O crea una empresa nueva:</p>
              <div className="space-y-2">
                <Label>Nombre empresa</Label>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <Input
                    value={formData.newCompanyName}
                    onChange={(e) => setFormData(prev => ({ ...prev, newCompanyName: e.target.value }))}
                    placeholder="Nueva empresa"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>RUT</Label>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  <Input
                    value={formData.newCompanyRut}
                    onChange={(e) => setFormData(prev => ({ ...prev, newCompanyRut: e.target.value }))}
                    placeholder="12345678-9"
                  />
                </div>
                {formData.newCompanyRut && isValidRut(formData.newCompanyRut) && (
                  <p className="text-xs text-muted-foreground">
                    Formato: {formatRut(formData.newCompanyRut)}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Categoría</Label>
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <Input
                    value={formData.newCompanyCategory}
                    onChange={(e) => setFormData(prev => ({ ...prev, newCompanyCategory: e.target.value }))}
                    placeholder="Categoría/Industria"
                  />
                </div>
              </div>
            </div>
          )}

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
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
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
