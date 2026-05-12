"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { createAdminClient } from "@/lib/supabase/admin"
import {
  USER_DEACTIVATION_BAN_DURATION,
  derivePrimaryAppRole,
  isManagedUserDeactivated,
  normalizeAppRoles,
  readAuthUserMetadata,
  withManagedUserAccessState,
  type AppRole,
  type ManagedAuthStatusUser,
} from "@/lib/users/roles"
import { getStoredUserRoles, requireMasterAccess } from "@/lib/users/server"

const AVAILABLE_ROLE_IDS = new Set(["master", "admin", "usuario"])

function stringValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function normalizeRoles(formData: FormData) {
  return normalizeAppRoles(
    formData
      .getAll("roles")
      .map((value) => (typeof value === "string" ? value : ""))
      .filter((value) => AVAILABLE_ROLE_IDS.has(value)),
  )
}

async function getManagedAuthUser(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const userResult = await admin.auth.admin.getUserById(userId)
  if (userResult.error || !userResult.data.user) {
    throw new Error(userResult.error?.message || "No se pudo cargar el usuario.")
  }
  return userResult.data.user as ManagedAuthStatusUser & {
    id: string
    email?: string | null
    created_at?: string | null
    last_sign_in_at?: string | null
  }
}

async function countActiveMasterUsers(admin: ReturnType<typeof createAdminClient>) {
  const masterRolesResult = await admin.from("app_user_roles").select("user_id").eq("role", "master")
  if (masterRolesResult.error) {
    throw new Error(masterRolesResult.error.message)
  }

  const masterUserIds = Array.from(
    new Set(((masterRolesResult.data ?? []) as Array<{ user_id: string }>).map((row) => row.user_id).filter(Boolean)),
  )
  if (!masterUserIds.length) {
    return 0
  }

  const authUsers = await Promise.all(
    masterUserIds.map(async (masterUserId) => {
      const authUserResult = await admin.auth.admin.getUserById(masterUserId)
      return authUserResult.data.user || null
    }),
  )

  return authUsers.filter((authUser) => authUser && !isManagedUserDeactivated(authUser as ManagedAuthStatusUser)).length
}

async function replaceUserRoles(admin: ReturnType<typeof createAdminClient>, userId: string, roles: AppRole[]) {
  const deleteResult = await admin.from("app_user_roles").delete().eq("user_id", userId)
  if (deleteResult.error) {
    throw new Error(deleteResult.error.message)
  }

  if (roles.length) {
    const insertResult = await admin.from("app_user_roles").insert(roles.map((role) => ({ user_id: userId, role })))
    if (insertResult.error) {
      throw new Error(insertResult.error.message)
    }
  }
}

export async function createManagedUser(formData: FormData) {
  await requireMasterAccess("/usuarios")
  const admin = createAdminClient()
  const email = stringValue(formData, "email").toLowerCase()
  const password = stringValue(formData, "password")
  const displayName = stringValue(formData, "display_name")
  const roles = normalizeRoles(formData)

  if (!email) {
    throw new Error("El email es obligatorio.")
  }
  if (password.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres.")
  }
  if (!roles.length) {
    throw new Error("Selecciona al menos un rol para el usuario.")
  }

  const primaryRole = derivePrimaryAppRole(roles)
  const createResult = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: withManagedUserAccessState(
      {
        display_name: displayName || email,
        role: primaryRole,
        roles,
        bootstrap_master: roles.includes("master"),
        preferred_language: "es",
        preferred_theme: "saas_atlas_blue_v2",
        color_mode: "system",
        text_size: "medium",
      },
      { disabledAt: null, disabledByUserId: null },
    ),
  })
  if (createResult.error || !createResult.data.user) {
    throw new Error(createResult.error?.message || "No se pudo crear el usuario.")
  }

  const userId = createResult.data.user.id
  const now = new Date().toISOString()
  const profileUpsert = await admin.from("user_profiles").upsert(
    {
      id: userId,
      email,
      display_name: displayName || email,
      role: primaryRole,
      preferred_language: "es",
      preferred_theme: "saas_atlas_blue_v2",
      color_mode: "system",
      text_size: "medium",
      created_at: now,
      updated_at: now,
    },
    { onConflict: "id" },
  )
  if (profileUpsert.error) {
    throw new Error(profileUpsert.error.message)
  }

  await replaceUserRoles(admin, userId, roles)

  revalidatePath("/usuarios")
  redirect(`/usuarios/${userId}`)
}

export async function updateManagedUserRoles(userId: string, formData: FormData) {
  const membership = await requireMasterAccess(`/usuarios/${userId}`)
  const admin = createAdminClient()
  const roles = normalizeRoles(formData)

  if (!userId) {
    throw new Error("Falta el identificador del usuario.")
  }
  if (!roles.length) {
    throw new Error("Selecciona al menos un rol para el usuario.")
  }
  if (userId === membership.user.id && !roles.includes("master")) {
    throw new Error("No puedes quitarte el rol Master a ti mismo.")
  }

  const authUser = await getManagedAuthUser(admin, userId)
  const currentRoles = await getStoredUserRoles(admin, userId, authUser)
  if (currentRoles.includes("master") && !roles.includes("master") && !isManagedUserDeactivated(authUser)) {
    const activeMasterCount = await countActiveMasterUsers(admin)
    if (activeMasterCount <= 1) {
      throw new Error("No puedes quitar el último Master activo.")
    }
  }

  const primaryRole = derivePrimaryAppRole(roles)
  await replaceUserRoles(admin, userId, roles)

  const profileUpdate = await admin
    .from("user_profiles")
    .update({ role: primaryRole, updated_at: new Date().toISOString() })
    .eq("id", userId)
  if (profileUpdate.error) {
    throw new Error(profileUpdate.error.message)
  }

  const metadata = readAuthUserMetadata(authUser)
  const updateUserResult = await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...metadata,
      role: primaryRole,
      roles,
      bootstrap_master: roles.includes("master"),
    },
  })
  if (updateUserResult.error) {
    throw new Error(updateUserResult.error.message)
  }

  revalidatePath("/usuarios")
  revalidatePath(`/usuarios/${userId}`)
  revalidatePath(`/usuarios/${userId}/edit`)
  redirect(`/usuarios/${userId}`)
}

export async function deactivateManagedUser(userId: string) {
  const membership = await requireMasterAccess("/usuarios")
  const admin = createAdminClient()
  const targetUserId = userId.trim()

  if (!targetUserId) {
    throw new Error("Falta el identificador del usuario.")
  }
  if (targetUserId === membership.user.id) {
    throw new Error("No puedes desactivar tu propio usuario.")
  }

  const authUser = await getManagedAuthUser(admin, targetUserId)
  const roles = await getStoredUserRoles(admin, targetUserId, authUser)
  if (roles.includes("master") && !isManagedUserDeactivated(authUser)) {
    const activeMasterCount = await countActiveMasterUsers(admin)
    if (activeMasterCount <= 1) {
      throw new Error("No puedes desactivar el último Master activo.")
    }
  }

  const now = new Date().toISOString()
  const metadata = readAuthUserMetadata(authUser)
  const authUpdateResult = await admin.auth.admin.updateUserById(targetUserId, {
    ban_duration: USER_DEACTIVATION_BAN_DURATION,
    user_metadata: withManagedUserAccessState(metadata, {
      disabledAt: now,
      disabledByUserId: membership.user.id,
    }),
  })
  if (authUpdateResult.error) {
    throw new Error(authUpdateResult.error.message)
  }

  revalidatePath("/usuarios")
  revalidatePath(`/usuarios/${targetUserId}`)
  revalidatePath(`/usuarios/${targetUserId}/edit`)
}

export async function reactivateManagedUser(userId: string) {
  await requireMasterAccess("/usuarios")
  const admin = createAdminClient()
  const targetUserId = userId.trim()

  if (!targetUserId) {
    throw new Error("Falta el identificador del usuario.")
  }

  const authUser = await getManagedAuthUser(admin, targetUserId)
  const metadata = readAuthUserMetadata(authUser)
  const authUpdateResult = await admin.auth.admin.updateUserById(targetUserId, {
    ban_duration: "none",
    user_metadata: withManagedUserAccessState(metadata, {
      disabledAt: null,
      disabledByUserId: null,
    }),
  })
  if (authUpdateResult.error) {
    throw new Error(authUpdateResult.error.message)
  }

  revalidatePath("/usuarios")
  revalidatePath(`/usuarios/${targetUserId}`)
  revalidatePath(`/usuarios/${targetUserId}/edit`)
}
