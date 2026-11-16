'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PROCESS_TABS, activeNav, breadcrumbsFor } from '@/lib/navigation'

export function PageTrail({ role }: { role?: string }) {
  const pathname = usePathname() || '/'
  const [search, setSearch] = useState('')
  const [cachedRole, setCachedRole] = useState<string | null>(null)

  useEffect(() => {
    setSearch(window.location.search)
    setCachedRole(sessionStorage.getItem('xpend-user-role'))
  }, [pathname])

  const effectiveRole = role || cachedRole
  if (!effectiveRole || effectiveRole === 'supplier') return null
  const crumbs = breadcrumbsFor(pathname, undefined, search)
  if (!crumbs.length) return null
  const active = activeNav(pathname, undefined, search)
  const processTab = active?.item.id === 'procesos'
    ? PROCESS_TABS.find(tab => tab.id !== 'todos' && (pathname === tab.prefix || pathname.startsWith(`${tab.prefix}/`)))?.id || 'todos'
    : null

  return (
    <div className="mb-4 space-y-3">
      <nav aria-label="Ruta" className="text-[12px] text-petrol-blue/75">
        <ol className="flex flex-wrap items-center gap-1">
          {crumbs.map((crumb, index) => (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
              {index > 0 && <ChevronRight className="h-3 w-3 text-petrol-blue/30" aria-hidden />}
              {crumb.href ? (
                <Link href={crumb.href} className="rounded hover:text-petrol-blue hover:underline">{crumb.label}</Link>
              ) : (
                <span aria-current="page" className="font-medium text-petrol-blue/80">{crumb.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      {processTab && (
        <div role="tablist" aria-label="Tipo de proceso" className="flex gap-1 overflow-x-auto pb-1">
          {PROCESS_TABS.map(tab => (
            <Link
              key={tab.id}
              href={tab.href}
              role="tab"
              aria-selected={processTab === tab.id}
              className={cn(
                'whitespace-nowrap rounded-full border px-3 py-1 text-[12px] transition-colors',
                processTab === tab.id
                  ? 'border-petrol-blue bg-petrol-blue text-white'
                  : 'border-petrol-blue/15 bg-white/60 text-petrol-blue/70 hover:bg-white'
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
