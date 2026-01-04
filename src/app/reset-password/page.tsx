'use client'

import { useEffect, useState } from 'react'
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

  useEffect(() => {
    // If the user arrives with a recovery session, switch to update mode
    const type = searchParams.get('type')
    const access_token = searchParams.get('access_token')
    if (type === 'recovery' && access_token) {
      setMode('update')
    }
  }, [searchParams])

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) throw error
      addToast({
        type: 'success',
        title: 'Correo enviado',
        message: 'Revisa tu correo para continuar con el cambio de contraseña'
      })
      router.push('/login')
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

