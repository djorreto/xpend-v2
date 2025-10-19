'use client'

import { Sidebar } from './sidebar'
import { Topbar } from './topbar'

interface MainLayoutProps {
  children: React.ReactNode
  user?: {
    name: string
    email: string
    avatar?: string
    role: string
  }
  companyName?: string
}

export function MainLayout({ 
  children, 
  user, 
  companyName = 'Xpend'
}: MainLayoutProps) {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar companyName={companyName} />
      
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <Topbar user={user} />
        
        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

