'use client'

import { useState, useEffect } from 'react'
import { Bell, Check, X, AlertCircle, Info, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { supabaseBrowser } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Notification {
  id: string
  type: 'info' | 'warning' | 'success' | 'error'
  title: string
  message: string
  timestamp: string
  read: boolean
  actionUrl?: string
}

interface DbNotification {
  id: string
  type: 'info' | 'warning' | 'success' | 'error'
  title: string
  message: string
  action_url: string | null
  read: boolean
  created_at: string
}

const notificationIcons = {
  info: Info,
  warning: AlertCircle,
  success: CheckCircle,
  error: AlertCircle
}

const notificationColors = {
  info: 'text-blue-600 bg-blue-100',
  warning: 'text-yellow-600 bg-yellow-100',
  success: 'text-green-600 bg-green-100',
  error: 'text-red-600 bg-red-100'
}

interface NotificationsDropdownProps {
  className?: string
}

export function NotificationsDropdown({ className }: NotificationsDropdownProps) {
  const supabase = supabaseBrowser()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const unreadCount = notifications.filter(n => !n.read).length

  const loadNotifications = async () => {
    try {
      // Cargar notificaciones reales de Supabase
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setNotifications([])
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        console.error('Error loading notifications:', error)
        setNotifications([])
      } else if (data) {
        // Convertir formato de base de datos a formato del componente
        const mappedNotifications: Notification[] = data.map((n: DbNotification) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          timestamp: n.created_at,
          read: n.read,
          actionUrl: n.action_url || undefined
        }))
        setNotifications(mappedNotifications)
      }
    } catch (error) {
      console.error('Error in loadNotifications:', error)
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }

  // Cargar notificaciones al montar el componente
  useEffect(() => {
    loadNotifications()

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
        },
        () => {
          loadNotifications()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase.rpc('mark_notification_as_read', {
        p_notification_id: id
      })

      if (error) throw error

      // Actualizar estado local inmediatamente
      setNotifications(prev =>
        prev.map(notification =>
          notification.id === id
            ? { ...notification, read: true }
            : notification
        )
      )
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase.rpc('mark_all_notifications_as_read')

      if (error) throw error

      // Actualizar estado local inmediatamente
      setNotifications(prev =>
        prev.map(notification => ({ ...notification, read: true }))
      )
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }

  const deleteNotification = async (id: string) => {
    try {
      const { error } = await supabase.rpc('delete_notification', {
        p_notification_id: id
      })

      if (error) throw error

      // Actualizar estado local inmediatamente
      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    // Marcar como leída
    if (!notification.read) {
      markAsRead(notification.id)
    }

    // Navegar a la URL de acción si existe
    if (notification.actionUrl) {
      router.push(notification.actionUrl)
      setIsOpen(false)
    }
  }

  return (
    <div className={cn('relative', className)}>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-destructive text-[10px] text-destructive-foreground flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <Card className="absolute right-0 top-12 w-80 z-50 max-h-96 overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Notificaciones</CardTitle>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllAsRead}
                    className="text-xs"
                  >
                    Marcar todas como leídas
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No hay notificaciones</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {notifications.map((notification) => {
                      const Icon = notificationIcons[notification.type]
                      return (
                        <div
                          key={notification.id}
                          className={cn(
                            'p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors',
                            !notification.read && 'bg-blue-50/50',
                            notification.actionUrl && 'cursor-pointer'
                          )}
                        >
                          <div className="flex items-start space-x-3">
                            <div className={cn(
                              'p-1 rounded-full',
                              notificationColors[notification.type]
                            )}>
                              <Icon className="h-3 w-3" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
                                <div
                                  className="flex-1"
                                  onClick={() => handleNotificationClick(notification)}
                                >
                                  <p className="text-sm font-medium text-foreground">
                                    {notification.title}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {notification.message}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {formatDistanceToNow(new Date(notification.timestamp), {
                                      addSuffix: true,
                                      locale: es
                                    })}
                                  </p>
                                </div>

                                <div className="flex items-center space-x-1 ml-2">
                                  {!notification.read && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        markAsRead(notification.id)
                                      }}
                                    >
                                      <Check className="h-3 w-3" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      deleteNotification(notification.id)
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

