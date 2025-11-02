'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  BarChart3,
  Settings,
  Users,
  ChevronLeft,
  ChevronRight,
  Building2,
  Gavel,
  TrendingUp,
  Truck,
  Target,
  Shield,
  Brain,
  FileEdit,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Sourcing Intelligence', href: '/sourcing-intelligence', icon: Brain },
  { name: 'Sourcing Plan', href: '/sourcing-plan', icon: Target },
  { name: 'RFx Maker', href: '/rfx-maker', icon: FileEdit },
  { name: 'Proyectos', href: '/projects', icon: FolderOpen },
  { name: 'Licitaciones', href: '/licitaciones', icon: Gavel },
  { name: 'Proveedores', href: '/suppliers', icon: Truck },
  { name: 'Spend Analysis', href: '/spend', icon: TrendingUp },
  { name: 'Reportes', href: '/reports', icon: BarChart3 },
  { name: 'Usuarios', href: '/users', icon: Users },
  { name: 'Configuración', href: '/settings', icon: Settings },
]

interface SidebarProps {
  companyName?: string
  userRole?: string
  mobileMenuOpen?: boolean
  onCloseMobileMenu?: () => void
}

export function Sidebar({ companyName, userRole, mobileMenuOpen = false, onCloseMobileMenu }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [cachedRole, setCachedRole] = useState<string | undefined>(undefined)
  const [cachedCompanyName, setCachedCompanyName] = useState<string | undefined>(undefined)
  const pathname = usePathname()

  // Load cached values from sessionStorage on mount (client-side only)
  useEffect(() => {
    const storedRole = sessionStorage.getItem('xpend-user-role')
    const storedCompanyName = sessionStorage.getItem('xpend-company-name')
    if (storedRole) setCachedRole(storedRole)
    if (storedCompanyName) setCachedCompanyName(storedCompanyName)
  }, [])

  // Update cached role in state and sessionStorage when userRole changes
  useEffect(() => {
    if (userRole) {
      setCachedRole(userRole)
      sessionStorage.setItem('xpend-user-role', userRole)
    }
  }, [userRole])

  // Update cached company name in state and sessionStorage when companyName changes
  useEffect(() => {
    if (companyName) {
      setCachedCompanyName(companyName)
      sessionStorage.setItem('xpend-company-name', companyName)
    }
  }, [companyName])

  // Use cached values to prevent flickering
  const effectiveRole = userRole || cachedRole
  const effectiveCompanyName = companyName || cachedCompanyName

  // Filter navigation based on user role
  const filteredNavigation = effectiveRole === 'super_admin'
    ? [
        ...navigation,
        { name: 'Super Admin', href: '/super-admin', icon: Shield }
      ]
    : navigation

  return (
    <div
      className={cn(
        'flex flex-col border-r transition-all duration-300 shadow-lg',
        // Desktop: normal sidebar behavior
        'md:relative md:translate-x-0',
        collapsed ? 'md:w-16' : 'md:w-64',
        // Mobile: drawer behavior
        'fixed inset-y-0 left-0 z-50 w-64',
        'transform transition-transform duration-300 ease-in-out',
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      )}
      style={{
        background: 'linear-gradient(to bottom, #2D3E3D, #263331)',
        borderRightColor: 'rgba(42, 212, 210, 0.2)'
      }}
      suppressHydrationWarning
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 border-b"
        style={{
          backgroundColor: 'rgba(45, 62, 61, 0.9)',
          borderBottomColor: 'rgba(42, 212, 210, 0.3)'
        }}
        suppressHydrationWarning
      >
        {!collapsed && (
          <div className="flex items-center space-x-3 min-w-0">
            <div
              className="p-2 rounded-lg shadow-sm flex-shrink-0"
              style={{ backgroundColor: '#2AD4D2' }}
            >
              <Building2 className="h-6 w-6" style={{ color: '#2D3E3D' }} />
            </div>
            <div className="min-w-0 flex-1 overflow-hidden" suppressHydrationWarning>
              <h1
                className={cn(
                  "text-sm font-bold text-white leading-tight line-clamp-2",
                  !effectiveCompanyName && "h-5 w-32 bg-white/10 rounded animate-pulse"
                )}
                title={effectiveCompanyName || ''}
                suppressHydrationWarning
              >
                {effectiveCompanyName || '\u00A0'}
              </h1>
            </div>
          </div>
        )}
        {/* Mobile: Close button, Desktop: Collapse button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (onCloseMobileMenu) {
              onCloseMobileMenu()
            } else {
              setCollapsed(!collapsed)
            }
          }}
          className={cn(
            "h-8 w-8 text-white",
            "md:hidden" // Only show close X on mobile
          )}
          style={{
            ['--hover-bg' as any]: 'rgba(42, 212, 210, 0.2)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(42, 212, 210, 0.2)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <X className="h-5 w-5" />
        </Button>

        {/* Desktop only: Collapse button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "h-8 w-8 text-white",
            "hidden md:flex" // Only show on desktop
          )}
          style={{
            ['--hover-bg' as any]: 'rgba(42, 212, 210, 0.2)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(42, 212, 210, 0.2)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1" suppressHydrationWarning>
        {filteredNavigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => {
                // Close mobile menu when navigating
                if (onCloseMobileMenu) {
                  onCloseMobileMenu()
                }
              }}
              className="flex items-center space-x-3 rounded-lg px-3 py-3 text-sm font-medium transition-all duration-200 shadow-sm"
              style={{
                backgroundColor: isActive ? '#2AD4D2' : 'transparent',
                color: isActive ? '#2D3E3D' : '#ffffff',
                transform: isActive ? 'scale(1.02)' : 'scale(1)'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'rgba(42, 212, 210, 0.2)'
                  e.currentTarget.style.color = '#3BE7AE'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = '#ffffff'
                }
              }}
            >
              <item.icon
                className="h-5 w-5 flex-shrink-0"
                style={{ color: isActive ? '#2D3E3D' : '#3BE7AE' }}
              />
              {!collapsed && <span className="font-semibold">{item.name}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div
          className="p-4 border-t"
          style={{
            backgroundColor: 'rgba(45, 62, 61, 0.8)',
            borderTopColor: 'rgba(42, 212, 210, 0.3)'
          }}
        >
          <div className="text-xs font-medium">
            <p style={{ color: '#3BE7AE' }}>© 2025 Xpend™</p>
            <p className="text-white opacity-70">v2.0.0</p>
          </div>
        </div>
      )}
    </div>
  )
}

