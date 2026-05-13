"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import {
  setMailOutboxActive,
  setModuleOutboxSettings,
  testMailOutbox,
  upsertMailOutbox,
} from "@/lib/mail/settings"
import { type MailOutboxMode } from "@/lib/mail/types"
import { upsertFiscalTaxSettings, type FiscalIrpfBracket } from "@/lib/statistics/fiscal"
import { requireAdminAccess } from "@/lib/users/server"

function stringValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function checkboxValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return value === "on" || value === "true" || value === "1"
}

function numberValue(value: FormDataEntryValue | null, label: string) {
  const raw = typeof value === "string" ? value.trim().replace(",", ".") : ""
  const parsed = Number.parseFloat(raw)
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} no es valido.`)
  }

  return parsed
}

function optionalNumberValue(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim().replace(",", ".") : ""
  if (!raw) {
    return null
  }

  const parsed = Number.parseFloat(raw)
  if (!Number.isFinite(parsed)) {
    throw new Error("Un limite IRPF no es valido.")
  }

  return parsed
}

function fiscalBracketsFromForm(formData: FormData): FiscalIrpfBracket[] {
  const limits = formData.getAll("bracket_up_to")
  const rates = formData.getAll("bracket_rate")

  return rates.map((rateValue, index) => ({
    upTo: optionalNumberValue(limits[index] ?? null),
    rate: numberValue(rateValue, "Un tipo IRPF"),
  }))
}

function redirectUrlWithParams(params: Record<string, string>) {
  const search = new URLSearchParams(params)
  return `/settings?${search.toString()}`
}

export async function saveMailOutboxAction(formData: FormData) {
  const membership = await requireAdminAccess("/settings")
  await upsertMailOutbox({
    id: stringValue(formData, "outbox_id") || null,
    emailAddress: stringValue(formData, "email_address"),
    displayName: stringValue(formData, "display_name") || null,
    mode: stringValue(formData, "mode") as MailOutboxMode,
    connectionUserId: stringValue(formData, "connection_user_id"),
    active: checkboxValue(formData, "active"),
    actorUserId: membership.user.id,
  })

  revalidatePath("/settings")
  redirect("/settings?saved=outbox")
}

export async function deactivateMailOutboxAction(formData: FormData) {
  const membership = await requireAdminAccess("/settings")
  await setMailOutboxActive(stringValue(formData, "outbox_id"), false, membership.user.id)

  revalidatePath("/settings")
  redirect("/settings?saved=outbox")
}

export async function testMailOutboxAction(formData: FormData) {
  const membership = await requireAdminAccess("/settings")
  let redirectTo = "/settings"

  try {
    const result = await testMailOutbox(stringValue(formData, "outbox_id"), membership.user.id)
    redirectTo = redirectUrlWithParams({
      test: "sent",
      outbox: result.outbox.email_address,
      to: result.recipientEmail,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo probar el buzon."
    redirectTo = redirectUrlWithParams({
      test: "failed",
      message: message.slice(0, 240),
    })
  }

  revalidatePath("/settings")
  redirect(redirectTo)
}

export async function saveModuleOutboxSettingsAction(formData: FormData) {
  await requireAdminAccess("/settings")
  await setModuleOutboxSettings({
    billingOutboxId: stringValue(formData, "billing_outbox_id") || null,
    crmOutboxId: stringValue(formData, "crm_outbox_id") || null,
    expenseInvoiceIntakeOutboxId: stringValue(formData, "expense_invoice_intake_outbox_id") || null,
  })

  revalidatePath("/settings")
  redirect("/settings?saved=modules")
}

export async function saveFiscalTaxSettingsAction(formData: FormData) {
  const membership = await requireAdminAccess("/settings")
  await upsertFiscalTaxSettings({
    taxYear: Math.trunc(numberValue(formData.get("tax_year"), "El año fiscal")),
    profileLabel: stringValue(formData, "profile_label"),
    sourceNote: stringValue(formData, "source_note") || null,
    irpfBrackets: fiscalBracketsFromForm(formData),
    actorUserId: membership.user.id,
  })

  revalidatePath("/settings")
  revalidatePath("/estadisticas/facturacion")
  redirect("/settings?saved=fiscal#fiscalidad")
}
