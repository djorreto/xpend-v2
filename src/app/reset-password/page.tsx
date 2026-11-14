'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'

export default function ResetPasswordPage() {
  const supabase = supabaseBrowser()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { addToast } = useToast()

  const [mode, setMode] = useState<'request' | 'update'>('request')
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const recoveryHandledRef = useRef(false)

  useEffect(() => {
    // Supabase suele devolver tokens en el hash (#access_token=...) — useSearchParams no lee el hash.
    const applySessionAndEnterUpdate = async (
      access_token: string,
      refresh_token: string
    ) => {
      const { error } = await supabase.auth.setSession({ access_token, refresh_token })
      if (error) return false
      setMode('update')
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, document.title, window.location.pathname + window.location.search)
      }
      return true
    }

    const run = async () => {
      if (recoveryHandledRef.current) return

      if (typeof window !== 'undefined' && window.location.hash.length > 1) {
        const hashParams = new URLSearchParams(window.location.hash.slice(1))
        const access_token = hashParams.get('access_token')
        const refresh_token = hashParams.get('refresh_token')
        const type = hashParams.get('type')
        if (type === 'recovery' && access_token && refresh_token) {
          const ok = await applySessionAndEnterUpdate(access_token, refresh_token)
          if (ok) recoveryHandledRef.current = true
          return
        }
      }

      const type = searchParams.get('type')
      const access_token = searchParams.get('access_token')
      const refresh_token = searchParams.get('refresh_token')
      if (type === 'recovery' && access_token && refresh_token) {
        const ok = await applySessionAndEnterUpdate(access_token, refresh_token)
        if (ok) recoveryHandledRef.current = true
        return
      }

      const tokenHash = searchParams.get('token_hash')
      const typeFromQuery = searchParams.get('type')
      if (tokenHash && typeFromQuery === 'recovery') {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'recovery',
        })
        if (!error) {
          recoveryHandledRef.current = true
          setMode('update')
          router.replace('/reset-password')
        } else {
          addToast({
            type: 'error',
            title: 'Enlace vencido',
            message: 'Pide uno nuevo desde recuperar contraseña.',
          })
        }
        return
      }

      const code = searchParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          recoveryHandledRef.current = true
          setMode('update')
          router.replace('/reset-password')
        }
      }
    }

    void run()
  }, [router, searchParams, supabase])

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const custom = await fetch('/api/auth/send-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, kind: 'recovery' }),
      })
      const customBody = await custom.json().catch(() => ({}))
      if (!custom.ok) {
        throw new Error(customBody.error || 'No se pudo enviar el correo')
      }
      addToast({
        type: 'success',
        title: 'Revisa tu correo',
        message: 'Si la cuenta existe, enviamos un enlace para crear una contraseña nueva.'
      })
      return
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'No se pudo enviar el correo'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      addToast({
        type: 'success',
        title: 'Contraseña actualizada',
        message: 'Ya puedes iniciar sesión con tu nueva contraseña'
      })
      router.push('/login')
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'No se pudo actualizar la contraseña'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>
              {mode === 'request' ? 'Recuperar contraseña' : 'Ingresa la nueva contraseña'}
            </CardTitle>
            <CardDescription>
              {mode === 'request'
                ? 'Te enviaremos un enlace para restablecer tu contraseña.'
                : 'Define tu nueva contraseña para continuar.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mode === 'request' ? (
              <form onSubmit={handleSendLink} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Correo</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    required
                    autoComplete="username"
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Enviando...' : 'Enviar enlace'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nueva contraseña</label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Actualizando...' : 'Actualizar contraseña'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


