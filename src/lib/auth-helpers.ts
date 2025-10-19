import { createClient } from '@/lib/supabase-server'
import { User } from '@supabase/supabase-js'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  company_id: string | null
  role: 'admin' | 'manager' | 'analyst' | 'viewer'
  created_at: string
  updated_at: string
}

export interface Company {
  id: string
  name: string
  description: string | null
  logo_url: string | null
  settings: any
  created_at: string
  updated_at: string
}

// Server-side helper to get current user profile
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return null
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return null
  }

  return profile
}

// Server-side helper to get current user with company info
export async function getCurrentUserWithCompany(): Promise<{
  user: User
  profile: Profile
  company: Company | null
} | null> {
  const supabase = createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return null
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return null
  }

  let company = null
  if (profile.company_id) {
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', profile.company_id)
      .single()

    if (!companyError && companyData) {
      company = companyData
    }
  }

  return {
    user,
    profile,
    company
  }
}

// Client-side helper to get current user profile
export async function getCurrentProfileClient(): Promise<Profile | null> {
  const { supabase } = await import('@/lib/supabase')
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return null
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return null
  }

  return profile
}

// Helper to check if user has required role
export function hasRole(profile: Profile | null, requiredRole: string): boolean {
  if (!profile) return false
  
  const roleHierarchy = {
    'viewer': 0,
    'analyst': 1,
    'manager': 2,
    'admin': 3
  }
  
  const userLevel = roleHierarchy[profile.role] || 0
  const requiredLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 0
  
  return userLevel >= requiredLevel
}

// Helper to check if user can access company data
export function canAccessCompany(profile: Profile | null, companyId: string): boolean {
  if (!profile) return false
  return profile.company_id === companyId
}
