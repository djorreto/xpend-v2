// src/lib/supabase.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'

// Cliente para componentes Client (use client)
export const supabaseBrowser = () => createClientComponentClient()

// Cliente admin solo en servidor (no se usa en Client Components)
export const supabaseAdmin =
  process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
    : null
