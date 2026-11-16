'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabaseBrowser } from '@/lib/supabase'
import { Brain, Upload, FileSpreadsheet, TrendingUp, Target, CheckCircle, Clock, AlertCircle, Plus, Trash2 } from 'lucide-react'
import { SIUpload } from '@/types'
import { canManageSpendRole, canReadSpendRole } from '@/lib/spend-privacy'
import { ReprocessButton } from '@/components/spend/reprocess-button'
import { SpendFlowBar } from '@/components/spend/spend-flow-bar'
import { SpendBrainChip } from '@/components/spend/spend-brain-chip'
import { SpendDownloadButton } from '@/components/spend/spend-download-button'

export default function SourcingIntelligencePage() {
  const router = useRouter()
  const supabase = supabaseBrowser()

  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [uploads, setUploads] = useState<SIUpload[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [groupName, setGroupName] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Obtener sesión
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      // Obtener perfil
      const { data: profile } = await supabase
        .from('profiles')
        .select('*, companies(*)')
        .eq('id', session.user.id)
        .single()

      if (profile) {
        setUser(profile)
        setCompany(profile.companies)

        if (!canReadSpendRole(profile.role)) return

        if (canManageSpendRole(profile.role)) {
          await fetch('/api/si/retention', { method: 'POST' })
        }

        // Obtener uploads
        const { data: uploadsData } = await supabase
          .from('si_uploads')
          .select('*')
          .eq('company_id', profile.company_id)
          .order('created_at', { ascending: false })

        if (uploadsData) {
          setUploads(uploadsData)
        }
        const { data: groupRows } = await supabase
          .from('si_spend_groups')
          .select('id, name')
          .eq('company_id', profile.company_id)
          .order('name')
        setGroups(groupRows || [])
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'uploaded':
        return { label: 'Cargado', color: 'bg-blue-500', icon: Upload }
      case 'processing':
        return { label: 'Procesando', color: 'bg-yellow-500', icon: Clock }
      case 'classified':
        return { label: 'Clasificado', color: 'bg-purple-500', icon: Brain }
      case 'reviewed':
        return { label: 'Revisado', color: 'bg-indigo-500', icon: CheckCircle }
      case 'completed':
        return { label: 'Completado', color: 'bg-green-500', icon: CheckCircle }
      case 'error':
        return { label: 'Error', color: 'bg-red-500', icon: AlertCircle }
      default:
        return { label: status, color: 'bg-gray-500', icon: FileSpreadsheet }
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleDelete = async (uploadId: string) => {
    if (!confirm('Se borrará esta carga y todas sus líneas de gasto. Esta acción no se puede deshacer.')) return
    setDeletingId(uploadId)
    try {
      const response = await fetch('/api/si/delete-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upload_id: uploadId })
      })
      const result = await response.json()
      if (!response.ok) {
        alert(result.error || 'No se pudo borrar la carga')
        return
      }
      setUploads(current => current.filter(item => item.id !== uploadId))
    } catch {
      alert('No se pudo borrar la carga')
    } finally {
      setDeletingId(null)
    }
  }

  const createGroup = async () => {
    const name = groupName.trim()
    if (!name || !user?.company_id) return
    const { error } = await supabase.from('si_spend_groups').insert({
      company_id: user.company_id,
      name,
      created_by: user.id,
    })
    if (error) {
      alert(/unique|duplicate/i.test(error.message) ? 'Ya existe un grupo con ese nombre.' : 'No se pudo crear el grupo.')
      return
    }
    setGroupName('')
    await loadData()
  }

  const assignGroup = async (uploadId: string, nextGroup: string) => {
    const { error } = await supabase
      .from('si_uploads')
      .update({ group_id: nextGroup === 'none' ? null : nextGroup })
      .eq('id', uploadId)
      .eq('company_id', user.company_id)
    if (error) {
      alert('No se pudo asignar el grupo.')
      return
    }
    const previous = uploads.find(item => item.id === uploadId)?.group_id
    if (previous) {
      await supabase.from('si_procurement_plans').update({ stale: true }).eq('group_id', previous).eq('company_id', user.company_id)
    }
    if (nextGroup !== 'none') {
      await supabase.from('si_procurement_plans').update({ stale: true }).eq('group_id', nextGroup).eq('company_id', user.company_id)
    }
    setUploads(current => current.map(item => item.id === uploadId ? { ...item, group_id: nextGroup === 'none' ? null : nextGroup } : item))
  }

  const visibleUploads = uploads.filter(item => {
    if (groupFilter === 'all') return true
    if (groupFilter === 'none') return !item.group_id
    return item.group_id === groupFilter
  })

  const canRead = canReadSpendRole(user?.role)
  const canManage = canManageSpendRole(user?.role)

  if (loading) {
    return (
      <MainLayout user={user} companyName={company?.name}>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout user={user} companyName={company?.name}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center space-x-3">
              <Brain className="h-8 w-8" style={{ color: '#2AD4D2' }} />
              <span>Clasificación y categorías</span>
            </h1>
            <p className="text-muted-foreground mt-2">
              Carga gasto, clasifícalo con las reglas de la empresa y genera el plan de compras. La IA externa solo categoriza una línea si un administrador la autorizó.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
          <SpendBrainChip />
          <Button variant="outline" onClick={() => router.push('/sourcing-intelligence/flujo')}>
            Vista del flujo
          </Button>
          <Button variant="outline" onClick={() => router.push('/sourcing-intelligence/cerebro')}>
            Cerebro
          </Button>
          <Button variant="outline" onClick={() => router.push('/sourcing-intelligence/validacion')}>
            Validar gasto
          </Button>
          <Button variant="outline" onClick={() => router.push('/sourcing-intelligence/taxonomia')}>
            Taxonomía
          </Button>
          <Button
            onClick={() => router.push('/sourcing-intelligence/upload')}
            size="lg"
            className="bg-gradient-to-r from-[#2AD4D2] to-[#3BE7AE] hover:opacity-90"
            disabled={Boolean(user) && !canManage}
          >
            <Plus className="h-5 w-5 mr-2" />
            Nuevo Análisis
          </Button>
          </div>
        </div>

        <SpendFlowBar current="cargar" />

        <Card className="border-[#2AD4D2]/30 bg-[#2AD4D2]/5">
          <CardContent className="pt-4 text-sm text-muted-foreground">
            <strong className="text-foreground">Flujo visible:</strong> Cargar → Mapear → Clasificar → Revisar → Ver → Descargar.
            El cerebro (base, entrenamiento y modelo) se abre con un clic. El Excel de salida trae las líneas clasificadas y Kraljic.
          </CardContent>
        </Card>

        {!canRead && user && (
          <Card>
            <CardHeader>
              <CardTitle>Sin acceso al gasto</CardTitle>
              <CardDescription>Tu rol no puede ver las cargas de gasto de la empresa. Hace falta ser analista, manager o administrador.</CardDescription>
            </CardHeader>
          </Card>
        )}

        {canRead && (
        <>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Archivos Analizados</CardTitle>
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{uploads.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Líneas Procesadas</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {uploads.reduce((sum, u) => sum + u.processed_rows, 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Planes Generados</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {uploads.filter(u => u.status === 'completed').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En Proceso</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {uploads.filter(u => ['processing', 'classified', 'reviewed'].includes(u.status)).length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Grupos</CardTitle>
            <CardDescription>
              Un grupo junta los análisis de un holding, una filial o el nombre que quieras. El sourcing plan de ese grupo no mezcla los demás.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <input
                className="min-w-[220px] flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                value={groupName}
                onChange={event => setGroupName(event.target.value)}
                placeholder="Nombre del grupo"
              />
              <Button type="button" variant="outline" onClick={createGroup} disabled={!canManage}>Crear grupo</Button>
              <select className="rounded-md border bg-background px-3 py-2 text-sm" value={groupFilter} onChange={event => setGroupFilter(event.target.value)}>
                <option value="all">Todos los análisis</option>
                <option value="none">Sin grupo</option>
                {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              {groups.map(group => (
                <Button key={group.id} type="button" variant="outline" size="sm" onClick={() => router.push(`/sourcing-intelligence/grupo/${group.id}`)}>
                  {group.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Uploads List */}
        <Card>
          <CardHeader>
            <CardTitle>Todas las hojas de gasto cargadas</CardTitle>
            <CardDescription>
              Cada fila es una hoja (o un CSV completo). Desde aquí entras a clasificar, plan o insights según el estado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {visibleUploads.length === 0 ? null : (
              <div className="rounded-md border overflow-x-auto mb-8">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left">
                      <th className="p-3 font-medium">Archivo</th>
                      <th className="p-3 font-medium">Hoja / origen</th>
                      <th className="p-3 font-medium text-right">Filas</th>
                      <th className="p-3 font-medium">Estado</th>
                      <th className="p-3 font-medium">Cargado</th>
                      <th className="p-3 font-medium w-[220px]" />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleUploads.map((u) => {
                      const sheet =
                        (u.column_mapping && typeof u.column_mapping === 'object'
                          ? (u.column_mapping as Record<string, string>).sheet_used
                          : null) || (u.file_name?.toLowerCase().endsWith('.csv') ? 'CSV' : '—')
                      const statusInfo = getStatusInfo(u.status)
                      return (
                        <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="p-3 max-w-[240px]" title={u.file_name}>
                            <div className="truncate">{u.file_name}</div>
                            <select
                              className="mt-1 w-full rounded border bg-background px-1 py-0.5 text-xs"
                              value={u.group_id || 'none'}
                              onChange={event => assignGroup(u.id, event.target.value)}
                              disabled={!canManage}
                            >
                              <option value="none">Sin grupo</option>
                              {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
                            </select>
                          </td>
                          <td className="p-3 text-muted-foreground">{sheet}</td>
                          <td className="p-3 text-right tabular-nums">
                            {u.total_rows.toLocaleString()}
                          </td>
                          <td className="p-3">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color} bg-opacity-10 ${statusInfo.color.replace('bg-', 'text-')}`}
                            >
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="p-3 text-muted-foreground whitespace-nowrap">
                            {formatDate(u.created_at)}
                          </td>
                          <td className="p-3">
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => {
                                  router.push(`/sourcing-intelligence/${u.id}`)
                                }}
                              >
                                Abrir
                              </Button>
                              {['classified', 'reviewed', 'completed', 'processing'].includes(u.status) && (
                                <ReprocessButton uploadId={u.id} />
                              )}
                              {['classified', 'reviewed', 'completed'].includes(u.status) && (
                                <SpendDownloadButton uploadId={u.id} label="Excel" variant="ghost" size="sm" />
                              )}
                              {canManage && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDelete(u.id)}
                                  disabled={deletingId === u.id}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historial de Análisis</CardTitle>
            <CardDescription>
              Vista compacta; usa la tabla superior para ver todas las hojas con detalle
            </CardDescription>
          </CardHeader>
          <CardContent>
            {uploads.length === 0 ? (
              <div className="text-center py-12">
                <Brain className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium mb-2">No hay análisis aún</h3>
                <p className="text-muted-foreground mb-6">
                  Sube tu primer archivo Excel o CSV para comenzar
                </p>
                <Button
                  onClick={() => router.push('/sourcing-intelligence/upload')}
                  className="bg-gradient-to-r from-[#2AD4D2] to-[#3BE7AE]"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Subir Archivo
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {uploads.map((upload) => {
                  const statusInfo = getStatusInfo(upload.status)
                  const StatusIcon = statusInfo.icon

                  return (
                    <div
                      key={upload.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => {
                        router.push(`/sourcing-intelligence/${upload.id}`)
                      }}
                    >
                      <div className="flex items-center space-x-4 flex-1">
                        <div className={`p-3 rounded-lg ${statusInfo.color} bg-opacity-10`}>
                          <StatusIcon className={`h-6 w-6 ${statusInfo.color.replace('bg-', 'text-')}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{upload.file_name}</h4>
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                            <span>{formatBytes(upload.file_size)}</span>
                            <span>•</span>
                            <span>{upload.total_rows} líneas</span>
                            <span>•</span>
                            <span>{formatDate(upload.created_at)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color} bg-opacity-10 ${statusInfo.color.replace('bg-', 'text-')}`}>
                              {statusInfo.label}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {upload.processed_rows} / {upload.total_rows} procesadas
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/sourcing-intelligence/${upload.id}`)
                          }}
                        >
                          Ver Detalles →
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
        </>
        )}
      </div>
    </MainLayout>
  )
}

