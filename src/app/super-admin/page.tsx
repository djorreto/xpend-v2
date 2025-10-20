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
  Building2,
  Users,
  Plus,
  Edit,
  Trash2,
  Key,
  Search
} from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { LoadingSpinner } from '@/components/ui/loading'

interface Company {
  id: string
  name: string
  industry: string
  tax_id: string
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
  must_change_password: boolean
  created_at: string
}

export default function SuperAdminPage() {
  const supabase = supabaseBrowser()
  const router = useRouter()
  const { addToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [users, setUsers] = useState<SuperAdminUser[]>([])
  const [searchCompany, setSearchCompany] = useState('')
  const [searchUser, setSearchUser] = useState('')
  const [activeTab, setActiveTab] = useState('companies')

  // Form states for new company
  const [newCompany, setNewCompany] = useState({
    name: '',
    industry: '',
    tax_id: '',
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
          created_at
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Count users per company
      const companiesWithCount = await Promise.all(
        (data || []).map(async (company) => {
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
    } catch (error) {
      console.error('Error loading companies:', error)
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudieron cargar las empresas'
      })
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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // Note: Creating users requires Supabase Admin API
      // This would typically be done through a server-side API route
      // For now, we'll show a placeholder message
      addToast({
        type: 'info',
        title: 'Funcionalidad en desarrollo',
        message: 'La creación de usuarios requiere configuración adicional del servidor'
      })
    } catch (error) {
      console.error('Error creating user:', error)
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo crear el usuario'
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
                      <Input
                        id="company-industry"
                        value={newCompany.industry}
                        onChange={(e) => setNewCompany({ ...newCompany, industry: e.target.value })}
                        placeholder="Ej: Tecnología"
                        required
                      />
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
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <h3 className="font-semibold">{company.name}</h3>
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
                          onClick={() => {
                            // TODO: Implement edit
                            addToast({
                              type: 'info',
                              title: 'Próximamente',
                              message: 'Funcionalidad de edición en desarrollo'
                            })
                          }}
                        >
                          <Edit className="h-4 w-4" />
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
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <h3 className="font-semibold">{user.full_name || user.email}</h3>
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
                          onClick={() => {
                            // TODO: Implement edit
                            addToast({
                              type: 'info',
                              title: 'Próximamente',
                              message: 'Funcionalidad de edición en desarrollo'
                            })
                          }}
                        >
                          <Edit className="h-4 w-4" />
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
    </MainLayout>
  )
}

