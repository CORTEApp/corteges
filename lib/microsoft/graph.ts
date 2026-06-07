import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto"

import { createAdminClient } from "@/lib/supabase/admin"
import type { MicrosoftConnectionStatus } from "@/lib/crm/types"

const DEFAULT_GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"
const DEFAULT_TIME_ZONE = "Romance Standard Time"
const DEFAULT_REDIRECT_PATH = "/integraciones/microsoft/callback"
const TOKEN_PREFIX = "v1"

export const MICROSOFT_GRAPH_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
  "Calendars.ReadWrite",
  "Mail.Read",
  "Mail.Read.Shared",
  "Mail.Send",
  "Mail.Send.Shared",
]

const MICROSOFT_GRAPH_MAIL_SCOPE_REQUIREMENTS = [
  { scope: "Mail.Read", grants: ["Mail.Read", "Mail.ReadWrite"] },
  { scope: "Mail.Read.Shared", grants: ["Mail.Read.Shared", "Mail.ReadWrite.Shared"] },
  { scope: "Mail.Send", grants: ["Mail.Send"] },
  { scope: "Mail.Send.Shared", grants: ["Mail.Send.Shared"] },
] as const

type MicrosoftTokenPayload = {
  access_token: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
}

type MicrosoftProfile = {
  id: string
  displayName?: string | null
  mail?: string | null
  userPrincipalName?: string | null
}

type MicrosoftConnectionRow = {
  user_id: string
  microsoft_user_id: string | null
  microsoft_email: string | null
  display_name: string | null
  tenant_id: string | null
  scopes: string[] | null
  status: "connected" | "reconnect_required"
  refresh_token_encrypted: string
  last_error: string | null
}

export type MicrosoftCalendarEvent = {
  id: string
  subject: string
  startsAt: string
  endsAt: string | null
  webLink: string | null
  joinUrl: string | null
}

export type CreatedTeamsEvent = MicrosoftCalendarEvent & {
  iCalUId: string | null
  raw: unknown
}

export type TeamsEventAttendee = {
  email: string
  name?: string | null
}

export type CreateTeamsCalendarEventInput = {
  subject: string
  bodyHtml: string
  startLocal: string
  endLocal: string
  attendees: TeamsEventAttendee[]
}

export type MicrosoftMailRecipient = {
  email: string
  name?: string | null
}

export type MicrosoftMailAttachment = {
  name: string
  contentType: string
  contentBytes: string
}

export type SendMicrosoftMailInput = {
  mailboxEmail?: string | null
  subject: string
  bodyHtml: string
  to: MicrosoftMailRecipient[]
  cc?: MicrosoftMailRecipient[]
  bcc?: MicrosoftMailRecipient[]
  attachments?: MicrosoftMailAttachment[]
  saveToSentItems?: boolean
}

export type MicrosoftMailPdfAttachment = {
  mailboxEmail: string | null
  messageId: string
  attachmentId: string
  subject: string | null
  receivedDateTime: string | null
  senderEmail: string | null
  senderName: string | null
  name: string
  contentType: string
  size: number
  contentBytes: string
}

type GraphCollection<T> = {
  value?: T[]
}

type GraphMailMessage = {
  id?: string
  subject?: string | null
  receivedDateTime?: string | null
  hasAttachments?: boolean | null
  from?: {
    emailAddress?: {
      address?: string | null
      name?: string | null
    } | null
  } | null
}

type GraphFileAttachment = {
  id?: string
  name?: string | null
  contentType?: string | null
  size?: number | null
  isInline?: boolean | null
  contentBytes?: string | null
}

function envValue(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]
    if (value?.trim()) {
      return value.trim()
    }
  }
  return ""
}

export function getMicrosoftGraphConfig(origin?: string) {
  const redirectPath = envValue("MICROSOFT_GRAPH_REDIRECT_PATH") || DEFAULT_REDIRECT_PATH
  const redirectBaseUrl = envValue("MICROSOFT_GRAPH_REDIRECT_BASE_URL")
  const baseUrl = redirectBaseUrl || origin || ""
  const normalizedBase = baseUrl.replace(/\/$/, "")

  return {
    tenantId: envValue("MICROSOFT_GRAPH_TENANT_ID", "M365_TENANT_ID", "ENTRAID_TENANT_ID") || "organizations",
    clientId: envValue("MICROSOFT_GRAPH_CLIENT_ID", "M365_CLIENT_ID", "ENTRAID_CLIENT_ID"),
    clientSecret: envValue("MICROSOFT_GRAPH_CLIENT_SECRET", "M365_CLIENT_SECRET"),
    graphBaseUrl: envValue("MICROSOFT_GRAPH_BASE_URL") || DEFAULT_GRAPH_BASE_URL,
    redirectPath,
    redirectUri: normalizedBase ? `${normalizedBase}${redirectPath}` : "",
    timeZone: envValue("MICROSOFT_GRAPH_TIME_ZONE") || DEFAULT_TIME_ZONE,
    tokenSecret: envValue("MICROSOFT_GRAPH_TOKEN_ENCRYPTION_KEY", "MICROSOFT_GRAPH_TOKEN_KEY"),
  }
}

function assertConfigured(origin?: string, requireRedirect = false) {
  const config = getMicrosoftGraphConfig(origin)
  const missing = [
    ["MICROSOFT_GRAPH_CLIENT_ID", config.clientId],
    ["MICROSOFT_GRAPH_CLIENT_SECRET", config.clientSecret],
    ["MICROSOFT_GRAPH_TOKEN_ENCRYPTION_KEY", config.tokenSecret],
    ...(requireRedirect ? [["MICROSOFT_GRAPH_REDIRECT_BASE_URL or request origin", config.redirectUri]] : []),
  ].filter(([, value]) => !value)

  if (missing.length) {
    throw new Error(`Microsoft Graph no esta configurado: falta ${missing.map(([key]) => key).join(", ")}.`)
  }

  return config
}

export function isMicrosoftGraphConfigured() {
  const config = getMicrosoftGraphConfig()
  return Boolean(config.clientId && config.clientSecret && config.tokenSecret)
}

function encryptionKey() {
  const secret = getMicrosoftGraphConfig().tokenSecret
  if (!secret) {
    throw new Error("Missing MICROSOFT_GRAPH_TOKEN_ENCRYPTION_KEY.")
  }
  return createHash("sha256").update(secret).digest()
}

function encryptRefreshToken(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    TOKEN_PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":")
}

function decryptRefreshToken(value: string) {
  const [version, ivText, tagText, encryptedText] = value.split(":")
  if (version !== TOKEN_PREFIX || !ivText || !tagText || !encryptedText) {
    throw new Error("Microsoft refresh token guardado con formato no soportado.")
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"))
  decipher.setAuthTag(Buffer.from(tagText, "base64url"))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final(),
  ]).toString("utf8")
}

function scopesText() {
  return MICROSOFT_GRAPH_SCOPES.join(" ")
}

async function requestToken(body: URLSearchParams, origin?: string): Promise<MicrosoftTokenPayload> {
  const config = assertConfigured(origin, Boolean(origin))
  const response = await fetch(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })

  if (!response.ok) {
    throw new Error(`Microsoft token request failed ${response.status}: ${await response.text()}`)
  }

  return response.json() as Promise<MicrosoftTokenPayload>
}

function graphErrorMessage(status: number, text: string) {
  let detail = text.trim()

  if (detail) {
    try {
      const parsed = JSON.parse(detail) as { error?: { code?: string; message?: string } }
      detail = [parsed.error?.code, parsed.error?.message].filter(Boolean).join(": ") || detail
    } catch {
      // Keep sanitized raw text when Graph does not return JSON.
    }
  }

  detail = detail.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]").slice(0, 500)
  return detail ? `Microsoft Graph request failed ${status}: ${detail}` : `Microsoft Graph request failed ${status}`
}

async function graphFetch<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const config = getMicrosoftGraphConfig()
  const response = await fetch(`${config.graphBaseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    throw new Error(graphErrorMessage(response.status, await response.text()))
  }

  const text = await response.text()
  if (!text) {
    return undefined as T
  }

  return JSON.parse(text) as T
}

function missingMailScopes(scopes: string[] | null | undefined) {
  const granted = new Set((scopes ?? []).map((scope) => scope.toLowerCase()))
  return MICROSOFT_GRAPH_MAIL_SCOPE_REQUIREMENTS
    .filter((requirement) => !requirement.grants.some((scope) => granted.has(scope.toLowerCase())))
    .map((requirement) => requirement.scope)
}

function reconnectForMailScopesMessage(missing: readonly string[]) {
  return `Reconecta Microsoft para conceder permisos de correo: ${missing.join(", ")}.`
}

export function buildMicrosoftAuthorizationUrl(origin: string, state: string) {
  const config = assertConfigured(origin, true)
  const url = new URL(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize`)
  url.searchParams.set("client_id", config.clientId)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("redirect_uri", config.redirectUri)
  url.searchParams.set("response_mode", "query")
  url.searchParams.set("scope", scopesText())
  url.searchParams.set("state", state)
  url.searchParams.set("prompt", "select_account")
  return url
}

export async function exchangeMicrosoftAuthorizationCode(code: string, origin: string) {
  const config = assertConfigured(origin, true)
  return requestToken(
    new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
      scope: scopesText(),
    }),
    origin,
  )
}

export async function readMicrosoftProfile(accessToken: string) {
  return graphFetch<MicrosoftProfile>(
    accessToken,
    "/me?$select=id,displayName,mail,userPrincipalName",
  )
}

export async function saveMicrosoftConnection(
  userId: string,
  tokenPayload: MicrosoftTokenPayload,
  profile: MicrosoftProfile,
) {
  if (!tokenPayload.refresh_token) {
    throw new Error("Microsoft no devolvio refresh_token. Revisa el scope offline_access.")
  }

  const admin = createAdminClient()
  const config = getMicrosoftGraphConfig()
  const { error } = await admin.from("microsoft_user_connections").upsert(
    {
      user_id: userId,
      microsoft_user_id: profile.id,
      microsoft_email: profile.mail ?? profile.userPrincipalName ?? null,
      display_name: profile.displayName ?? null,
      tenant_id: config.tenantId,
      scopes: (tokenPayload.scope ?? scopesText()).split(/\s+/).filter(Boolean),
      status: "connected",
      refresh_token_encrypted: encryptRefreshToken(tokenPayload.refresh_token),
      last_error: null,
      connected_at: new Date().toISOString(),
      last_refreshed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  )

  if (error) {
    throw new Error(error.message)
  }
}

export async function disconnectMicrosoftConnection(userId: string) {
  const admin = createAdminClient()
  const { error } = await admin
    .from("microsoft_user_connections")
    .delete()
    .eq("user_id", userId)

  if (error) {
    throw new Error(error.message)
  }
}

async function getConnection(userId: string): Promise<MicrosoftConnectionRow | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("microsoft_user_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data as MicrosoftConnectionRow | null
}

export async function getMicrosoftConnectionStatus(userId: string): Promise<MicrosoftConnectionStatus> {
  if (!isMicrosoftGraphConfigured()) {
    return {
      configured: false,
      connected: false,
      requiresReconnect: false,
      email: null,
      displayName: null,
      lastError: "Microsoft Graph no esta configurado en el entorno.",
    }
  }

  const connection = await getConnection(userId)
  const missing = missingMailScopes(connection?.scopes)
  if (connection?.status === "connected" && missing.length > 0) {
    const message = reconnectForMailScopesMessage(missing)
    await markReconnectRequired(userId, message)
    return {
      configured: true,
      connected: false,
      requiresReconnect: true,
      email: connection.microsoft_email ?? null,
      displayName: connection.display_name ?? null,
      lastError: message,
    }
  }

  return {
    configured: true,
    connected: connection?.status === "connected",
    requiresReconnect: connection?.status === "reconnect_required",
    email: connection?.microsoft_email ?? null,
    displayName: connection?.display_name ?? null,
    lastError: connection?.last_error ?? null,
  }
}

async function markReconnectRequired(userId: string, message: string) {
  const admin = createAdminClient()
  await admin
    .from("microsoft_user_connections")
    .update({
      status: "reconnect_required",
      last_error: message,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
}

export async function getMicrosoftAccessTokenForUser(userId: string) {
  const connection = await getConnection(userId)
  if (!connection || connection.status !== "connected") {
    throw new Error("Conecta Microsoft antes de usar esta integracion.")
  }

  const missing = missingMailScopes(connection.scopes)
  if (missing.length > 0) {
    const message = reconnectForMailScopesMessage(missing)
    await markReconnectRequired(userId, message)
    throw new Error(message)
  }

  try {
    const config = assertConfigured()
    const token = await requestToken(
      new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "refresh_token",
        refresh_token: decryptRefreshToken(connection.refresh_token_encrypted),
      }),
    )

    const admin = createAdminClient()
    await admin
      .from("microsoft_user_connections")
      .update({
        ...(token.refresh_token ? { refresh_token_encrypted: encryptRefreshToken(token.refresh_token) } : {}),
        scopes: (token.scope ?? connection.scopes?.join(" ") ?? scopesText()).split(/\s+/).filter(Boolean),
        status: "connected",
        last_error: null,
        last_refreshed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)

    return token.access_token
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo refrescar Microsoft."
    await markReconnectRequired(userId, message)
    throw error
  }
}

function eventDateTimeToIso(value: unknown) {
  if (!value || typeof value !== "object") {
    return null
  }
  const dateTime = "dateTime" in value ? String(value.dateTime ?? "") : ""
  if (!dateTime) {
    return null
  }
  const date = new Date(dateTime)
  return Number.isNaN(date.valueOf()) ? null : date.toISOString()
}

function graphEventToCalendarEvent(event: Record<string, unknown>): MicrosoftCalendarEvent {
  const onlineMeeting = event.onlineMeeting && typeof event.onlineMeeting === "object"
    ? (event.onlineMeeting as Record<string, unknown>)
    : {}

  return {
    id: String(event.id ?? ""),
    subject: String(event.subject ?? "Evento"),
    startsAt: eventDateTimeToIso(event.start) ?? new Date().toISOString(),
    endsAt: eventDateTimeToIso(event.end),
    webLink: typeof event.webLink === "string" ? event.webLink : null,
    joinUrl: typeof onlineMeeting.joinUrl === "string" ? onlineMeeting.joinUrl : null,
  }
}

export async function listMicrosoftCalendarView(userId: string, start: Date, end: Date) {
  const accessToken = await getMicrosoftAccessTokenForUser(userId)
  const config = getMicrosoftGraphConfig()
  const url = new URL(`${config.graphBaseUrl.replace(/\/$/, "")}/me/calendarView`)
  url.searchParams.set("startDateTime", start.toISOString())
  url.searchParams.set("endDateTime", end.toISOString())
  url.searchParams.set("$select", "id,subject,start,end,webLink,onlineMeeting,isOnlineMeeting")
  url.searchParams.set("$orderby", "start/dateTime")

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      Prefer: `outlook.timezone="${config.timeZone}"`,
    },
  })

  if (!response.ok) {
    throw new Error(`Microsoft calendarView failed ${response.status}: ${await response.text()}`)
  }

  const payload = (await response.json()) as { value?: Array<Record<string, unknown>> }
  return (payload.value ?? []).map(graphEventToCalendarEvent).filter((event) => event.id)
}

export async function createTeamsCalendarEvent(userId: string, input: CreateTeamsCalendarEventInput): Promise<CreatedTeamsEvent> {
  const accessToken = await getMicrosoftAccessTokenForUser(userId)
  const config = getMicrosoftGraphConfig()
  const payload = {
    subject: input.subject,
    body: {
      contentType: "HTML",
      content: input.bodyHtml,
    },
    start: {
      dateTime: input.startLocal,
      timeZone: config.timeZone,
    },
    end: {
      dateTime: input.endLocal,
      timeZone: config.timeZone,
    },
    attendees: input.attendees.map((attendee) => ({
      emailAddress: {
        address: attendee.email,
        name: attendee.name ?? attendee.email,
      },
      type: "required",
    })),
    allowNewTimeProposals: true,
    isOnlineMeeting: true,
    onlineMeetingProvider: "teamsForBusiness",
    transactionId: randomUUID(),
  }

  const event = await graphFetch<Record<string, unknown>>(accessToken, "/me/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: `outlook.timezone="${config.timeZone}"`,
    },
    body: JSON.stringify(payload),
  })

  const mapped = graphEventToCalendarEvent(event)
  return {
    ...mapped,
    iCalUId: typeof event.iCalUId === "string" ? event.iCalUId : null,
    raw: event,
  }
}

function mailboxBasePath(mailboxEmail?: string | null) {
  const mailbox = mailboxEmail?.trim()
  return mailbox ? `/users/${encodeURIComponent(mailbox)}` : "/me"
}

function isPdfAttachment(attachment: GraphFileAttachment) {
  const name = attachment.name?.toLowerCase() ?? ""
  const contentType = attachment.contentType?.toLowerCase() ?? ""
  return !attachment.isInline && (name.endsWith(".pdf") || contentType.includes("pdf"))
}

function graphMailMessageParams(top: number, filterAttachments: boolean) {
  const params = new URLSearchParams({
    "$top": String(top),
    "$select": "id,subject,from,receivedDateTime,hasAttachments",
    "$orderby": "receivedDateTime desc",
  })

  if (filterAttachments) {
    // Graph requires ordered message fields to appear first in $filter.
    params.set("$filter", "receivedDateTime ge 1900-01-01T00:00:00Z and hasAttachments eq true")
  }

  return params
}

function isGraphInefficientFilterError(error: unknown) {
  return error instanceof Error && error.message.includes("InefficientFilter")
}

async function listRecentInboxMessages(
  accessToken: string,
  basePath: string,
  top: number,
): Promise<GraphCollection<GraphMailMessage>> {
  const filteredParams = graphMailMessageParams(top, true)

  try {
    return await graphFetch<GraphCollection<GraphMailMessage>>(
      accessToken,
      `${basePath}/mailFolders/inbox/messages?${filteredParams.toString()}`,
    )
  } catch (error) {
    if (!isGraphInefficientFilterError(error)) {
      throw error
    }

    const fallbackParams = graphMailMessageParams(Math.min(top * 2, 50), false)
    return graphFetch<GraphCollection<GraphMailMessage>>(
      accessToken,
      `${basePath}/mailFolders/inbox/messages?${fallbackParams.toString()}`,
    )
  }
}

export async function listMicrosoftPdfMailAttachmentsForUser(
  userId: string,
  input: { mailboxEmail?: string | null; maxMessages?: number } = {},
): Promise<MicrosoftMailPdfAttachment[]> {
  const accessToken = await getMicrosoftAccessTokenForUser(userId)
  const top = Math.min(Math.max(input.maxMessages ?? 25, 1), 50)
  const basePath = mailboxBasePath(input.mailboxEmail)
  const messages = await listRecentInboxMessages(accessToken, basePath, top)
  const results: MicrosoftMailPdfAttachment[] = []

  for (const message of messages.value ?? []) {
    if (!message.id || message.hasAttachments === false) {
      continue
    }

    const attachmentParams = new URLSearchParams({
      "$select": "id,name,contentType,size,isInline",
    })
    const attachments = await graphFetch<GraphCollection<GraphFileAttachment>>(
      accessToken,
      `${basePath}/messages/${encodeURIComponent(message.id)}/attachments?${attachmentParams.toString()}`,
    )

    for (const attachment of attachments.value ?? []) {
      if (!attachment.id || !isPdfAttachment(attachment)) {
        continue
      }

      const fileAttachment = attachment.contentBytes
        ? attachment
        : await graphFetch<GraphFileAttachment>(
            accessToken,
            `${basePath}/messages/${encodeURIComponent(message.id)}/attachments/${encodeURIComponent(attachment.id)}`,
          )

      if (!fileAttachment.contentBytes) {
        continue
      }

      results.push({
        mailboxEmail: input.mailboxEmail?.trim() || null,
        messageId: message.id,
        attachmentId: fileAttachment.id ?? attachment.id,
        subject: message.subject ?? null,
        receivedDateTime: message.receivedDateTime ?? null,
        senderEmail: message.from?.emailAddress?.address ?? null,
        senderName: message.from?.emailAddress?.name ?? null,
        name: fileAttachment.name ?? attachment.name ?? "factura.pdf",
        contentType: fileAttachment.contentType ?? attachment.contentType ?? "application/pdf",
        size: fileAttachment.size ?? attachment.size ?? 0,
        contentBytes: fileAttachment.contentBytes,
      })
    }
  }

  return results
}

function mailRecipient(recipient: MicrosoftMailRecipient) {
  return {
    emailAddress: {
      address: recipient.email,
      name: recipient.name ?? recipient.email,
    },
  }
}

export async function sendMicrosoftMailForUser(userId: string, input: SendMicrosoftMailInput) {
  if (input.to.length === 0) {
    throw new Error("El email necesita al menos un destinatario.")
  }

  const accessToken = await getMicrosoftAccessTokenForUser(userId)
  const mailboxEmail = input.mailboxEmail?.trim()
  const endpoint = mailboxEmail ? `/users/${encodeURIComponent(mailboxEmail)}/sendMail` : "/me/sendMail"
  const message = {
    subject: input.subject,
    body: {
      contentType: "HTML",
      content: input.bodyHtml,
    },
    toRecipients: input.to.map(mailRecipient),
    ccRecipients: (input.cc ?? []).map(mailRecipient),
    bccRecipients: (input.bcc ?? []).map(mailRecipient),
    attachments: (input.attachments ?? []).map((attachment) => ({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: attachment.name,
      contentType: attachment.contentType,
      contentBytes: attachment.contentBytes,
    })),
  }

  await graphFetch<void>(accessToken, endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      saveToSentItems: input.saveToSentItems ?? true,
    }),
  })
}
