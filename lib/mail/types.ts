export const MAIL_OUTBOX_PROVIDERS = ["microsoft_graph"] as const
export const MAIL_OUTBOX_MODES = ["user_mailbox", "shared_mailbox"] as const
export const MAIL_DISPATCH_STATUSES = ["queued", "sending", "sent", "failed", "cancelled"] as const
export const MAIL_MODULES = ["billing", "crm"] as const

export const MAIL_MODULE_LABELS = {
  billing: "Facturación",
  crm: "CRM",
} as const

export type MailOutboxProvider = (typeof MAIL_OUTBOX_PROVIDERS)[number]
export type MailOutboxMode = (typeof MAIL_OUTBOX_MODES)[number]
export type MailDispatchStatus = (typeof MAIL_DISPATCH_STATUSES)[number]
export type MailModule = (typeof MAIL_MODULES)[number]

export type MailOutbox = {
  id: string
  provider: MailOutboxProvider
  email_address: string
  display_name: string | null
  mode: MailOutboxMode
  connection_user_id: string
  active: boolean
  is_default_for_billing: boolean
  last_error: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type MailDispatchJob = {
  id: string
  billing_document_id: string
  outbox_id: string
  idempotency_key: string
  recipient_to: string[]
  recipient_cc: string[]
  recipient_bcc: string[]
  subject: string
  body_html: string
  attachment_file_ids: string[]
  status: MailDispatchStatus
  attempts: number
  last_error: string | null
  provider_message_id: string | null
  sent_at: string | null
  cancelled_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type MailOutboxModuleSetting = {
  module: MailModule
  outbox_id: string
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type MicrosoftOutboxConnection = {
  user_id: string
  microsoft_email: string | null
  display_name: string | null
  status: "connected" | "reconnect_required"
  last_error: string | null
  connected_at: string | null
  updated_at: string
}
