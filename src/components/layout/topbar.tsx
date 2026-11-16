'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, User, LogOut, Settings, Home, Key, Menu, Globe, Compass } from 'lucide-react'
import { startTour, useDemoTours } from '@/components/guided-tour'
import { roleLabel } from '@/lib/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { supabaseBrowser } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { Logo } from '@/components/ui/logo'
import { NotificationsDropdown } from '@/components/ui/notifications'
import { ChangePasswordModal } from '@/components/forms/change-password-modal'

interface TopbarProps {
  user?: {
    name: string
    email: string
    avatar?: string
    role: string
  }
  onOpenMobileMenu?: () => void
}

export function Topbar({ user, onOpenMobileMenu }: TopbarProps) {
  const supabase = supabaseBrowser()
  const [searchQuery, setSearchQuery] = useState('')
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const router = useRouter()
  const { addToast } = useToast()
  const isSupplier = user?.role === 'supplier'
  const homeHref = isSupplier ? '/sala' : '/dashboard'
  const { startable } = useDemoTours()

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        addToast({
          type: 'error',
          title: 'Error',
          message: 'No se pudo cerrar la sesión'
        })
      } else {
        addToast({
          type: 'success',
          title: 'Sesión cerrada',
          message: 'Has cerrado sesión correctamente'
        })
        router.push('/login')
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Ocurrió un error inesperado'
      })
    }
  }

  return (
    <header className="sticky top-0 z-40 rounded-[20px] border border-white/70 bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_16px_40px_-28px_rgba(45,62,61,0.55)] backdrop-blur-2xl">
      <div className="flex h-[52px] items-center justify-between gap-3 px-3 md:px-4">
        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-10 w-10"
          onClick={onOpenMobileMenu}
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex-1">
          <button
            type="button"
            className="text-sm font-medium tracking-tight text-petrol-blue sm:hidden"
            onClick={() => router.push(homeHref)}
          >
            Xpend
          </button>
          {!isSupplier && (
            <form
              role="search"
              className="relative hidden max-w-md sm:block"
              onSubmit={(event) => {
                event.preventDefault()
                const query = searchQuery.trim()
                router.push(query ? `/procesos?q=${encodeURIComponent(query)}` : '/procesos')
              }}
            >
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                aria-label="Buscar procesos por nombre o código"
                placeholder="Buscar RFx, licitaciones o salas…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-full border-white/60 bg-white/50 pl-10"
              />
            </form>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-2 md:space-x-4">
          {/* Logo - Hidden on mobile and tablet */}
          <div className="hidden lg:flex items-center cursor-pointer" onClick={() => router.push('/home')}>
            <Logo size="sm" />
          </div>

          {/* Notifications */}
          <NotificationsDropdown />

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full" aria-label="Menú de usuario">
                <Avatar className="h-8 w-8">
                  {user?.avatar ? (
                    <AvatarImage src={user.avatar} alt={user?.name} />
                  ) : null}
                  <AvatarFallback className="bg-gray-300 text-gray-600">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {roleLabel(user?.role)}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push(homeHref)}>
                <Home className="mr-2 h-4 w-4" />
                <span>{isSupplier ? 'Mis procesos' : 'Inicio'}</span>
              </DropdownMenuItem>
              {!isSupplier && (
                <DropdownMenuItem onClick={() => router.push('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Mi cuenta y configuración</span>
                </DropdownMenuItem>
              )}
              {startable[0] && (
                <DropdownMenuItem onClick={() => startTour(startable[0].id)} data-testid="menu-recorrido">
                  <Compass className="mr-2 h-4 w-4" />
                  <span>Recorrido guiado</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => router.push('/home')}>
                <Globe className="mr-2 h-4 w-4" />
                <span>Sitio web de Xpend</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
                <Key className="mr-2 h-4 w-4" />
                <span>Cambiar Contraseña</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </header>
  )
}

