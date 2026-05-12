import { createAdminClient } from "@/lib/supabase/admin"
import {
  getManagedUserDeactivatedAt,
  isManagedUserDeactivated,
  normalizeAppRoles,
  readAuthUserMetadata,
  type AppRole,
  type ManagedAuthStatusUser,
} from "@/lib/users/roles"
import { getStoredUserRoles, requireMasterAccess, type AppMembership } from "@/lib/users/server"

type SupabaseAdminClient = ReturnType<typeof createAdminClient>

export type ManagedUserRecord = {
  id: string
  email: string
  displayName: string
  roles: AppRole[]
  isDeactivated: boolean
  deactivatedAt: string | null
  createdAt: string | null
  lastSignInAt: string | null
  disabledReason: string
}

async function countActiveMasterUsers(admin: SupabaseAdminClient) {
  const masterRolesResult = await admin.from("app_user_roles").select("user_id").eq("role", "master")
  if (masterRolesResult.error) {
    throw new Error(masterRolesResult.error.message)
  }

  const masterUserIds = Array.from(
    new Set(((masterRolesResult.data ?? []) as Array<{ user_id: string }>).map((row) => row.user_id).filter(Boolean)),
  )

  const users = await Promise.all(
    masterUserIds.map(async (masterUserId) => {
      const result = await admin.auth.admin.getUserById(masterUserId)
      return result.data.user || null
    }),
  )

  return users.filter((user) => user && !isManagedUserDeactivated(user as ManagedAuthStatusUser)).length
}

function displayNameForUser(user: ManagedAuthStatusUser & { email?: string | null }) {
  const metadata = readAuthUserMetadata(user)
  return typeof metadata.display_name === "string" && metadata.display_name.trim()
    ? metadata.display_name
    : user.email || "Sin nombre"
}

function disabledReasonForUser({
  userId,
  roles,
  isDeactivated,
  currentUserId,
  activeMasterCount,
}: {
  userId: string
  roles: AppRole[]
  isDeactivated: boolean
  currentUserId: string
  activeMasterCount: number
}) {
  if (userId === currentUserId) {
    return "No puedes desactivar tu propio usuario."
  }
  if (roles.includes("master") && !isDeactivated && activeMasterCount <= 1) {
    return "No puedes desactivar el último Master activo."
  }
  return ""
}

export async function loadManagedUsers(nextPath = "/usuarios"): Promise<{
  membership: AppMembership
  users: ManagedUserRecord[]
}> {
  const membership = await requireMasterAccess(nextPath)
  const admin = createAdminClient()
  const usersResult = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (usersResult.error) {
    throw new Error(usersResult.error.message)
  }

  const rolesResult = await admin.from("app_user_roles").select("user_id, role").order("created_at", { ascending: true })
  if (rolesResult.error) {
    throw new Error(rolesResult.error.message)
  }

  const rolesByUserId = new Map<string, AppRole[]>()
  for (const row of (rolesResult.data ?? []) as Array<{ user_id: string; role: string }>) {
    const current = rolesByUserId.get(row.user_id) ?? []
    rolesByUserId.set(row.user_id, normalizeAppRoles([...current, row.role]))
  }

  const authUsers = (usersResult.data.users ?? []) as Array<ManagedAuthStatusUser & {
    id: string
    email?: string | null
    created_at?: string | null
    last_sign_in_at?: string | null
  }>
  const activeMasterUserIds = new Set(
    authUsers
      .filter((user) => (rolesByUserId.get(user.id) ?? []).includes("master") && !isManagedUserDeactivated(user))
      .map((user) => user.id),
  )
  const activeMasterCount = activeMasterUserIds.size

  return {
    membership,
    users: authUsers.map((user) => {
      const roles = rolesByUserId.get(user.id) ?? []
      const isDeactivated = isManagedUserDeactivated(user)
      return {
        id: user.id,
        email: user.email || "Sin email",
        displayName: displayNameForUser(user),
        roles,
        isDeactivated,
        deactivatedAt: getManagedUserDeactivatedAt(user),
        createdAt: user.created_at ?? null,
        lastSignInAt: user.last_sign_in_at ?? null,
        disabledReason: disabledReasonForUser({
          userId: user.id,
          roles,
          isDeactivated,
          currentUserId: membership.user.id,
          activeMasterCount,
        }),
      }
    }),
  }
}

export async function loadManagedUser(userId: string, nextPath = `/usuarios/${userId}`): Promise<{
  membership: AppMembership
  user: ManagedUserRecord | null
}> {
  const membership = await requireMasterAccess(nextPath)
  const admin = createAdminClient()
  const userResult = await admin.auth.admin.getUserById(userId)
  if (userResult.error) {
    throw new Error(userResult.error.message)
  }

  const authUser = userResult.data.user as (ManagedAuthStatusUser & {
    id: string
    email?: string | null
    created_at?: string | null
    last_sign_in_at?: string | null
  }) | null

  if (!authUser) {
    return { membership, user: null }
  }

  const roles = await getStoredUserRoles(admin, userId, authUser)
  const isDeactivated = isManagedUserDeactivated(authUser)
  const activeMasterCount = roles.includes("master") && !isDeactivated ? await countActiveMasterUsers(admin) : 0

  return {
    membership,
    user: {
      id: authUser.id,
      email: authUser.email || "Sin email",
      displayName: displayNameForUser(authUser),
      roles,
      isDeactivated,
      deactivatedAt: getManagedUserDeactivatedAt(authUser),
      createdAt: authUser.created_at ?? null,
      lastSignInAt: authUser.last_sign_in_at ?? null,
      disabledReason: disabledReasonForUser({
        userId,
        roles,
        isDeactivated,
        currentUserId: membership.user.id,
        activeMasterCount,
      }),
    },
  }
}
