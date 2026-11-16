'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { PageTrail } from './page-trail'
import { ChangePasswordModal } from '@/components/forms/change-password-modal'
import { AnaChat } from '@/components/ui/ana-chat'
import { supabaseBrowser } from '@/lib/supabase'

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
  companyName
}: MainLayoutProps) {
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [checkingPassword, setCheckingPassword] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    checkPasswordChange()
  }, [])

  const checkPasswordChange = async () => {
    try {
      const supabase = supabaseBrowser()
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('must_change_password')
          .eq('id', session.user.id)
          .single()

        if (profile?.must_change_password) {
          setMustChangePassword(true)
        }
      }
    } catch (error) {
      console.error('Error checking password change requirement:', error)
    } finally {
      setCheckingPassword(false)
    }
  }

  return (
    <div className="app-canvas relative flex h-[100dvh] min-h-[100dvh]">
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-petrol-blue/40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        companyName={companyName}
        userRole={user?.role}
        mobileMenuOpen={mobileMenuOpen}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
      />

      {/* Main content */}
      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] md:py-3 md:pl-0 md:pr-3">
        <Topbar
          user={user}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main className="app-main min-h-0 flex-1 overflow-auto px-1 pb-24 pt-4 md:px-6 md:pb-8 md:pt-5">
          <PageTrail role={user?.role} />
          {children}
        </main>
      </div>

      {/* Forced Password Change Modal */}
      {!checkingPassword && mustChangePassword && (
        <ChangePasswordModal
          isOpen={true}
          onClose={() => setMustChangePassword(false)}
          isFirstLogin={true}
        />
      )}

      {/* ANA - AI Assistant (always visible) */}
      <AnaChat />
    </div>
  )
}

