'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  User,
  Mail,
  Shield,
  Edit,
  Trash2,
  UserPlus
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { supabaseBrowser } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/loading'
import { ErrorMessage } from '@/components/ui/error'
import { useToast } from '@/components/ui/toast'
import { UserEditModal } from '@/components/forms/user-edit-modal'
import { UserInviteModal } from '@/components/forms/user-invite-modal'

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  role: string
  created_at: string
  updated_at: string
  companies: {
    name: string
  } | null
}

const roleColors = {
  admin: 'bg-red-100 text-red-800',
  manager: 'bg-blue-100 text-blue-800',
  analyst: 'bg-green-100 text-green-800',
  viewer: 'bg-gray-100 text-gray-800'
}

const roleLabels = {
  admin: 'Administrador',
  manager: 'Gerente',
  analyst: 'Analista',
  viewer: 'Visualizador'
}

export default function UsersPage() {
  const supabase = supabaseBrowser()
  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const { addToast } = useToast()

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      setError(null)

      // Ensure session is hydrated
      let { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        await new Promise(r => setTimeout(r, 150))
        ;({ data: { session } } = await supabase.auth.getSession())
      }
      const authUser = session?.user
      if (!authUser) throw new Error('Usuario no autenticado')

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

      // Get company info
      if (profile.company_id) {
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', profile.company_id)
          .single()

        if (!companyError && companyData) {
          setCompany(companyData)
        }

        // Load users from the same company
        const { data: usersData, error: usersError } = await supabase
          .from('profiles')
          .select(`
            *,
            companies(name)
          `)
          .eq('company_id', profile.company_id)
          .order('created_at', { ascending: false })

        if (usersError) throw usersError
        setUsers(usersData || [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar usuarios')
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudieron cargar los usuarios'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este usuario?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId)

      if (error) throw error

      setUsers(prev => prev.filter(u => u.id !== userId))
      addToast({
        type: 'success',
        title: 'Usuario eliminado',
        message: 'El usuario ha sido eliminado correctamente'
      })
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo eliminar el usuario'
      })
    }
  }

  const handleEditUser = (user: UserProfile) => {
    setSelectedUser(user)
    setEditModalOpen(true)
  }

  const handleUserUpdated = (updatedUser: UserProfile) => {
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u))
  }

  const handleUserCreated = (newUser: UserProfile) => {
    setUsers(prev => [newUser, ...prev])
  }

  const filteredUsers = users.filter(user =>
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
          title="Error al cargar usuarios"
          message={error}
          onRetry={loadUsers}
        />
      </MainLayout>
    )
  }

  return (
    <MainLayout user={user} companyName={company?.name || 'Spendora'}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Usuarios</h1>
            <p className="text-muted-foreground">
              Gestiona los usuarios de tu empresa
            </p>
          </div>
          <Button onClick={() => setInviteModalOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invitar Usuario
          </Button>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar usuarios..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                Filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Users Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredUsers.map((userProfile) => (
            <Card key={userProfile.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">
                      {userProfile.full_name || 'Sin nombre'}
                    </CardTitle>
                    <CardDescription className="flex items-center space-x-1">
                      <Mail className="h-3 w-3" />
                      <span>{userProfile.email}</span>
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Role */}
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColors[userProfile.role as keyof typeof roleColors]}`}>
                    {roleLabels[userProfile.role as keyof typeof roleLabels]}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(userProfile.created_at)}
                  </span>
                </div>

                {/* Company */}
                <div className="flex items-center space-x-2 text-sm">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {userProfile.companies?.name || 'Sin empresa'}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEditUser(userProfile)}
                  >
                    <Edit className="h-4 w-4" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteUser(userProfile.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {filteredUsers.length === 0 && users.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <User className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay usuarios</h3>
              <p className="text-muted-foreground text-center mb-4">
                Invita usuarios a tu empresa para comenzar a colaborar
              </p>
              <Button onClick={() => setInviteModalOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Invitar Usuario
              </Button>
            </CardContent>
          </Card>
        )}

        {/* No Results */}
        {filteredUsers.length === 0 && users.length > 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Search className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No se encontraron usuarios</h3>
              <p className="text-muted-foreground text-center mb-4">
                Intenta con otros términos de búsqueda
              </p>
            </CardContent>
          </Card>
        )}

        {/* Modals */}
        <UserEditModal
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false)
            setSelectedUser(null)
          }}
          user={selectedUser}
          onSave={handleUserUpdated}
        />

        <UserInviteModal
          isOpen={inviteModalOpen}
          onClose={() => setInviteModalOpen(false)}
          companyId={company?.id}
          onUserCreated={handleUserCreated}
        />
      </div>
    </MainLayout>
  )
}
