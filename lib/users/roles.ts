export const APP_ROLES = ["master", "admin", "usuario"] as const

export type AppRole = (typeof APP_ROLES)[number]

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  master: "Master",
  admin: "Admin",
  usuario: "Usuario",
}

export const USER_DEACTIVATION_BAN_DURATION = "876000h"

const USER_ACCESS_DISABLED_METADATA_FLAG = "skynet_access_disabled"
const USER_ACCESS_DISABLED_AT_METADATA_KEY = "skynet_access_disabled_at"
const USER_ACCESS_DISABLED_BY_METADATA_KEY = "skynet_access_disabled_by_user_id"

export type ManagedAuthStatusUser = {
  user_metadata?: unknown
  banned_until?: unknown
}

export function normalizeAppRole(value: unknown): AppRole | "" {
  const candidate = typeof value === "string" ? value.trim().toLowerCase() : ""
  return APP_ROLES.includes(candidate as AppRole) ? (candidate as AppRole) : ""
}

export function normalizeAppRoles(values: Iterable<unknown>): AppRole[] {
  const found = new Set<AppRole>()
  for (const value of values) {
    const role = normalizeAppRole(value)
    if (role) {
      found.add(role)
    }
  }
  return APP_ROLES.filter((role) => found.has(role))
}

export function derivePrimaryAppRole(values: Iterable<unknown>, fallback: AppRole = "usuario"): AppRole {
  const roles = normalizeAppRoles(values)
  return roles[0] ?? fallback
}

export function readAuthUserMetadata(user: ManagedAuthStatusUser) {
  return user.user_metadata && typeof user.user_metadata === "object"
    ? (user.user_metadata as Record<string, unknown>)
    : {}
}

export function rolesFromAuthMetadata(user: ManagedAuthStatusUser): AppRole[] {
  const metadata = readAuthUserMetadata(user)
  const metadataRoles = Array.isArray(metadata.roles)
    ? metadata.roles.map((role) => String(role).trim()).filter(Boolean)
    : []
  const singleRole = typeof metadata.role === "string" && metadata.role.trim() ? [metadata.role.trim()] : []
  const bootstrapRole = metadata.bootstrap_master === true ? ["master"] : []
  return normalizeAppRoles([...metadataRoles, ...singleRole, ...bootstrapRole])
}

function isTruthyMetadataFlag(value: unknown) {
  return value === true || (typeof value === "string" && value.trim().toLowerCase() === "true")
}

function hasActiveAuthBan(user: ManagedAuthStatusUser) {
  const bannedUntil = typeof user.banned_until === "string" ? user.banned_until.trim() : ""
  if (!bannedUntil || bannedUntil.toLowerCase() === "none") {
    return false
  }
  const timestamp = Date.parse(bannedUntil)
  return Number.isNaN(timestamp) || timestamp > Date.now()
}

export function isManagedUserDeactivated(user: ManagedAuthStatusUser) {
  const metadata = readAuthUserMetadata(user)
  return isTruthyMetadataFlag(metadata[USER_ACCESS_DISABLED_METADATA_FLAG]) || hasActiveAuthBan(user)
}

export function getManagedUserDeactivatedAt(user: ManagedAuthStatusUser) {
  const metadata = readAuthUserMetadata(user)
  const disabledAt = metadata[USER_ACCESS_DISABLED_AT_METADATA_KEY]
  return typeof disabledAt === "string" && disabledAt.trim() ? disabledAt.trim() : null
}

export function withManagedUserAccessState(
  metadata: Record<string, unknown>,
  state: { disabledAt: string | null; disabledByUserId: string | null },
) {
  return {
    ...metadata,
    [USER_ACCESS_DISABLED_METADATA_FLAG]: Boolean(state.disabledAt),
    [USER_ACCESS_DISABLED_AT_METADATA_KEY]: state.disabledAt,
    [USER_ACCESS_DISABLED_BY_METADATA_KEY]: state.disabledByUserId,
  }
}
