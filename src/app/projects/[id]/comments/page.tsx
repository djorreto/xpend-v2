'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft,
  Send,
  MessageSquare,
  User,
  Loader2
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { supabaseBrowser } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/loading'
import { ErrorMessage } from '@/components/ui/error'
import { useToast } from '@/components/ui/toast'

interface ProjectComment {
  id: string
  content: string
  user_id: string
  created_at: string
  profiles: {
    full_name: string
    email: string
  }
}

export default function ProjectCommentsPage() {
  const supabase = supabaseBrowser()
  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [project, setProject] = useState<any>(null)
  const [comments, setComments] = useState<ProjectComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const params = useParams()
  const { addToast } = useToast()

  const projectId = params.id as string

  useEffect(() => {
    if (projectId) {
      loadData()
    }
  }, [projectId])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get current user
      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser()
      if (userError || !authUser) {
        throw new Error('Usuario no autenticado')
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (profileError || !profile) {
        throw new Error('Perfil no encontrado')
      }

      setUser({
        name: profile.full_name || authUser.email,
        email: authUser.email,
        role: profile.role
      })

      // Get company info
      if (profile.company_id) {
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', profile.company_id)
          .single()

        if (!companyError && companyData) {
          setCompany(companyData)
        }
      }

      // Load project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      if (projectError || !projectData) {
        throw new Error('Proyecto no encontrado')
      }

      setProject(projectData)

      // Load comments
      await loadComments()

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudieron cargar los datos'
      })
    } finally {
      setLoading(false)
    }
  }

  const loadComments = async () => {
    try {
      const { data: commentsData, error: commentsError } = await supabase
        .from('project_comments')
        .select(`
          *,
          profiles!inner(full_name, email)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (commentsError) throw commentsError
      setComments(commentsData || [])
    } catch (err) {
      throw err
    }
  }

  const handleSendComment = async () => {
    if (!newComment.trim()) return

    setSending(true)

    try {
      // Get current user
      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser()
      if (userError || !authUser) {
        throw new Error('Usuario no autenticado')
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (profileError || !profile) {
        throw new Error('Perfil no encontrado')
      }

      // Create comment
      const { data: commentData, error: commentError } = await supabase
        .from('project_comments')
        .insert({
          project_id: projectId,
          user_id: profile.id,
          content: newComment.trim()
        })
        .select(`
          *,
          profiles!inner(full_name, email)
        `)
        .single()

      if (commentError) throw commentError

      setComments(prev => [commentData, ...prev])
      setNewComment('')
      addToast({
        type: 'success',
        title: 'Comentario enviado',
        message: 'Tu comentario ha sido publicado'
      })

    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo enviar el comentario'
      })
    } finally {
      setSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendComment()
    }
  }

  if (loading) {
    return (
      <MainLayout user={user} companyName={company?.name}>
        <LoadingSpinner />
      </MainLayout>
    )
  }

  if (error || !project) {
    return (
      <MainLayout user={user} companyName={company?.name}>
        <ErrorMessage
          title="Error al cargar comentarios"
          message={error || 'Proyecto no encontrado'}
          onRetry={loadData}
        />
      </MainLayout>
    )
  }

  return (
    <MainLayout user={user} companyName={company?.name}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Comentarios del Proyecto</h1>
            <p className="text-muted-foreground">
              {project.name}
            </p>
          </div>
        </div>

        {/* New Comment */}
        <Card>
          <CardHeader>
            <CardTitle>Nuevo Comentario</CardTitle>
            <CardDescription>
              Comparte tus ideas y actualizaciones sobre el proyecto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <textarea
                placeholder="Escribe tu comentario aquí..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={sending}
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleSendComment}
                  disabled={!newComment.trim() || sending}
                >
                  {sending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Enviar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comments List */}
        <Card>
          <CardHeader>
            <CardTitle>Comentarios ({comments.length})</CardTitle>
            <CardDescription>
              Conversación del equipo sobre este proyecto
            </CardDescription>
          </CardHeader>
          <CardContent>
            {comments.length > 0 ? (
              <div className="space-y-6">
                {comments.map((comment) => (
                  <div key={comment.id} className="border-l-4 border-primary pl-4 py-2">
                    <div className="flex items-center space-x-2 mb-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{comment.profiles.full_name}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(comment.created_at)}
                      </span>
                    </div>
                    <p className="text-muted-foreground whitespace-pre-wrap">{comment.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No hay comentarios</h3>
                <p className="text-muted-foreground">
                  Sé el primero en comentar sobre este proyecto
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
