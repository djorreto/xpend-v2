'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { MessageSquare, Send, Trash2, User } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase'

interface Comment {
  id: string
  project_id: string
  comment_text: string
  parent_comment_id: string | null
  created_by: string
  created_at: string
  created_by_user?: {
    full_name?: string
    email: string
  }
}

interface RfxCommentsProps {
  projectId: string
}

export function RfxComments({ projectId }: RfxCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    loadComments()
    loadCurrentUser()
  }, [projectId])

  const loadCurrentUser = async () => {
    const supabase = supabaseBrowser()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setCurrentUserId(user.id)
    }
  }

  const loadComments = async () => {
    try {
      const supabase = supabaseBrowser()
      const { data, error } = await supabase
        .from('rfx_project_comments')
        .select(`
          *,
          created_by_user:profiles!created_by(full_name, email)
        `)
        .eq('project_id', projectId)
        .is('parent_comment_id', null) // Solo comentarios principales
        .order('created_at', { ascending: false })

      if (error) throw error

      setComments(data || [])
    } catch (error) {
      console.error('Error loading comments:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newComment.trim()) return

    setIsSending(true)
    try {
      const supabase = supabaseBrowser()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        alert('Debes estar autenticado para comentar')
        return
      }

      const { error } = await supabase
        .from('rfx_project_comments')
        .insert({
          project_id: projectId,
          comment_text: newComment,
          created_by: user.id,
        })

      if (error) throw error

      setNewComment('')
      loadComments() // Recargar comentarios
    } catch (error) {
      console.error('Error posting comment:', error)
      alert('Error al publicar el comentario')
    } finally {
      setIsSending(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    if (!confirm('¿Estás seguro de eliminar este comentario?')) return

    try {
      const supabase = supabaseBrowser()
      const { error } = await supabase
        .from('rfx_project_comments')
        .delete()
        .eq('id', commentId)

      if (error) throw error

      loadComments() // Recargar comentarios
    } catch (error) {
      console.error('Error deleting comment:', error)
      alert('Error al eliminar el comentario')
    }
  }

  return (
    <div className="space-y-4">
      {/* Formulario de nuevo comentario */}
      <Card className="p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-full">
              <MessageSquare className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Escribe un comentario sobre este proyecto..."
                rows={3}
                disabled={isSending}
                className="w-full"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={isSending || !newComment.trim()}
              size="sm"
            >
              {isSending ? (
                <>Enviando...</>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Publicar Comentario
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>

      {/* Lista de comentarios */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">
          Cargando comentarios...
        </div>
      ) : comments.length === 0 ? (
        <Card className="p-12 text-center text-gray-500">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-400" />
          <p>No hay comentarios todavía.</p>
          <p className="text-sm mt-1">Sé el primero en comentar sobre este proyecto.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <Card key={comment.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gray-100 rounded-full">
                  <User className="h-5 w-5 text-gray-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-semibold text-gray-900">
                        {comment.created_by_user?.full_name || comment.created_by_user?.email || 'Usuario'}
                      </span>
                      <span className="text-sm text-gray-500 ml-3">
                        {new Date(comment.created_at).toLocaleString('es-ES')}
                      </span>
                    </div>
                    {currentUserId === comment.created_by && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(comment.id)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap">{comment.comment_text}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

