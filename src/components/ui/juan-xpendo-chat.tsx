'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { MessageCircle, X, Send, FileText, Loader2, Sparkles, User } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export function JuanXpendoChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content:
        '¡Hola! Soy Juan Xpendo, tu asistente experto en Strategic Sourcing. 🎯\n\nPuedo ayudarte con:\n- Estrategia de categorías\n- Análisis de líneas base\n- Especificaciones técnicas\n- Evaluación de proveedores\n- Y mucho más...\n\n¿En qué puedo ayudarte hoy?',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addToast } = useToast()

  // Scroll automático al último mensaje
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Obtener userId
  useEffect(() => {
    const getUserId = async () => {
      const supabase = supabaseBrowser()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session?.user) {
        setUserId(session.user.id)
      }
    }
    getUserId()
  }, [])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Construir historial de conversación
      const conversationHistory = messages
        .slice(-5) // Últimos 5 mensajes para contexto
        .map((m) => `${m.role === 'user' ? 'Usuario' : 'Juan Xpendo'}: ${m.content}`)
        .join('\n')

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          conversationHistory,
          userId,
        }),
      })

      if (!response.ok) {
        throw new Error('Error al obtener respuesta')
      }

      // Leer el stream (texto plano)
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ''

      const assistantMessageId = Date.now().toString()
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        },
      ])

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        assistantMessage += chunk

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId ? { ...m, content: assistantMessage } : m
          )
        )
      }
    } catch (error) {
      console.error('Error sending message:', error)
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No pude procesar tu mensaje. Intenta de nuevo.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tamaño (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      addToast({
        type: 'error',
        title: 'Archivo muy grande',
        message: 'El archivo no puede superar los 5MB',
      })
      return
    }

    setIsAnalyzing(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('documentType', 'Especificación Técnica')

    try {
      const response = await fetch('/api/analyze-document', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al analizar el documento')
      }

      // Agregar mensaje del usuario
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: `📄 He subido el documento: **${file.name}** (${(file.size / 1024).toFixed(1)} KB)\n\n¿Puedes revisarlo y decirme si está completo?`,
        timestamp: new Date(),
      }

      // Agregar respuesta de Juan
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `📊 **Análisis del documento: ${data.fileName}**\n\n${data.analysis}`,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, userMessage, assistantMessage])

      addToast({
        type: 'success',
        title: 'Documento analizado',
        message: `He revisado tu documento (${data.wordCount} palabras)`,
      })
    } catch (error) {
      console.error('Error analyzing document:', error)
      addToast({
        type: 'error',
        title: 'Error al analizar',
        message: error instanceof Error ? error.message : 'No pude analizar el documento',
      })
    } finally {
      setIsAnalyzing(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <>
      {/* Botón flotante */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 group"
          aria-label="Abrir chat de Juan Xpendo"
        >
          <div
            className="relative w-16 h-16 rounded-full shadow-2xl transition-all duration-300 group-hover:scale-110"
            style={{
              background: 'linear-gradient(135deg, #2AD4D2 0%, #3BE7AE 100%)',
            }}
          >
            <MessageCircle className="w-8 h-8 text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
            <Sparkles className="w-4 h-4 text-yellow-300 absolute top-1 right-1 animate-pulse" />
          </div>
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold animate-pulse">
            AI
          </div>
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <Card
          className="fixed bottom-6 right-6 z-50 shadow-2xl flex flex-col"
          style={{
            width: '400px',
            height: '600px',
            maxHeight: 'calc(100vh - 100px)',
          }}
        >
          {/* Header */}
          <CardHeader
            className="flex flex-row items-center justify-between space-y-0 pb-4 border-b"
            style={{
              background: 'linear-gradient(135deg, #2D3E3D 0%, #1a2625 100%)',
            }}
          >
            <div className="flex items-center space-x-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#3BE7AE' }}
              >
                <Sparkles className="w-5 h-5" style={{ color: '#2D3E3D' }} />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-white">Juan Xpendo</CardTitle>
                <p className="text-xs text-gray-300">Experto en Strategic Sourcing</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          {/* Messages */}
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`flex items-start space-x-2 max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}
                >
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      message.role === 'user'
                        ? 'bg-blue-500'
                        : 'bg-gradient-to-br from-teal-400 to-green-400'
                    }`}
                  >
                    {message.role === 'user' ? (
                      <User className="w-4 h-4 text-white" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div
                    className={`rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                    <p className="text-xs mt-1 opacity-70">
                      {message.timestamp.toLocaleTimeString('es-CL', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg p-3 flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin text-teal-500" />
                  <span className="text-sm text-gray-600">Juan está escribiendo...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </CardContent>

          {/* Input */}
          <div className="border-t p-4 space-y-2">
            <form onSubmit={handleSendMessage} className="flex space-x-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pregúntame sobre sourcing..."
                disabled={isLoading || isAnalyzing}
                className="flex-1"
              />
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || isAnalyzing || !input.trim()}
                style={{ backgroundColor: '#3BE7AE', color: '#2D3E3D' }}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <div className="flex items-center justify-between">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.docx"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isLoading || isAnalyzing}
                  className="cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  asChild
                >
                  <span>
                    {isAnalyzing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4 mr-2" />
                    )}
                    Subir Doc (.docx, .txt)
                  </span>
                </Button>
              </label>
              <p className="text-xs text-gray-500">Máx 5MB</p>
            </div>
          </div>
        </Card>
      )}
    </>
  )
}

