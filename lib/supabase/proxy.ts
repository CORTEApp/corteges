import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type SupabaseCookie = {
  name: string
  value: string
  options: CookieOptions
}

type AuthErrorLike = {
  code?: unknown
  message?: unknown
  status?: unknown
}

function isRefreshTokenNotFoundError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false
  }

  const authError = error as AuthErrorLike
  return (
    authError.code === 'refresh_token_not_found' ||
    (authError.status === 400 &&
      typeof authError.message === 'string' &&
      authError.message.includes('Refresh Token Not Found'))
  )
}

function supabaseAuthCookiePrefix() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    return null
  }

  try {
    return `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
  } catch {
    return null
  }
}

function isSupabaseAuthCookie(cookieName: string) {
  const prefix = supabaseAuthCookiePrefix()
  return Boolean(prefix && (cookieName === prefix || cookieName.startsWith(`${prefix}.`)))
}

function clearSupabaseAuthCookies(request: NextRequest, response: NextResponse) {
  request.cookies.getAll().forEach(({ name }) => {
    if (!isSupabaseAuthCookie(name)) {
      return
    }

    request.cookies.delete(name)
    response.cookies.set(name, '', { maxAge: 0, path: '/' })
  })

  return response
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: SupabaseCookie[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  try {
    const { error } = await supabase.auth.getClaims()
    if (isRefreshTokenNotFoundError(error)) {
      return clearSupabaseAuthCookies(request, response)
    }
  } catch (error) {
    if (isRefreshTokenNotFoundError(error)) {
      return clearSupabaseAuthCookies(request, response)
    }

    throw error
  }

  return response
}
