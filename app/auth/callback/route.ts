import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function getSafeRedirectPath(rawNext: string | null) {
  if (!rawNext) return '/dashboard'
  if (!rawNext.startsWith('/')) return '/dashboard'
  if (rawNext.startsWith('//')) return '/dashboard'
  return rawNext
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = getSafeRedirectPath(url.searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(new URL(next, url.origin))
}
