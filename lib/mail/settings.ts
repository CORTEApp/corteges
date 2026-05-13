import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import {
  MAIL_MODULES,
  MAIL_OUTBOX_MODES,
  type MailModule,
  type MailOutbox,
  type MailOutboxMode,
  type MailOutboxModuleSetting,
  type MicrosoftOutboxConnection,
} from "@/lib/mail/types"

type SupabaseAdminClient = ReturnType<typeof createAdminClient>

export type MailSettingsPageData = {
  outboxes: MailOutbox[]
  moduleSettings: MailOutboxModuleSetting[]
  microsoftConnections: MicrosoftOutboxConnection[]
}

export type UpsertMailOutboxInput = {
  id?: string | null
  emailAddress: string
  displayName?: string | null
  mode: MailOutboxMode
  connectionUserId: string
  active: boolean
  actorUserId?: string | null
}

export type SetModuleOutboxSettingsInput = {
  billingOutboxId?: string | null
  crmOutboxId?: string | null
}

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? ""
}

function nullableText(value: string | null | undefined) {
  const normalized = normalizeText(value)
  return normalized ? normalized : null
}

function assertMailMode(value: string): asserts value is MailOutboxMode {
  if (!MAIL_OUTBOX_MODES.includes(value as MailOutboxMode)) {
    throw new Error("Tipo de buzon Microsoft no valido.")
  }
}

function assertMailModule(value: string): asserts value is MailModule {
  if (!MAIL_MODULES.includes(value as MailModule)) {
    throw new Error("Modulo de correo no valido.")
  }
}

function databaseErrorMessage(error: { code?: string; message?: string }) {
  if (error.code === "23505") {
    return "Ya existe un buzon Microsoft con ese email."
  }

  if (error.message?.includes("Cannot deactivate an outbox assigned to a module")) {
    return "Quita este buzon de Facturacion/CRM antes de desactivarlo."
  }

  if (error.message?.includes("inactive outbox")) {
    return "El buzon seleccionado no esta activo."
  }

  return error.message || "No se pudo guardar la configuracion de correo."
}

export async function listMailOutboxes() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("mail_outboxes")
    .select("*")
    .eq("provider", "microsoft_graph")
    .order("active", { ascending: false })
    .order("email_address", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as MailOutbox[]
}

export async function listMicrosoftOutboxConnections() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("microsoft_user_connections")
    .select("user_id, microsoft_email, display_name, status, last_error, connected_at, updated_at")
    .order("display_name", { ascending: true, nullsFirst: false })
    .order("microsoft_email", { ascending: true, nullsFirst: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as MicrosoftOutboxConnection[]
}

export async function listModuleOutboxSettings() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("mail_outbox_module_settings")
    .select("*")
    .order("module", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as MailOutboxModuleSetting[]
}

export async function listMailSettingsPageData(): Promise<MailSettingsPageData> {
  const [outboxes, moduleSettings, microsoftConnections] = await Promise.all([
    listMailOutboxes(),
    listModuleOutboxSettings(),
    listMicrosoftOutboxConnections(),
  ])

  return {
    outboxes,
    moduleSettings,
    microsoftConnections,
  }
}

async function assertMicrosoftConnection(admin: SupabaseAdminClient, userId: string) {
  const { data, error } = await admin
    .from("microsoft_user_connections")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error("El usuario seleccionado no tiene Microsoft conectado en Mi perfil.")
  }
}

async function assertOutboxCanBeDeactivated(admin: SupabaseAdminClient, outboxId: string) {
  const { data, error } = await admin
    .from("mail_outbox_module_settings")
    .select("module")
    .eq("outbox_id", outboxId)
    .limit(1)

  if (error) {
    throw new Error(error.message)
  }

  if ((data ?? []).length > 0) {
    throw new Error("Quita este buzon de Facturacion/CRM antes de desactivarlo.")
  }
}

export async function upsertMailOutbox(input: UpsertMailOutboxInput) {
  const admin = createAdminClient()
  const emailAddress = normalizeText(input.emailAddress).toLowerCase()
  const displayName = nullableText(input.displayName)
  const connectionUserId = normalizeText(input.connectionUserId)
  const id = nullableText(input.id)

  if (!emailAddress) {
    throw new Error("El email del buzon es obligatorio.")
  }
  if (!emailAddress.includes("@")) {
    throw new Error("Introduce un email de buzon valido.")
  }
  if (!connectionUserId) {
    throw new Error("Selecciona el usuario que aporta la conexion delegada.")
  }

  assertMailMode(input.mode)
  await assertMicrosoftConnection(admin, connectionUserId)

  if (id && !input.active) {
    await assertOutboxCanBeDeactivated(admin, id)
  }

  const payload = {
    provider: "microsoft_graph",
    email_address: emailAddress,
    display_name: displayName,
    mode: input.mode,
    connection_user_id: connectionUserId,
    active: input.active,
    updated_by: input.actorUserId ?? null,
  }

  if (id) {
    const { data, error } = await admin
      .from("mail_outboxes")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single()

    if (error) {
      throw new Error(databaseErrorMessage(error))
    }

    return data as MailOutbox
  }

  const { data, error } = await admin
    .from("mail_outboxes")
    .insert({
      ...payload,
      created_by: input.actorUserId ?? null,
    })
    .select("*")
    .single()

  if (error) {
    throw new Error(databaseErrorMessage(error))
  }

  return data as MailOutbox
}

export async function setMailOutboxActive(outboxId: string, active: boolean, actorUserId?: string | null) {
  const admin = createAdminClient()
  const id = normalizeText(outboxId)

  if (!id) {
    throw new Error("Falta el buzon Microsoft.")
  }

  if (!active) {
    await assertOutboxCanBeDeactivated(admin, id)
  }

  const { data, error } = await admin
    .from("mail_outboxes")
    .update({
      active,
      updated_by: actorUserId ?? null,
    })
    .eq("id", id)
    .select("*")
    .single()

  if (error) {
    throw new Error(databaseErrorMessage(error))
  }

  return data as MailOutbox
}

export async function getModuleOutbox(module: MailModule) {
  assertMailModule(module)
  const admin = createAdminClient()
  const { data: setting, error: settingError } = await admin
    .from("mail_outbox_module_settings")
    .select("outbox_id")
    .eq("module", module)
    .maybeSingle()

  if (settingError) {
    throw new Error(settingError.message)
  }

  if (!setting?.outbox_id) {
    return null
  }

  const { data, error } = await admin
    .from("mail_outboxes")
    .select("*")
    .eq("id", setting.outbox_id)
    .eq("active", true)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? null) as MailOutbox | null
}

export async function setModuleOutbox(module: MailModule, outboxId: string | null, actorUserId?: string | null) {
  assertMailModule(module)
  const admin = createAdminClient()
  const normalizedOutboxId = nullableText(outboxId)

  if (!normalizedOutboxId) {
    const { error } = await admin
      .from("mail_outbox_module_settings")
      .delete()
      .eq("module", module)

    if (error) {
      throw new Error(error.message)
    }

    return null
  }

  const { data: outbox, error: outboxError } = await admin
    .from("mail_outboxes")
    .select("id, active")
    .eq("id", normalizedOutboxId)
    .maybeSingle()

  if (outboxError) {
    throw new Error(outboxError.message)
  }

  if (!outbox?.active) {
    throw new Error("El buzon seleccionado no esta activo.")
  }

  const { data, error } = await admin
    .from("mail_outbox_module_settings")
    .upsert(
      {
        module,
        outbox_id: normalizedOutboxId,
        updated_by: actorUserId ?? null,
        ...(!actorUserId ? {} : { created_by: actorUserId }),
      },
      { onConflict: "module" },
    )
    .select("*")
    .single()

  if (error) {
    throw new Error(databaseErrorMessage(error))
  }

  return data as MailOutboxModuleSetting
}

export async function setModuleOutboxSettings(input: SetModuleOutboxSettingsInput) {
  const supabase = await createClient()
  const { error } = await supabase.rpc("set_mail_outbox_module_settings", {
    p_billing_outbox_id: nullableText(input.billingOutboxId),
    p_crm_outbox_id: nullableText(input.crmOutboxId),
  })

  if (error) {
    throw new Error(databaseErrorMessage(error))
  }
}
