'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Building2,
  Users,
  Plus,
  Edit,
  Trash2,
  Key,
  Search,
  Ban,
  CheckCircle
} from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { LoadingSpinner } from '@/components/ui/loading'

interface Company {
  id: string
  name: string
  industry: string
  tax_id: string
  is_active?: boolean
  created_at: string
  users_count?: number
}

interface SuperAdminUser {
  id: string
  email: string
  full_name: string
  role: string
  company_id: string
  company_name?: string
  is_active?: boolean
  must_change_password: boolean
  created_at: string
}

export default function SuperAdminPage() {
  const supabase = supabaseBrowser()
  const router = useRouter()
  const { addToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [users, setUsers] = useState<SuperAdminUser[]>([])
  const [searchCompany, setSearchCompany] = useState('')
  const [searchUser, setSearchUser] = useState('')
  const [activeTab, setActiveTab] = useState('companies')

  // Modal states for company editing
  const [editCompanyModalOpen, setEditCompanyModalOpen] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [editCompanyForm, setEditCompanyForm] = useState({
    name: '',
    industry: '',
    tax_id: '',
  })

  // Form states for new company
  const [newCompany, setNewCompany] = useState({
    name: '',
    industry: '',
    tax_id: '',
  })

  // Modal states for user editing
  const [editUserModalOpen, setEditUserModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<SuperAdminUser | null>(null)
  const [editUserForm, setEditUserForm] = useState({
    full_name: '',
    role: 'user' as 'super_admin' | 'admin' | 'manager' | 'user' | 'demo',
    company_id: '',
    new_password: '',
  })

  // Form states for new user
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'user',
    company_id: '',
  })

  useEffect(() => {
    checkSuperAdminAccess()
  }, [])

  const checkSuperAdminAccess = async () => {
    try {
      setLoading(true)

      // 1) Verificar sesión
      let { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        await new Promise(r => setTimeout(r, 150))
        ;({ data: { session } } = await supabase.auth.getSession())
      }
      const authUser = session?.user
      if (!authUser) {
        router.push('/login')
        return
      }

      // 2) Verificar que el usuario es super_admin
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, role, email')
        .eq('id', authUser.id)
        .single()

      if (profileError || !profile || profile.role !== 'super_admin') {
        addToast({
          type: 'error',
          title: 'Acceso Denegado',
          message: 'No tienes permisos para acceder a esta página'
        })
        router.push('/dashboard')
        return
      }

      setUser({
        name: profile.full_name || authUser.email,
        email: authUser.email || profile.email,
        role: profile.role
      })
      setCurrentUserId(authUser.id)

      // 3) Cargar datos
      await Promise.all([loadCompanies(), loadUsers()])
    } catch (error) {
      console.error('Error checking super admin access:', error)
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo verificar el acceso'
      })
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const loadCompanies = async () => {
    try {
            const { data, error } = await supabase
              .from('companies')
              .select(`
                id,
                name,
                industry,
                tax_id,
                is_active,
                created_at
              `)
              .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading companies:', error)
        throw error
      }

      // Si no hay empresas, setear array vacío
      if (!data || data.length === 0) {
        setCompanies([])
        return
      }

      // Count users per company
      const companiesWithCount = await Promise.all(
        data.map(async (company) => {
          const { count } = await supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', company.id)

          return {
            ...company,
            users_count: count || 0
          }
        })
      )

      setCompanies(companiesWithCount)
    } catch (error: any) {
      console.error('Error loading companies:', error)
      // No mostrar toast si simplemente no hay empresas
      if (error?.code !== 'PGRST116') {
        addToast({
          type: 'error',
          title: 'Error',
          message: error?.message || 'No se pudieron cargar las empresas'
        })
      } else {
        // Si es un error de tabla no encontrada o sin datos, setear array vacío
        setCompanies([])
      }
    }
  }

  const loadUsers = async () => {
    try {
            const { data, error } = await supabase
              .from('profiles')
              .select(`
                id,
                email,
                full_name,
                role,
                company_id,
                is_active,
                must_change_password,
                created_at
              `)
              .order('created_at', { ascending: false })

      if (error) throw error

      // Get company names
      const usersWithCompany = await Promise.all(
        (data || []).map(async (user) => {
          if (user.company_id) {
            const { data: company } = await supabase
              .from('companies')
              .select('name')
              .eq('id', user.company_id)
              .single()

            return {
              ...user,
              company_name: company?.name || 'Sin empresa'
            }
          }
          return {
            ...user,
            company_name: 'Sin empresa'
          }
        })
      )

      setUsers(usersWithCompany)
    } catch (error) {
      console.error('Error loading users:', error)
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudieron cargar los usuarios'
      })
    }
  }

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { error } = await supabase
        .from('companies')
        .insert({
          name: newCompany.name,
          industry: newCompany.industry,
          tax_id: newCompany.tax_id,
        })

      if (error) throw error

      addToast({
        type: 'success',
        title: 'Empresa creada',
        message: `La empresa ${newCompany.name} ha sido creada correctamente`
      })

      // Reset form
      setNewCompany({ name: '', industry: '', tax_id: '' })
      await loadCompanies()
    } catch (error) {
      console.error('Error creating company:', error)
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo crear la empresa'
      })
    }
  }

  const handleEditCompany = (company: Company) => {
    setSelectedCompany(company)
    setEditCompanyForm({
      name: company.name,
      industry: company.industry,
      tax_id: company.tax_id,
    })
    setEditCompanyModalOpen(true)
  }

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCompany) return

    try {
      const { error } = await supabase
        .from('companies')
        .update({
          name: editCompanyForm.name,
          industry: editCompanyForm.industry,
          tax_id: editCompanyForm.tax_id,
        })
        .eq('id', selectedCompany.id)

      if (error) throw error

      addToast({
        type: 'success',
        title: 'Empresa actualizada',
        message: `La empresa ${editCompanyForm.name} ha sido actualizada correctamente`
      })

      setEditCompanyModalOpen(false)
      setSelectedCompany(null)
      setEditCompanyForm({ name: '', industry: '', tax_id: '' })
      await loadCompanies()
    } catch (error) {
      console.error('Error updating company:', error)
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo actualizar la empresa'
      })
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // Validate fields
      if (!newUser.email || !newUser.password || !newUser.full_name || !newUser.role || !newUser.company_id) {
        addToast({
          type: 'error',
          title: 'Campos incompletos',
          message: 'Por favor completa todos los campos'
        })
        return
      }

      if (newUser.password.length < 6) {
        addToast({
          type: 'error',
          title: 'Contraseña inválida',
          message: 'La contraseña debe tener al menos 6 caracteres'
        })
        return
      }

      // Get current session token for authorization
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No hay sesión activa')
      }

      // Call API to create user
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          email: newUser.email,
          password: newUser.password,
          full_name: newUser.full_name,
          role: newUser.role,
          company_id: newUser.company_id,
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear el usuario')
      }

      addToast({
        type: 'success',
        title: 'Usuario creado',
        message: `El usuario ${newUser.full_name} ha sido creado correctamente`
      })

      // Reset form
      setNewUser({
        email: '',
        password: '',
        full_name: '',
        role: 'user',
        company_id: '',
      })

      // Reload users
      await loadUsers()
    } catch (error: any) {
      console.error('Error creating user:', error)
      addToast({
        type: 'error',
        title: 'Error',
        message: error.message || 'No se pudo crear el usuario'
      })
    }
  }

  const handleEditUser = (user: SuperAdminUser) => {
    setSelectedUser(user)
    setEditUserForm({
      full_name: user.full_name || '',
      role: user.role as 'super_admin' | 'admin' | 'manager' | 'user' | 'demo',
      company_id: user.company_id || 'none',
      new_password: '',
    })
    setEditUserModalOpen(true)
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return

    try {
      // Validate password if provided
      if (editUserForm.new_password && editUserForm.new_password.length < 6) {
        addToast({
          type: 'error',
          title: 'Contraseña inválida',
          message: 'La contraseña debe tener al menos 6 caracteres'
        })
        return
      }

      // Update profile (without company_id, it cannot be changed)
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editUserForm.full_name,
          role: editUserForm.role,
        })
        .eq('id', selectedUser.id)

      if (error) throw error

      // If new password is provided, reset it
      if (editUserForm.new_password) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          throw new Error('No hay sesión activa')
        }

        const response = await fetch('/api/admin/reset-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            user_id: selectedUser.id,
            new_password: editUserForm.new_password,
          })
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Error al resetear la contraseña')
        }
      }

      addToast({
        type: 'success',
        title: 'Usuario actualizado',
        message: editUserForm.new_password
          ? `Usuario actualizado. Se ha reseteado la contraseña y el usuario deberá cambiarla en su próximo ingreso.`
          : `El usuario ${editUserForm.full_name} ha sido actualizado correctamente`
      })

      setEditUserModalOpen(false)
      setSelectedUser(null)
      setEditUserForm({ full_name: '', role: 'user', company_id: '', new_password: '' })
      await loadUsers()
    } catch (error: any) {
      console.error('Error updating user:', error)
      addToast({
        type: 'error',
        title: 'Error',
        message: error.message || 'No se pudo actualizar el usuario'
      })
    }
  }

  const handleToggleCompanyStatus = async (companyId: string, companyName: string, currentStatus: boolean) => {
    const action = currentStatus ? 'inhabilitar' : 'habilitar'
    const actionCaps = currentStatus ? 'Inhabilitar' : 'Habilitar'

    if (!confirm(`¿Estás seguro de ${action} la empresa "${companyName}"? ${currentStatus ? 'Los usuarios de esta empresa no podrán acceder a Xpend.' : 'Los usuarios activos de esta empresa podrán acceder nuevamente.'}`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('companies')
        .update({ is_active: !currentStatus })
        .eq('id', companyId)

      if (error) throw error

      addToast({
        type: 'success',
        title: `Empresa ${currentStatus ? 'inhabilitada' : 'habilitada'}`,
        message: `La empresa ${companyName} ha sido ${currentStatus ? 'inhabilitada' : 'habilitada'} correctamente`
      })

      await loadCompanies()
    } catch (error) {
      console.error('Error toggling company status:', error)
      addToast({
        type: 'error',
        title: 'Error',
        message: `No se pudo ${action} la empresa`
      })
    }
  }

  const handleToggleUserStatus = async (userId: string, userName: string, currentStatus: boolean) => {
    // Verificar si el usuario intenta inhabilitarse a sí mismo
    const { data: { user: currentUser } } = await supabase.auth.getUser()

    if (currentUser?.id === userId && currentStatus) {
      addToast({
        type: 'error',
        title: 'Acción no permitida',
        message: 'No puedes inhabilitarte a ti mismo'
      })
      return
    }

    const action = currentStatus ? 'inhabilitar' : 'habilitar'

    if (!confirm(`¿Estás seguro de ${action} al usuario "${userName}"? ${currentStatus ? 'Este usuario no podrá acceder a Xpend.' : 'Este usuario podrá acceder nuevamente a Xpend.'}`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', userId)

      if (error) throw error

      addToast({
        type: 'success',
        title: `Usuario ${currentStatus ? 'inhabilitado' : 'habilitado'}`,
        message: `El usuario ${userName} ha sido ${currentStatus ? 'inhabilitado' : 'habilitado'} correctamente`
      })

      await loadUsers()
    } catch (error) {
      console.error('Error toggling user status:', error)
      addToast({
        type: 'error',
        title: 'Error',
        message: `No se pudo ${action} el usuario`
      })
    }
  }

  const handleDeleteCompany = async (companyId: string, companyName: string) => {
    if (!confirm(`¿Estás seguro de eliminar la empresa "${companyName}"? Esta acción eliminará todos los datos asociados.`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', companyId)

      if (error) throw error

      addToast({
        type: 'success',
        title: 'Empresa eliminada',
        message: `La empresa ${companyName} ha sido eliminada`
      })

      await loadCompanies()
    } catch (error) {
      console.error('Error deleting company:', error)
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo eliminar la empresa'
      })
    }
  }

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchCompany.toLowerCase()) ||
    company.industry?.toLowerCase().includes(searchCompany.toLowerCase())
  )

  const filteredUsers = users.filter(user =>
    user.email?.toLowerCase().includes(searchUser.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchUser.toLowerCase()) ||
    user.company_name?.toLowerCase().includes(searchUser.toLowerCase())
  )

  if (loading) {
    return (
      <MainLayout user={user} companyName="Xpend">
        <LoadingSpinner />
      </MainLayout>
    )
  }

  return (
    <MainLayout user={user} companyName="Xpend">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Super Admin</h1>
          <p className="text-muted-foreground">
            Gestión de empresas y usuarios de la plataforma
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="companies" className="flex items-center">
              <Building2 className="mr-2 h-4 w-4" />
              Empresas ({companies.length})
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center">
              <Users className="mr-2 h-4 w-4" />
              Usuarios ({users.length})
            </TabsTrigger>
          </TabsList>

          {/* Companies Tab */}
          <TabsContent value="companies" className="space-y-4">
                {/* Create Company Form */}
                <Card>
                  <CardHeader>
                    <CardTitle>Crear Nueva Empresa</CardTitle>
                    <CardDescription>
                      Registra una nueva empresa en la plataforma
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleCreateCompany} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="company-name">Nombre de la Empresa</Label>
                          <Input
                            id="company-name"
                            value={newCompany.name}
                            onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                            placeholder="Ej: Empresa Demo S.A."
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="company-industry">Industria</Label>
                          <Select
                            value={newCompany.industry}
                            onValueChange={(value) => setNewCompany({ ...newCompany, industry: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona una industria..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Tecnología">Tecnología</SelectItem>
                              <SelectItem value="Manufactura">Manufactura</SelectItem>
                              <SelectItem value="Retail">Retail</SelectItem>
                              <SelectItem value="Servicios">Servicios</SelectItem>
                              <SelectItem value="Construcción">Construcción</SelectItem>
                              <SelectItem value="Alimentos y Bebidas">Alimentos y Bebidas</SelectItem>
                              <SelectItem value="Salud">Salud</SelectItem>
                              <SelectItem value="Educación">Educación</SelectItem>
                              <SelectItem value="Energía">Energía</SelectItem>
                              <SelectItem value="Transporte y Logística">Transporte y Logística</SelectItem>
                              <SelectItem value="Finanzas">Finanzas</SelectItem>
                              <SelectItem value="Telecomunicaciones">Telecomunicaciones</SelectItem>
                              <SelectItem value="Minería">Minería</SelectItem>
                              <SelectItem value="Agricultura">Agricultura</SelectItem>
                              <SelectItem value="Turismo y Hotelería">Turismo y Hotelería</SelectItem>
                              <SelectItem value="Medios y Entretenimiento">Medios y Entretenimiento</SelectItem>
                              <SelectItem value="Gobierno">Gobierno</SelectItem>
                              <SelectItem value="Otra">Otra</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="company-tax-id">RUT</Label>
                          <Input
                            id="company-tax-id"
                            value={newCompany.tax_id}
                            onChange={(e) => setNewCompany({ ...newCompany, tax_id: e.target.value })}
                            placeholder="Ej: 76.123.456-7"
                            required
                          />
                        </div>
                      </div>
                      <Button type="submit">
                        <Plus className="mr-2 h-4 w-4" />
                        Crear Empresa
                      </Button>
                    </form>
                  </CardContent>
                </Card>

            {/* Companies List */}
            <Card>
              <CardHeader>
                <CardTitle>Empresas Registradas</CardTitle>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar empresas..."
                    className="pl-10"
                    value={searchCompany}
                    onChange={(e) => setSearchCompany(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredCompanies.map((company) => (
                    <div
                      key={company.id}
                      className={`flex items-center justify-between p-4 border rounded-lg ${company.is_active === false ? 'bg-muted/50' : ''}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{company.name}</h3>
                          {company.is_active !== false ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Activa
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                              <Ban className="h-3 w-3 mr-1" />
                              Inactiva
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {company.industry} • RUT: {company.tax_id}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {company.users_count || 0} usuarios
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditCompany(company)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleCompanyStatus(company.id, company.name, company.is_active !== false)}
                          className={company.is_active !== false ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}
                        >
                          {company.is_active !== false ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteCompany(company.id, company.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {filteredCompanies.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No se encontraron empresas
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            {/* Create User Form */}
            <Card>
              <CardHeader>
                <CardTitle>Crear Nuevo Usuario</CardTitle>
                <CardDescription>
                  Registra un nuevo usuario con contraseña temporal
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="user-email">Email</Label>
                      <Input
                        id="user-email"
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        placeholder="usuario@empresa.com"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="user-name">Nombre Completo</Label>
                      <Input
                        id="user-name"
                        value={newUser.full_name}
                        onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                        placeholder="Juan Pérez"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="user-password">Contraseña Temporal</Label>
                      <Input
                        id="user-password"
                        type="password"
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        placeholder="Mínimo 6 caracteres"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="user-role">Rol</Label>
                      <Select
                        value={newUser.role}
                        onValueChange={(value) => setNewUser({ ...newUser, role: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">Usuario</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="demo">Demo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="user-company">Empresa</Label>
                      <Select
                        value={newUser.company_id}
                        onValueChange={(value) => setNewUser({ ...newUser, company_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una empresa..." />
                        </SelectTrigger>
                        <SelectContent>
                          {companies.map((company) => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button type="submit">
                    <Plus className="mr-2 h-4 w-4" />
                    Crear Usuario
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Users List */}
            <Card>
              <CardHeader>
                <CardTitle>Usuarios Registrados</CardTitle>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar usuarios..."
                    className="pl-10"
                    value={searchUser}
                    onChange={(e) => setSearchUser(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className={`flex items-center justify-between p-4 border rounded-lg ${user.is_active === false ? 'bg-muted/50' : ''}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{user.full_name || user.email}</h3>
                          {user.is_active !== false ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Activo
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                              <Ban className="h-3 w-3 mr-1" />
                              Inactivo
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {user.email} • {user.role}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {user.company_name}
                          {user.must_change_password && (
                            <span className="ml-2 text-yellow-600">
                              <Key className="inline h-3 w-3 mr-1" />
                              Debe cambiar contraseña
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditUser(user)}
                          title="Editar usuario"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleUserStatus(user.id, user.full_name || user.email, user.is_active !== false)}
                          disabled={user.id === currentUserId && user.is_active !== false}
                          className={user.is_active !== false ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}
                          title={
                            user.id === currentUserId && user.is_active !== false
                              ? 'No puedes inhabilitarte a ti mismo'
                              : user.is_active !== false
                                ? 'Inhabilitar usuario'
                                : 'Habilitar usuario'
                          }
                        >
                          {user.is_active !== false ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  ))}
                  {filteredUsers.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No se encontraron usuarios
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Company Modal */}
      <Dialog open={editCompanyModalOpen} onOpenChange={setEditCompanyModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Editar Empresa</DialogTitle>
            <DialogDescription>
              Modifica los datos de la empresa
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateCompany}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-company-name">Nombre de la Empresa</Label>
                <Input
                  id="edit-company-name"
                  value={editCompanyForm.name}
                  onChange={(e) =>
                    setEditCompanyForm({ ...editCompanyForm, name: e.target.value })
                  }
                  placeholder="Ej: Empresa Demo S.A."
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-company-industry">Industria</Label>
                <Select
                  value={editCompanyForm.industry}
                  onValueChange={(value) =>
                    setEditCompanyForm({ ...editCompanyForm, industry: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una industria..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tecnología">Tecnología</SelectItem>
                    <SelectItem value="Manufactura">Manufactura</SelectItem>
                    <SelectItem value="Retail">Retail</SelectItem>
                    <SelectItem value="Servicios">Servicios</SelectItem>
                    <SelectItem value="Construcción">Construcción</SelectItem>
                    <SelectItem value="Alimentos y Bebidas">Alimentos y Bebidas</SelectItem>
                    <SelectItem value="Salud">Salud</SelectItem>
                    <SelectItem value="Educación">Educación</SelectItem>
                    <SelectItem value="Energía">Energía</SelectItem>
                    <SelectItem value="Transporte y Logística">Transporte y Logística</SelectItem>
                    <SelectItem value="Finanzas">Finanzas</SelectItem>
                    <SelectItem value="Telecomunicaciones">Telecomunicaciones</SelectItem>
                    <SelectItem value="Minería">Minería</SelectItem>
                    <SelectItem value="Agricultura">Agricultura</SelectItem>
                    <SelectItem value="Turismo y Hotelería">Turismo y Hotelería</SelectItem>
                    <SelectItem value="Medios y Entretenimiento">Medios y Entretenimiento</SelectItem>
                    <SelectItem value="Gobierno">Gobierno</SelectItem>
                    <SelectItem value="Otra">Otra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-company-tax-id">RUT</Label>
                <Input
                  id="edit-company-tax-id"
                  value={editCompanyForm.tax_id}
                  onChange={(e) =>
                    setEditCompanyForm({ ...editCompanyForm, tax_id: e.target.value })
                  }
                  placeholder="Ej: 76.123.456-7"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditCompanyModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">
                <Edit className="mr-2 h-4 w-4" />
                Actualizar Empresa
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={editUserModalOpen} onOpenChange={setEditUserModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>
              Modifica los datos del usuario
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateUser}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-user-name">Nombre Completo</Label>
                <Input
                  id="edit-user-name"
                  value={editUserForm.full_name}
                  onChange={(e) =>
                    setEditUserForm({ ...editUserForm, full_name: e.target.value })
                  }
                  placeholder="Juan Pérez"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-user-role">Rol</Label>
                <Select
                  value={editUserForm.role}
                  onValueChange={(value: any) =>
                    setEditUserForm({ ...editUserForm, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuario</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="demo">Demo</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-user-company" className="text-muted-foreground">
                  Empresa (no editable)
                </Label>
                <Input
                  id="edit-user-company"
                  value={selectedUser?.company_name || 'Sin empresa'}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  La empresa no puede ser modificada una vez asignada
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-user-password">
                  Nueva Contraseña (opcional)
                </Label>
                <Input
                  id="edit-user-password"
                  type="password"
                  value={editUserForm.new_password}
                  onChange={(e) =>
                    setEditUserForm({ ...editUserForm, new_password: e.target.value })
                  }
                  placeholder="Dejar vacío para no cambiar"
                />
                <p className="text-xs text-muted-foreground">
                  Si estableces una nueva contraseña, el usuario deberá cambiarla en su próximo ingreso
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditUserModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">
                <Edit className="mr-2 h-4 w-4" />
                Actualizar Usuario
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  )
}


