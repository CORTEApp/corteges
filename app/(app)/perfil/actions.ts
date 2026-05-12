"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { getAuthenticatedMembership } from "@/lib/users/server"
import { derivePrimaryAppRole, readAuthUserMetadata, rolesFromAuthMetadata } from "@/lib/users/roles"

const LANGUAGE_COOKIE = "skynet_ux_language"
const SUPPORTED_LANGUAGES = new Set(["es", "en", "ca"])
const VALID_THEME_MODES = new Set(["light", "dark", "system"])
const VALID_TEXT_SIZES = new Set(["small", "medium", "large"])
const VALID_THEME_PRESETS = new Set([
  "saas_atlas_blue_v2",
  "saas_cobalt_sand_v2",
  "saas_ember_slate_v2",
  "saas_olive_stone_v2",
])

function stringValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function allowedValue(value: string, allowed: Set<string>, fallback: string) {
  return allowed.has(value) ? value : fallback
}

export async function updateProfilePreferences(formData: FormData) {
  const membership = await getAuthenticatedMembership("/perfil")
  const user = membership.user
  const admin = createAdminClient()
  const displayName = stringValue(formData, "display_name")
  const preferredLanguage = allowedValue(stringValue(formData, "preferred_language").toLowerCase(), SUPPORTED_LANGUAGES, "es")
  const preferredTheme = allowedValue(stringValue(formData, "preferred_theme"), VALID_THEME_PRESETS, "saas_atlas_blue_v2")
  const colorMode = allowedValue(stringValue(formData, "color_mode"), VALID_THEME_MODES, "system")
  const textSize = allowedValue(stringValue(formData, "text_size"), VALID_TEXT_SIZES, "medium")
  const password = stringValue(formData, "password")
  const passwordConfirm = stringValue(formData, "password_confirm")

  if (password || passwordConfirm) {
    if (password.length < 8) {
      throw new Error("La contraseña debe tener al menos 8 caracteres.")
    }
    if (password !== passwordConfirm) {
      throw new Error("La confirmación de contraseña no coincide.")
    }
  }

  const authUserResult = await admin.auth.admin.getUserById(user.id)
  if (authUserResult.error || !authUserResult.data.user) {
    throw new Error(authUserResult.error?.message || "No se pudo cargar el usuario autenticado.")
  }

  const authUser = authUserResult.data.user
  const metadata = readAuthUserMetadata(authUser)
  const roles = membership.roles.length ? membership.roles : rolesFromAuthMetadata(authUser)
  const primaryRole = derivePrimaryAppRole(roles)
  const nextDisplayName =
    displayName ||
    (typeof metadata.display_name === "string" && metadata.display_name.trim()) ||
    authUser.email ||
    "Usuario interno"

  const updateResult = await admin.auth.admin.updateUserById(user.id, {
    ...(password ? { password } : {}),
    user_metadata: {
      ...metadata,
      display_name: nextDisplayName,
      role: primaryRole,
      roles,
      bootstrap_master: roles.includes("master"),
      preferred_language: preferredLanguage,
      preferred_language_source: "profile",
      preferred_theme: preferredTheme,
      color_mode: colorMode,
      text_size: textSize,
    },
  })
  if (updateResult.error) {
    throw new Error(updateResult.error.message)
  }

  const profileUpsert = await admin.from("user_profiles").upsert(
    {
      id: user.id,
      email: authUser.email || user.email || "",
      display_name: nextDisplayName,
      role: primaryRole,
      preferred_language: preferredLanguage,
      preferred_theme: preferredTheme,
      color_mode: colorMode,
      text_size: textSize,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  )
  if (profileUpsert.error) {
    throw new Error(profileUpsert.error.message)
  }

  const cookieStore = await cookies()
  cookieStore.set(LANGUAGE_COOKIE, preferredLanguage, {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  })

  revalidatePath("/perfil")
  redirect("/perfil?saved=1")
}

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/auth/login")
}
