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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Building2,
  Gavel,
  Scale,
  TrendingUp,
  Truck,
  Target,
  Shield,
  Brain,
  FileEdit,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VersionSelector } from '@/components/ui/version-selector'
import { Receipt } from 'lucide-react'
import { featureInvoicesModule } from '@/lib/mvp-config'

const navigationBase = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Comité', href: '/comite', icon: BarChart3 },
  { name: 'Sourcing Intelligence', href: '/sourcing-intelligence', icon: Brain },
  { name: 'Sourcing Plan', href: '/sourcing-plan', icon: Target },
  { name: 'RFx Maker', href: '/rfx-maker', icon: FileEdit },
  { name: 'Licitaciones', href: '/licitaciones', icon: Gavel },
  { name: 'Sala de Ofertas', href: '/sala', icon: Scale },
  { name: 'Proveedores', href: '/suppliers', icon: Truck },
  { name: 'Contratos', href: '/contratos', icon: FileText },
  { name: 'Spend Analysis', href: '/spend', icon: TrendingUp },
  { name: 'Reportes', href: '/reports', icon: BarChart3 },
  { name: 'Usuarios', href: '/users', icon: Users },
  { name: 'Configuración', href: '/settings', icon: Settings },
]

const invoicesNavItem = { name: 'Facturas', href: '/invoices', icon: Receipt }

const NAV_GROUPS = [
  { label: 'Hoy', hrefs: ['/dashboard', '/comite'] },
  { label: 'Estrategia', hrefs: ['/sourcing-intelligence', '/spend', '/sourcing-plan', '/rfx-maker'] },
  { label: 'Compra', hrefs: ['/licitaciones', '/sala', '/suppliers', '/contratos', '/invoices'] },
  { label: 'Lectura', hrefs: ['/reports'] },
  { label: 'Cuenta', hrefs: ['/users', '/settings', '/super-admin'] },
]

const navigation = featureInvoicesModule
  ? [
      ...navigationBase.slice(0, 8),
      invoicesNavItem,
      ...navigationBase.slice(8),
    ]
  : navigationBase

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
  const supplierNavigation = [
    { name: 'Sala de Ofertas', href: '/sala', icon: Scale },
  ]

  const [isMobile, setIsMobile] = useState(false)
  const [closedGroups, setClosedGroups] = useState<string[]>([])

  const groups = effectiveRole === 'supplier'
    ? [{ label: '', hrefs: ['/sala'] }]
    : NAV_GROUPS

  useEffect(() => {
    let closed: string[] = []
    const stored = sessionStorage.getItem('xpend-nav-closed')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) closed = parsed.filter(item => typeof item === 'string')
      } catch {
        sessionStorage.removeItem('xpend-nav-closed')
      }
    }
    const active = NAV_GROUPS.find(group =>
      group.hrefs.some(href => pathname === href || pathname.startsWith(`${href}/`))
    )
    if (active) closed = closed.filter(label => label !== active.label)
    setClosedGroups(closed)
  }, [pathname])

  const toggleGroup = (label: string) => {
    setClosedGroups(current => {
      const next = current.includes(label) ? current.filter(item => item !== label) : [...current, label]
      sessionStorage.setItem('xpend-nav-closed', JSON.stringify(next))
      return next
    })
  }

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const apply = () => setIsMobile(media.matches)
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])

  const filteredNavigation = effectiveRole === 'supplier'
    ? supplierNavigation
    : effectiveRole === 'super_admin'
    ? [
        ...navigation,
        { name: 'Super Admin', href: '/super-admin', icon: Shield }
      ]
    : navigation

  return (
    <div
      className={cn(
        'z-50 flex w-[min(248px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[22px] border border-white/10 shadow-[0_24px_50px_-28px_rgba(0,0,0,0.65)]',
        'fixed bottom-3 left-3 top-[max(0.75rem,env(safe-area-inset-top))] h-auto md:static md:inset-auto md:my-3 md:ml-3 md:h-[calc(100%-1.5rem)]',
        collapsed ? 'md:w-[72px]' : 'md:w-[248px]'
      )}
      style={{
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.08), transparent 22%), linear-gradient(180deg, #314846 0%, #1f2c2b 100%)',
        transform: !isMobile || mobileMenuOpen ? 'translateX(0)' : 'translateX(calc(-100% - 1rem))',
        transition: 'transform 280ms cubic-bezier(0.2, 0.8, 0.2, 1)',
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
          <div className="flex-1 mr-2">
            <VersionSelector tone="sidebar" fullWidth />
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
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4" suppressHydrationWarning>
        {groups.map(group => {
          const items = group.hrefs
            .map(href => filteredNavigation.find(item => item.href === href))
            .filter((item): item is (typeof filteredNavigation)[number] => !!item)
          if (!items.length) return null
          const closed = Boolean(group.label) && closedGroups.includes(group.label)
          return (
            <div key={group.label || 'sala'} className="space-y-1">
              {!collapsed && group.label && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className="flex w-full items-center justify-between px-3 pb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-white/35 hover:text-white/70"
                  aria-expanded={!closed}
                >
                  {group.label}
                  <ChevronDown className={cn('h-3 w-3 transition-transform', closed && '-rotate-90')} />
                </button>
              )}
              {(!closed || collapsed) && items.map(item => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => onCloseMobileMenu?.()}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] tracking-tight transition-colors duration-200',
                      isActive
                        ? 'bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(59,231,174,0.45)]'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    )}
                  >
                    <item.icon className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-[#3BE7AE]' : 'text-white/45')} />
                    {!collapsed && <span>{item.name}</span>}
                  </Link>
                )
              })}
            </div>
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
            <p style={{ color: '#3BE7AE' }}>© 2026 Xpend™</p>
            <p className="text-white/50">v3</p>
          </div>
        </div>
      )}
    </div>
  )
}

