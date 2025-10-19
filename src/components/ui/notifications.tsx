'use client'

import { useState, useEffect } from 'react'
import { Bell, Check, X, AlertCircle, Info, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface Notification {
  id: string
  type: 'info' | 'warning' | 'success' | 'error'
  title: string
  message: string
  timestamp: string
  read: boolean
  actionUrl?: string
}

const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'warning',
    title: 'Hito próximo a vencer',
    message: 'El hito "Análisis de Requerimientos" del proyecto "Modernización IT" vence en 2 días',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 horas atrás
    read: false,
    actionUrl: '/projects/1'
  },
  {
    id: '2',
    type: 'info',
    title: 'Nueva licitación publicada',
    message: 'Se ha publicado la licitación "Suministro de Equipos de Oficina" con fecha límite 15/01/2025',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 horas atrás
    read: false,
    actionUrl: '/licitaciones/1'
  },
  {
    id: '3',
    type: 'success',
    title: 'Proyecto completado',
    message: 'El proyecto "Optimización de Proveedores" ha sido marcado como completado',
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 horas atrás
    read: true,
    actionUrl: '/projects/2'
  },
  {
    id: '4',
    type: 'error',
    title: 'Error en importación de datos',
    message: 'La importación del archivo "spend_data_2024.xlsx" ha fallado. Verificar formato del archivo',
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), // 8 horas atrás
    read: false,
    actionUrl: '/spend'
  },
  {
    id: '5',
    type: 'info',
    title: 'Nuevo usuario agregado',
    message: 'María González ha sido agregada al equipo con rol de Analista',
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 horas atrás
    read: true,
    actionUrl: '/users'
  }
]

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
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications)
  const [isOpen, setIsOpen] = useState(false)

  const unreadCount = notifications.filter(n => !n.read).length

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, read: true }
          : notification
      )
    )
  }

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    )
  }

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
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
                            !notification.read && 'bg-blue-50/50'
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
                                <div className="flex-1">
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
                                      onClick={() => markAsRead(notification.id)}
                                    >
                                      <Check className="h-3 w-3" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => deleteNotification(notification.id)}
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

