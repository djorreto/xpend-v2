// src/lib/supabase.ts
import { createBrowserClient, createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

export const supabaseBrowser = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          if (typeof document !== 'undefined') {
            const cookie = document.cookie
              .split('; ')
              .find((row) => row.startsWith(`${name}=`))
            return cookie ? cookie.split('=')[1] : undefined
          }
          return undefined
        },
        set(name: string, value: string, options: any) {
          if (typeof document !== 'undefined') {
            let cookie = `${name}=${value}`
            if (options?.maxAge) cookie += `; max-age=${options.maxAge}`
            if (options?.path) cookie += `; path=${options.path}`
            if (options?.domain) cookie += `; domain=${options.domain}`
            if (options?.secure) cookie += '; secure'
            if (options?.sameSite) cookie += `; samesite=${options.sameSite}`
            document.cookie = cookie
          }
        },
        remove(name: string, options: any) {
          if (typeof document !== 'undefined') {
            let cookie = `${name}=; max-age=0`
            if (options?.path) cookie += `; path=${options.path}`
            document.cookie = cookie
          }
        },
      },
    }
  )

export const createSupabaseServer = (cookies: any) =>
  createServerClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies }
  )

export const supabaseAdmin =
  process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
    : null