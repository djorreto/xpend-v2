'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { BlockCard, EmptyHint } from '@/components/workspace-blocks'
import { supabaseBrowser } from '@/lib/supabase'
import { roleLabel } from '@/lib/navigation'

type Counts = { users: Record<string, number>; teams: number; categories: number; assigned: number; plan: { status: string; year: number } | null }

const LINKS = [
  { label: 'Usuarios y accesos', href: '/users', hint: 'Altas, roles y estado de cada persona' },
  { label: 'Roles y permisos', href: '/administracion/roles', hint: 'Qué puede hacer cada rol' },
  { label: 'Equipos y categorías', href: '/equipos', hint: 'Category Managers, suplentes y equipos de Procurement' },
  { label: 'Plan anual', href: '/plan-anual', hint: 'Metas por categoría y fechas comprometidas' },
  { label: 'Configuración de la empresa', href: '/settings', hint: 'Datos generales e integraciones' },
]

// Perspectiva de Administración: usuarios, equipos, categorías y configuración de la empresa activa. Todo con datos reales de la empresa.
export function AdminPerspective({ companyId, role }: { companyId: string; role: string }) {
  const [counts, setCounts] = useState<Counts | null>(null)

  useEffect(() => {
    let alive = true
    const supabase = supabaseBrowser()
    const year = new Date().getFullYear()
    Promise.all([
      supabase.from('profiles').select('role').eq('company_id', companyId),
      supabase.from('procurement_teams').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
      supabase.from('procurement_categories').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
      supabase.from('category_assignments').select('category_id', { count: 'exact', head: true }).eq('company_id', companyId).not('manager_user_id', 'is', null),
      supabase.from('annual_plans').select('status, plan_year').eq('company_id', companyId).eq('plan_year', year).maybeSingle(),
    ]).then(([profiles, teams, categories, assigned, plan]) => {
      if (!alive) return
      const users: Record<string, number> = {}
      for (const row of (profiles.data || []) as { role: string }[]) users[row.role] = (users[row.role] || 0) + 1
      setCounts({
        users,
        teams: teams.count || 0,
        categories: categories.count || 0,
        assigned: assigned.count || 0,
        plan: plan.data ? { status: plan.data.status as string, year: plan.data.plan_year as number } : null,
      })
    })
    return () => { alive = false }
  }, [companyId])

  const total = counts ? Object.values(counts.users).reduce((sum, value) => sum + value, 0) : 0
  return (
    <div className="space-y-4" data-testid="vista-administracion">
      <BlockCard title="Administración de la empresa" description="Usuarios autorizados, equipos de Procurement, categorías y configuración. Tu rol define qué puedes cambiar; esta vista no lo amplía.">
        {!counts ? <EmptyHint>Cargando…</EmptyHint> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="glass-chip p-3" data-testid="admin-usuarios">
              <p className="text-[12px] text-petrol-blue/75">Usuarios autorizados</p>
              <p className="mt-1 text-[1.35rem] font-medium text-petrol-blue">{total}</p>
              <p className="text-[12px] text-petrol-blue/75">{Object.entries(counts.users).map(([key, value]) => `${value} ${roleLabel(key).toLowerCase()}`).join(' · ') || 'Sin usuarios'}</p>
            </div>
            <div className="glass-chip p-3" data-testid="admin-equipos">
              <p className="text-[12px] text-petrol-blue/75">Equipos de Procurement</p>
              <p className="mt-1 text-[1.35rem] font-medium text-petrol-blue">{counts.teams}</p>
            </div>
            <div className="glass-chip p-3" data-testid="admin-categorias">
              <p className="text-[12px] text-petrol-blue/75">Categorías</p>
              <p className="mt-1 text-[1.35rem] font-medium text-petrol-blue">{counts.categories}</p>
              <p className="text-[12px] text-petrol-blue/75">{counts.assigned} con Category Manager</p>
            </div>
            <div className="glass-chip p-3" data-testid="admin-plan">
              <p className="text-[12px] text-petrol-blue/75">Plan anual {new Date().getFullYear()}</p>
              <p className="mt-1 text-[1.35rem] font-medium text-petrol-blue">{counts.plan ? (counts.plan.status === 'committed' ? 'Comprometido' : 'Borrador') : 'Sin plan'}</p>
            </div>
          </div>
        )}
      </BlockCard>
      <BlockCard title="Dónde se configura cada cosa">
        <div className="grid gap-2 text-[12.5px] sm:grid-cols-2 lg:grid-cols-3">
          {LINKS.map(item => (
            <Link key={item.href} href={item.href} className="glass-chip block p-3 hover:bg-white/70">
              <span className="block font-medium text-petrol-blue">{item.label}</span>
              <span className="block text-[12px] text-petrol-blue/75">{item.hint}</span>
            </Link>
          ))}
          {role === 'super_admin' && (
            <Link href="/super-admin" className="glass-chip block p-3 hover:bg-white/70" data-testid="link-super-admin">
              <span className="block font-medium text-petrol-blue">Consola de Super Admin</span>
              <span className="block text-[12px] text-petrol-blue/75">Empresas y opciones de plataforma</span>
            </Link>
          )}
        </div>
      </BlockCard>
    </div>
  )
}
