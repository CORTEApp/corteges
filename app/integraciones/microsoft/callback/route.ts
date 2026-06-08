import { NextRequest, NextResponse } from "next/server"

import {
  exchangeMicrosoftAuthorizationCode,
  isMicrosoftAuthorizationPurpose,
  readMicrosoftProfile,
  readMicrosoftProfileFromIdToken,
  saveMicrosoftConnection,
} from "@/lib/microsoft/graph"
import { getPublicOrigin } from "@/lib/public-origin"
import { createClient } from "@/lib/supabase/server"

const STATE_COOKIE = "corteges_ms_oauth_state"
const NEXT_COOKIE = "corteges_ms_oauth_next"
const PURPOSE_COOKIE = "corteges_ms_oauth_purpose"

function safeNext(raw: string | undefined) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/perfil"
  }
  return raw
}

function redirectClearingCookies(request: NextRequest, next: string) {
  const response = NextResponse.redirect(new URL(next, getPublicOrigin(request)))
  response.cookies.delete(STATE_COOKIE)
  response.cookies.delete(NEXT_COOKIE)
  response.cookies.delete(PURPOSE_COOKIE)
  return response
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const publicOrigin = getPublicOrigin(request)
  const next = safeNext(request.cookies.get(NEXT_COOKIE)?.value)
  const state = url.searchParams.get("state")
  const expectedState = request.cookies.get(STATE_COOKIE)?.value
  const requestedPurpose = request.cookies.get(PURPOSE_COOKIE)?.value
  const purpose = isMicrosoftAuthorizationPurpose(requestedPurpose) ? requestedPurpose : "graph"
  const code = url.searchParams.get("code")

  if (!code || !state || !expectedState || state !== expectedState || url.searchParams.get("error")) {
    return redirectClearingCookies(request, next)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirectClearingCookies(request, `/auth/login?next=${encodeURIComponent(next)}`)
  }

  try {
    const token = await exchangeMicrosoftAuthorizationCode(code, publicOrigin, purpose)
    const profile = purpose === "files"
      ? readMicrosoftProfileFromIdToken(token.id_token)
      : await readMicrosoftProfile(token.access_token)
    await saveMicrosoftConnection(user.id, token, profile ?? {}, purpose)
  } catch {
    return redirectClearingCookies(request, next)
  }

  return redirectClearingCookies(request, next)
}
