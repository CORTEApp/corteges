import { redirect } from "next/navigation"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import {
  derivePrimaryAppRole,
  isManagedUserDeactivated,
  normalizeAppRoles,
  rolesFromAuthMetadata,
  type AppRole,
  type ManagedAuthStatusUser,
} from "@/lib/users/roles"

type SupabaseAdminClient = ReturnType<typeof createAdminClient>

export type AuthenticatedAppUser = {
  id: string
  email: string | null
  user_metadata?: unknown
}

export type AppMembership = {
  user: AuthenticatedAppUser
  roles: AppRole[]
  primaryRole: AppRole
}

function loginRedirect(nextPath: string): never {
  redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`)
}

export async function requireAuthenticatedUser(nextPath = "/clientes"): Promise<AuthenticatedAppUser> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return loginRedirect(nextPath)
  }

  const admin = createAdminClient()
  const authUserResult = await admin.auth.admin.getUserById(user.id)
  if (!authUserResult.error && authUserResult.data.user) {
    if (isManagedUserDeactivated(authUserResult.data.user as ManagedAuthStatusUser)) {
      redirect(`/auth/login?deactivated=1&next=${encodeURIComponent(nextPath)}`)
    }
  }

  return {
    id: user.id,
    email: user.email ?? null,
    user_metadata: user.user_metadata,
  }
}

export async function getStoredUserRoles(
  admin: SupabaseAdminClient,
  userId: string,
  fallbackUser?: ManagedAuthStatusUser,
) {
  const rolesResult = await admin
    .from("app_user_roles")
    .select("role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })

  if (rolesResult.error) {
    const fallbackRoles = fallbackUser ? rolesFromAuthMetadata(fallbackUser) : []
    if (fallbackRoles.length) {
      return fallbackRoles
    }
    throw new Error(rolesResult.error.message)
  }

  const roles = normalizeAppRoles(((rolesResult.data ?? []) as Array<{ role: string }>).map((row) => row.role))
  if (roles.length) {
    return roles
  }

  return fallbackUser ? rolesFromAuthMetadata(fallbackUser) : []
}

export async function getAuthenticatedMembership(nextPath = "/clientes"): Promise<AppMembership> {
  const user = await requireAuthenticatedUser(nextPath)
  const admin = createAdminClient()
  const authUserResult = await admin.auth.admin.getUserById(user.id)
  const authUser = authUserResult.data.user ?? ({ user_metadata: user.user_metadata } as ManagedAuthStatusUser)
  const roles = await getStoredUserRoles(admin, user.id, authUser as ManagedAuthStatusUser)
  const effectiveRoles = roles.length ? roles : (["usuario"] as AppRole[])

  return {
    user,
    roles: effectiveRoles,
    primaryRole: derivePrimaryAppRole(effectiveRoles),
  }
}

export async function requireMasterAccess(nextPath = "/usuarios") {
  const membership = await getAuthenticatedMembership(nextPath)
  if (membership.roles.includes("master")) {
    return membership
  }

  redirect("/clientes")
}

export async function requireAdminAccess(nextPath = "/settings") {
  const membership = await getAuthenticatedMembership(nextPath)
  if (membership.roles.includes("master") || membership.roles.includes("admin")) {
    return membership
  }

  redirect("/clientes")
}
