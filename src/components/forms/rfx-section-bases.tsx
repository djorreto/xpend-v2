'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Sparkles } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase'
import { RFX_FIELDS, basesAreReady, basesMarkdown } from '@/lib/rfx-sections'
import type { RfxProject } from '@/types/rfx-maker'

export function RfxSectionBases({
  project,
  disabled,
  onSaved,
}: {
  project: RfxProject
  disabled?: boolean
  onSaved: (patch: Partial<RfxProject>) => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const current: Record<string, string> = {}
    for (const field of RFX_FIELDS) current[field.key] = String(project.admin_parameters?.[field.key] || '')
    return current
  })
  const [saving, setSaving] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState('')

  const sections = Array.from(new Set(RFX_FIELDS.map(field => field.section)))

  async function prepare() {
    setPreparing(true)
    setError('')
    try {
      const response = await fetch('/api/rfx-maker/prefill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: project.title,
          rfx_type: project.rfx_type,
          description: project.description,
          plan: project.project_context,
        }),
      })
      const body = await response.json()
      if (!response.ok) {
        setError(body.error || 'ANA no pudo preparar las bases')
        return
      }
      setValues(current => ({ ...current, ...body.values }))
    } catch {
      setError('ANA no pudo preparar las bases')
    } finally {
      setPreparing(false)
    }
  }

  async function save() {
    setSaving(true)
    setError('')
    const admin_parameters = { ...project.admin_parameters, ...values }
    const technical_base_content = basesMarkdown(project.title, project.rfx_type, values)
    const technical_base_is_valid = basesAreReady(values)
    const { error: updateError } = await supabaseBrowser()
      .from('rfx_projects')
      .update({
        admin_parameters,
        admin_parameters_last_modified: new Date().toISOString(),
        technical_base_content,
        technical_base_is_valid,
        technical_base_manually_edited: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', project.id)
    setSaving(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    onSaved({
      admin_parameters,
      technical_base_content,
      technical_base_is_valid,
      technical_base_manually_edited: true,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Secciones de las bases</h3>
          <p className="text-sm text-gray-500">Plazo, garantía y pago se editan aquí, en español.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={disabled || preparing} onClick={prepare}>
            {preparing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Preparar con ANA
          </Button>
          <Button type="button" disabled={disabled || saving} onClick={save}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar bases
          </Button>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {sections.map(section => (
        <div key={section} className="space-y-3 rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-medium">{section}</p>
          {RFX_FIELDS.filter(field => field.section === section).map(field => (
            <div key={field.key} className="space-y-1">
              <Label htmlFor={`bases-${field.key}`}>{field.label}</Label>
              <Textarea
                id={`bases-${field.key}`}
                rows={2}
                disabled={disabled}
                value={values[field.key] || ''}
                onChange={(event) => setValues(current => ({ ...current, [field.key]: event.target.value }))}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
