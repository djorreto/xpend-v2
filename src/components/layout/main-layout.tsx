'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
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
    <div className="flex h-screen bg-background">
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
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
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <Topbar
          user={user}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
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

