'use client'

import { useState } from 'react'
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
  Truck
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
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
}

export function Sidebar({ companyName = 'Xpend' }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <div
      className={cn(
        'flex flex-col border-r transition-all duration-300 shadow-lg',
        collapsed ? 'w-16' : 'w-64'
      )}
      style={{
        background: 'linear-gradient(to bottom, #2D3E3D, #263331)',
        borderRightColor: 'rgba(42, 212, 210, 0.2)'
      }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 border-b"
        style={{
          backgroundColor: 'rgba(45, 62, 61, 0.9)',
          borderBottomColor: 'rgba(42, 212, 210, 0.3)'
        }}
      >
        {!collapsed && (
          <div className="flex items-center space-x-3">
            <div 
              className="p-2 rounded-lg shadow-sm"
              style={{ backgroundColor: '#2AD4D2' }}
            >
              <Building2 className="h-6 w-6" style={{ color: '#2D3E3D' }} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">{companyName}</h1>
              <p className="text-xs font-medium" style={{ color: '#3BE7AE' }}>Strategic Sourcing</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8 text-white"
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
      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
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
            <p style={{ color: '#3BE7AE' }}>© 2025 xpend.cl</p>
            <p className="text-white opacity-70">v1.0.0</p>
          </div>
        </div>
      )}
    </div>
  )
}

