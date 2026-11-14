import { NextResponse, type NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: request.headers },
  })

  // Manejo completo de cookies + refresh de sesión
  const supabase = createMiddlewareClient({ req: request, res: response })
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle()
    const path = request.nextUrl.pathname
    const supplierAllowed = path.startsWith('/sala') || path.startsWith('/api/sala') || path.startsWith('/login') || path.startsWith('/auth') || path.startsWith('/reset-password')
    if (profile?.role === 'supplier' && !supplierAllowed) {
      const redirected = NextResponse.redirect(new URL('/sala', request.url))
      for (const cookie of response.headers.getSetCookie()) {
        redirected.headers.append('set-cookie', cookie)
      }
      return redirected
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

