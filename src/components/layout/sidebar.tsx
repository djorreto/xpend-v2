'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Home,
  Workflow,
  BarChart3,
  FileText,
  Truck,
  Settings,
  Scale,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VersionSelector } from '@/components/ui/version-selector'
import { featureInvoicesModule } from '@/lib/mvp-config'
import { activeNav, navigationFor, type NavSection } from '@/lib/navigation'

const SECTION_ICONS: Record<NavSection['id'], LucideIcon> = {
  inicio: Home,
  abastecimiento: Workflow,
  gasto: BarChart3,
  contratos: FileText,
  proveedores: Truck,
  administracion: Settings,
}

interface SidebarProps {
  companyName?: string
  userRole?: string
  mobileMenuOpen?: boolean
  onCloseMobileMenu?: () => void
}

export function Sidebar({ companyName, userRole, mobileMenuOpen = false, onCloseMobileMenu }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [cachedRole, setCachedRole] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const [openSections, setOpenSections] = useState<string[]>([])
  const pathname = usePathname() || '/'

  useEffect(() => {
    const storedRole = sessionStorage.getItem('xpend-user-role')
    if (storedRole) setCachedRole(storedRole)
  }, [])

  useEffect(() => {
    if (userRole) {
      setCachedRole(userRole)
      sessionStorage.setItem('xpend-user-role', userRole)
    }
  }, [userRole])

  useEffect(() => {
    if (companyName) sessionStorage.setItem('xpend-company-name', companyName)
  }, [companyName])

  useEffect(() => {
    setSearch(window.location.search)
  }, [pathname])

  const effectiveRole = userRole || cachedRole
  const sections = navigationFor(effectiveRole, { invoices: featureInvoicesModule })
  const active = activeNav(pathname, sections, search)

  useEffect(() => {
    if (active?.section.id) setOpenSections([active.section.id])
  }, [active?.section.id])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const apply = () => setIsMobile(media.matches)
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])

  const toggleSection = (id: string) => {
    setOpenSections(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }

  const linkClass = (isActive: boolean) => cn(
    'flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] tracking-tight transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-mint/70',
    isActive
      ? 'bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(59,231,174,0.45)]'
      : 'text-white/70 hover:bg-white/10 hover:text-white'
  )

  return (
    <div
      className={cn(
        'z-50 flex w-[min(260px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[22px] border border-white/10 shadow-[0_24px_50px_-28px_rgba(0,0,0,0.65)]',
        'fixed bottom-3 left-3 top-[max(0.75rem,env(safe-area-inset-top))] h-auto md:static md:inset-auto md:my-3 md:ml-3 md:h-[calc(100%-1.5rem)]',
        collapsed ? 'md:w-[72px]' : 'md:w-[260px]'
      )}
      style={{
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.08), transparent 22%), linear-gradient(180deg, #314846 0%, #1f2c2b 100%)',
        transform: !isMobile || mobileMenuOpen ? 'translateX(0)' : 'translateX(calc(-100% - 1rem))',
        visibility: isMobile && !mobileMenuOpen ? 'hidden' : 'visible',
        transition: 'transform 280ms cubic-bezier(0.2, 0.8, 0.2, 1), visibility 280ms',
      }}
      suppressHydrationWarning
    >
      <div
        className="flex items-center justify-between border-b p-4"
        style={{ backgroundColor: 'rgba(45, 62, 61, 0.9)', borderBottomColor: 'rgba(42, 212, 210, 0.3)' }}
        suppressHydrationWarning
      >
        {!collapsed && (
          <div className="mr-2 flex-1">
            <VersionSelector tone="sidebar" fullWidth />
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onCloseMobileMenu ? onCloseMobileMenu() : setCollapsed(!collapsed)}
          className="h-8 w-8 text-white hover:bg-white/10 md:hidden"
          aria-label="Cerrar menú"
        >
          <X className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="hidden h-8 w-8 text-white hover:bg-white/10 md:flex"
          aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav aria-label="Navegación principal" className="flex-1 space-y-1 overflow-y-auto px-3 py-4" suppressHydrationWarning>
        {sections.map(section => {
          const Icon = effectiveRole === 'supplier' ? Scale : SECTION_ICONS[section.id]
          const sectionActive = active?.section.id === section.id
          const single = section.items.length === 1

          if (single || collapsed) {
            const target = section.items[0]
            const isActive = sectionActive
            return (
              <Link
                key={section.id}
                href={target.href}
                onClick={() => onCloseMobileMenu?.()}
                className={linkClass(isActive)}
                aria-current={isActive ? 'page' : undefined}
                title={collapsed ? section.label : undefined}
              >
                <Icon className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-[#3BE7AE]' : 'text-white/45')} />
                {!collapsed && <span>{section.label}</span>}
              </Link>
            )
          }

          const open = openSections.includes(section.id)
          return (
            <div key={section.id}>
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className={cn(linkClass(false), 'w-full justify-between', sectionActive && 'text-white')}
                aria-expanded={open}
                aria-controls={`nav-${section.id}`}
              >
                <span className="flex items-center gap-3">
                  <Icon className={cn('h-4 w-4 flex-shrink-0', sectionActive ? 'text-[#3BE7AE]' : 'text-white/45')} />
                  <span>{section.label}</span>
                </span>
                <ChevronDown className={cn('h-3.5 w-3.5 text-white/40 transition-transform', !open && '-rotate-90')} />
              </button>
              {open && (
                <ul id={`nav-${section.id}`} className="mb-2 ml-[22px] mt-1 space-y-0.5 border-l border-white/10 pl-3">
                  {section.items.map(item => {
                    const isActive = active?.item.id === item.id
                    return (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          onClick={() => onCloseMobileMenu?.()}
                          className={cn(linkClass(isActive), 'py-1.5 text-[12.5px]')}
                          aria-current={isActive ? 'page' : undefined}
                        >
                          {item.label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </nav>

      {!collapsed && (
        <div className="border-t p-4" style={{ backgroundColor: 'rgba(45, 62, 61, 0.8)', borderTopColor: 'rgba(42, 212, 210, 0.3)' }}>
          <div className="text-xs font-medium">
            <p style={{ color: '#3BE7AE' }}>© 2026 Xpend™</p>
            <p className="text-white/50">ANA está disponible en todas las pantallas</p>
          </div>
        </div>
      )}
    </div>
  )
}
