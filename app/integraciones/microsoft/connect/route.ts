import { randomBytes } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"

import { buildMicrosoftAuthorizationUrl, isMicrosoftAuthorizationPurpose } from "@/lib/microsoft/graph"
import { getPublicOrigin } from "@/lib/public-origin"
import { createClient } from "@/lib/supabase/server"

const STATE_COOKIE = "corteges_ms_oauth_state"
const NEXT_COOKIE = "corteges_ms_oauth_next"
const PURPOSE_COOKIE = "corteges_ms_oauth_purpose"

function safeNext(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/perfil"
  }
  return raw
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const publicOrigin = getPublicOrigin(request)
  const next = safeNext(url.searchParams.get("next"))
  const requestedPurpose = url.searchParams.get("purpose")
  const purpose = isMicrosoftAuthorizationPurpose(requestedPurpose) ? requestedPurpose : "graph"
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL(`/auth/login?next=${encodeURIComponent(next)}`, publicOrigin))
  }

  const state = randomBytes(24).toString("base64url")
  let authUrl: URL
  try {
    authUrl = buildMicrosoftAuthorizationUrl(publicOrigin, state, purpose)
  } catch {
    return NextResponse.redirect(new URL("/auth/error", publicOrigin))
  }

  const response = NextResponse.redirect(authUrl)
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  }

  response.cookies.set(STATE_COOKIE, state, cookieOptions)
  response.cookies.set(NEXT_COOKIE, next, cookieOptions)
  response.cookies.set(PURPOSE_COOKIE, purpose, cookieOptions)
  return response
}
