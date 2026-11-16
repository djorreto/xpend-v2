'use client'

import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase'

type Tenant = { company_id: string; name: string; is_demo: boolean; is_active: boolean; is_home: boolean }

// Muestra siempre la empresa activa cuando es de demostración, y le da a un Super Admin autorizado un selector explícito de empresa.
// Cambiar de empresa no cambia la identidad ni el rol: solo la empresa activa (función switch_tenant, con bitácora).
export function TenantBar() {
  const [demo, setDemo] = useState<{ name: string } | null>(null)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    const run = async () => {
      const supabase = supabaseBrowser()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const { data: profile } = await supabase.from('profiles').select('role, company_id').eq('id', session.user.id).single()
      if (!profile?.company_id || !alive) return
      const { data: company } = await supabase.from('companies').select('name, settings').eq('id', profile.company_id).single()
      const isDemo = Boolean((company?.settings as { demo?: boolean } | null)?.demo)
      if (alive) setDemo(isDemo ? { name: company?.name || '' } : null)
      if (profile.role === 'super_admin') {
        const listed = await supabase.rpc('list_my_tenants')
        if (alive && !listed.error) setTenants((listed.data || []) as Tenant[])
      }
    }
    run().catch(() => undefined)
    return () => { alive = false }
  }, [])

  const switchTo = async (companyId: string) => {
    setBusy(true)
    setError(null)
    const { error: failure } = await supabaseBrowser().rpc('switch_tenant', { p_company: companyId })
    if (failure) {
      setError(failure.message)
      setBusy(false)
      return
    }
    window.location.assign('/dashboard')
  }

  const active = tenants.find(item => item.is_active)
  if (!demo && tenants.length < 2) return null

  return (
    <div data-testid="tenant-bar" className={`mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-4 py-2 text-[12.5px] ${demo ? 'border-amber-500/40 bg-amber-50 text-amber-900' : 'border-petrol-blue/15 bg-white/70 text-petrol-blue'}`}>
      {demo && (
        <p data-testid="demo-badge">
          <span className="mr-2 rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">Demo</span>
          <strong>{demo.name}</strong>: empresa de demostración con datos ficticios. No son resultados de un cliente.
        </p>
      )}
      {tenants.length > 1 && (
        <label className="flex items-center gap-2">
          <span className="font-medium">Empresa activa</span>
          <select
            aria-label="Empresa activa"
            data-testid="tenant-select"
            disabled={busy}
            value={active?.company_id || ''}
            onChange={event => switchTo(event.target.value)}
            className="h-8 rounded-xl border border-petrol-blue/20 bg-white px-2 text-[13px] text-petrol-blue"
          >
            {tenants.map(item => <option key={item.company_id} value={item.company_id}>{item.name}{item.is_demo ? ' · DEMO' : ''}{item.is_home ? ' · tu empresa' : ''}</option>)}
          </select>
          <span className="text-[12px] opacity-80">Tu identidad y permisos no cambian.</span>
        </label>
      )}
      {error && <span role="alert" className="text-red-700">{error}</span>}
    </div>
  )
}
