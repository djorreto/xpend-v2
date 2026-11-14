'use client'

import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase'
import { SILearningRule } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const TYPE_LABEL: Record<string, string> = {
  keyword: 'Palabra',
  supplier: 'Proveedor',
  correction: 'Solo esta compra',
}

const SOURCE_LABEL: Record<string, string> = {
  supplier_always: 'Siempre el proveedor',
  supplier_multi: 'Varios rubros',
  line_only: 'Solo esta compra',
  user_correction: 'Corrección anterior',
}

type Draft = {
  pattern: string
  category: string
  subcategory: string
}

export function SpendRulesPanel() {
  const supabase = supabaseBrowser()
  const [rules, setRules] = useState<SILearningRule[]>([])
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>({ pattern: '', category: '', subcategory: '' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [])

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setLoading(false)
      return
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', session.user.id)
      .single()
    if (!profile?.company_id) {
      setLoading(false)
      return
    }
    setCompanyId(profile.company_id)
    const { data, error } = await supabase
      .from('si_learning_rules')
      .select('*')
      .eq('company_id', profile.company_id)
      .in('rule_type', ['keyword', 'supplier', 'correction'])
      .order('updated_at', { ascending: false })
      .limit(80)
    if (error) setMessage(error.message)
    setRules((data || []) as SILearningRule[])
    setLoading(false)
  }

  const startEdit = (rule: SILearningRule) => {
    setEditingId(rule.id)
    setDraft({
      pattern: rule.pattern,
      category: rule.category,
      subcategory: rule.subcategory || '',
    })
    setMessage(null)
  }

  const save = async (rule: SILearningRule) => {
    if (!companyId || !draft.pattern.trim() || !draft.category.trim()) {
      setMessage('El patrón y la familia son obligatorios.')
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('si_learning_rules')
      .update({
        pattern: draft.pattern.trim(),
        category: draft.category.trim(),
        subcategory: draft.subcategory.trim() || null,
      })
      .eq('id', rule.id)
      .eq('company_id', companyId)
    setSaving(false)
    if (error) {
      setMessage(error.message)
      return
    }
    setRules(current => current.map(item => item.id === rule.id
      ? { ...item, pattern: draft.pattern.trim(), category: draft.category.trim(), subcategory: draft.subcategory.trim() || undefined }
      : item))
    setEditingId(null)
    setMessage('Regla corregida. La próxima clasificación ya la usa.')
  }

  const remove = async (rule: SILearningRule) => {
    if (!companyId || !confirm('Se quita esta regla. Las líneas ya clasificadas no cambian solas.')) return
    const { error } = await supabase
      .from('si_learning_rules')
      .delete()
      .eq('id', rule.id)
      .eq('company_id', companyId)
    if (error) {
      setMessage(error.message)
      return
    }
    setRules(current => current.filter(item => item.id !== rule.id))
    setMessage('Regla quitada.')
  }

  const visible = rules.filter(rule => {
    const blob = `${rule.pattern} ${rule.category} ${rule.subcategory || ''}`.toLowerCase()
    return blob.includes(query.trim().toLowerCase())
  })

  if (loading) return <p className="mt-4 text-sm text-muted-foreground">Cargando reglas de esta empresa…</p>

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{rules.length} reglas. Valen solo para esta empresa.</p>
        <Input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Buscar patrón o familia"
          className="max-w-xs"
        />
      </div>
      {message && <p className="text-sm">{message}</p>}
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay reglas para mostrar. Aparecen cuando alguien corrige una línea.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-2 font-medium">Tipo</th>
                <th className="p-2 font-medium">Patrón</th>
                <th className="p-2 font-medium">Familia</th>
                <th className="p-2 font-medium">Subcategoría</th>
                <th className="p-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {visible.map(rule => {
                const editing = editingId === rule.id
                return (
                  <tr key={rule.id} className="border-b last:border-0 align-top">
                    <td className="p-2">{SOURCE_LABEL[rule.source || ''] || TYPE_LABEL[rule.rule_type] || rule.rule_type}</td>
                    <td className="p-2">
                      {editing
                        ? <Input value={draft.pattern} onChange={event => setDraft({ ...draft, pattern: event.target.value })} />
                        : rule.pattern}
                    </td>
                    <td className="p-2">
                      {editing
                        ? <Input value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })} />
                        : rule.category}
                    </td>
                    <td className="p-2">
                      {editing
                        ? <Input value={draft.subcategory} onChange={event => setDraft({ ...draft, subcategory: event.target.value })} />
                        : (rule.subcategory || '—')}
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      {editing ? (
                        <div className="flex gap-2">
                          <Button size="sm" disabled={saving} onClick={() => save(rule)}>Guardar</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancelar</Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => startEdit(rule)}>Corregir</Button>
                          <Button size="sm" variant="ghost" onClick={() => remove(rule)}>Quitar</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
