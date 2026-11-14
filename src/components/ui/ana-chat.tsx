'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, MessageCircle, Send, Sparkles, User, X } from 'lucide-react'
import { contextFromPath, type AnaEvidence, type AnaProposal } from '@/lib/ana'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  evidence?: AnaEvidence[]
  proposal?: AnaProposal | null
  interactionId?: string | null
  contextLabel?: string
  modelCalled?: boolean
}

export function AnaChat() {
  const pathname = usePathname() || '/'
  const context = contextFromPath(pathname)
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: 'Leo el registro abierto y los datos autorizados de tu empresa. No llamo a un modelo y no guardo nada hasta que lo confirmes.',
      timestamp: new Date(),
      contextLabel: context.label,
    },
  ])
  const [input, setInput] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault()
    const question = input.trim()
    if (!question || isLoading) return
    setMessages(prev => [...prev, { id: `${Date.now()}`, role: 'user', content: question, timestamp: new Date() }])
    setInput('')
    setIsLoading(true)
    try {
      const response = await fetch('/api/ana', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, path: pathname, module: context.module, recordId: context.recordId }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No pude consultar')
      const interactionId = payload.interactionId as string | null
      setMessages(prev => [...prev, {
        id: `${Date.now()}-ana`,
        role: 'assistant',
        content: payload.text,
        timestamp: new Date(),
        evidence: payload.evidence || [],
        proposal: payload.proposal,
        interactionId,
        contextLabel: payload.contextLabel,
        modelCalled: Boolean(payload.modelCalled),
      }])
      if (interactionId && payload.proposal?.body) {
        setDrafts(prev => ({ ...prev, [interactionId]: payload.proposal.body }))
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        id: `${Date.now()}-error`,
        role: 'assistant',
        content: error instanceof Error ? error.message : 'No pude consultar el registro.',
        timestamp: new Date(),
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const confirm = async (message: Message) => {
    if (!message.interactionId || !message.proposal) return
    setIsLoading(true)
    try {
      const response = await fetch('/api/ana/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interactionId: message.interactionId,
          body: drafts[message.interactionId] || message.proposal.body,
        }),
      })
      const payload = await response.json()
      setMessages(prev => [...prev, {
        id: `${Date.now()}-saved`,
        role: 'assistant',
        content: response.ok ? payload.detail : (payload.error || 'No se guardó'),
        timestamp: new Date(),
      }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 z-50 group md:bottom-6 md:right-6"
          aria-label="Abrir chat de ANA"
        >
          <div
            className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/25 shadow-[0_12px_30px_-12px_rgba(45,62,61,0.7)] transition-transform duration-200 group-hover:-translate-y-0.5 md:h-[52px] md:w-[52px]"
            style={{ background: 'linear-gradient(160deg, #314846 0%, #243230 100%)' }}
          >
            <MessageCircle className="h-5 w-5 text-[#3BE7AE]" />
          </div>
        </button>
      )}

      {isOpen && (
        <Card className="fixed bottom-0 left-0 right-0 z-50 flex h-[calc(100vh-60px)] w-full flex-col rounded-t-xl shadow-2xl md:bottom-6 md:left-auto md:right-6 md:h-[600px] md:max-h-[calc(100vh-100px)] md:w-[400px] md:rounded-xl">
          <CardHeader
            className="flex flex-row items-center justify-between space-y-0 border-b pb-4"
            style={{ background: 'linear-gradient(135deg, #2D3E3D 0%, #1a2625 100%)' }}
          >
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: '#3BE7AE' }}>
                <Sparkles className="h-5 w-5" style={{ color: '#2D3E3D' }} />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-white">ANA</CardTitle>
                <p className="text-xs text-gray-300">{context.label}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="text-white hover:bg-white/10">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          <CardContent className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map(message => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex max-w-[85%] items-start space-x-2 ${message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${message.role === 'user' ? 'bg-blue-500' : 'bg-gradient-to-br from-teal-400 to-green-400'}`}>
                    {message.role === 'user' ? <User className="h-4 w-4 text-white" /> : <Sparkles className="h-4 w-4 text-white" />}
                  </div>
                  <div className={`rounded-lg p-3 ${message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-900'}`}>
                    {message.contextLabel && <p className="mb-1 text-xs opacity-70">{message.contextLabel}{message.modelCalled ? ' · Groq' : ''}</p>}
                    <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                    {message.evidence && message.evidence.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs">
                        {message.evidence.map((item, index) => (
                          <li key={`${item.source}-${index}`}>{item.source}: {item.quote || item.value || item.label}</li>
                        ))}
                      </ul>
                    )}
                    {message.proposal && message.interactionId && (
                      <div className="mt-2 space-y-2">
                        <Textarea
                          value={drafts[message.interactionId] || ''}
                          onChange={event => setDrafts(prev => ({ ...prev, [message.interactionId || '']: event.target.value }))}
                        />
                        <Button type="button" size="sm" onClick={() => confirm(message)}>Guardar con mi confirmación</Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-center space-x-2 rounded-lg bg-gray-100 p-3">
                  <Loader2 className="h-4 w-4 animate-spin text-teal-500" />
                  <span className="text-sm text-gray-600">ANA está leyendo el registro...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </CardContent>

          <div className="border-t p-4">
            <form onSubmit={handleSendMessage} className="flex space-x-2">
              <Input
                value={input}
                onChange={event => setInput(event.target.value)}
                placeholder="Pregunta por este registro..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={isLoading || !input.trim()} style={{ backgroundColor: '#3BE7AE', color: '#2D3E3D' }}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </Card>
      )}
    </>
  )
}
