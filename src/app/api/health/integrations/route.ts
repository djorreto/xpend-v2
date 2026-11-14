import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { hasRole, type Profile } from '@/lib/auth-helpers'
import { supabaseProjectsMatch } from '@/lib/spend-access'

export const runtime = 'nodejs'

const TEXT_MODEL = 'qwen/qwen3.8-27b'

type Issue = { level: 'blocker' | 'watch'; title: string; detail: string }

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  if (!profile || !hasRole(profile as Profile, 'admin')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const issues: Issue[] = []
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    issues.push({
      level: 'blocker',
      title: 'Supabase sin configurar',
      detail: 'Falta NEXT_PUBLIC_SUPABASE_URL en el entorno.',
    })
  }

  if (!supabaseProjectsMatch()) {
    issues.push({
      level: 'blocker',
      title: 'Supabase inconsistente',
      detail: 'La URL y las llaves son de proyectos distintos.',
    })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    issues.push({
      level: 'watch',
      title: 'Falta la service role',
      detail: 'Las rutas de administración que crean usuarios no van a poder operar.',
    })
  }

  if (!process.env.RESEND_API_KEY) {
    issues.push({
      level: 'watch',
      title: 'Correo sin configurar',
      detail: 'Falta RESEND_API_KEY. Las invitaciones y el cambio de contraseña muestran el enlace para copiarlo, no envían un mail.',
    })
  }

  const groqKey = process.env.GROQ_API_KEY || ''
  if (!groqKey) {
    issues.push({
      level: 'blocker',
      title: 'Groq sin clave',
      detail: 'ANA, la clasificación de gasto y las bases técnicas quedan apagadas.',
    })
  } else {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${groqKey}` },
        cache: 'no-store',
      })
      const body = await response.json()
      const ids: string[] = (body.data || []).map((model: { id: string }) => model.id)
      if (!response.ok) {
        issues.push({
          level: 'blocker',
          title: 'Groq rechazó la clave',
          detail: 'La clasificación y RFx Maker no van a generar texto hasta renovar la clave.',
        })
      } else if (!ids.includes(TEXT_MODEL)) {
        issues.push({
          level: 'blocker',
          title: 'El modelo de Groq no está en la cuenta',
          detail: 'La cuenta no ofrece el modelo de texto que usa la app.',
        })
      }
    } catch {
      issues.push({
        level: 'watch',
        title: 'No se pudo consultar Groq',
        detail: 'La red bloqueó la comprobación. ANA puede fallar al usarse.',
      })
    }
  }

  return NextResponse.json({
    ok: issues.every(issue => issue.level !== 'blocker'),
    issues,
  })
}
