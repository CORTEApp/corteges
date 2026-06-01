"use server"

import { randomUUID } from "node:crypto"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireBillingUser } from "@/lib/billing/data"
import { enqueueBillingDocumentEmail, sendQueuedBillingEmail } from "@/lib/mail/billing"
import { createClient } from "@/lib/supabase/server"

function requiredText(formData: FormData, key: string) {
  const value = formData.get(key)
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Falta el campo obligatorio: ${key}`)
  }

  return value.trim()
}

function textValue(formData: FormData, key: string) {
  const value = formData.get(key)
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function dateValue(formData: FormData, key: string, fallback = new Date().toISOString().slice(0, 10)) {
  const value = textValue(formData, key)
  if (!value) {
    return fallback
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Fecha invalida: ${key}`)
  }

  return value
}

function invoiceIds(formData: FormData) {
  return formData
    .getAll("invoice_id")
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)
}

export async function regenerateInvoicePdfAction(formData: FormData) {
  const invoiceId = requiredText(formData, "invoice_id")
  const nextPath = `/facturacion/facturas/${invoiceId}`
  const supabase = await createClient()
  const user = await requireBillingUser(supabase, nextPath)

  const { data, error } = await supabase
    .from("billing_documents")
    .select("id")
    .eq("id", invoiceId)
    .eq("document_type", "invoice")
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error("Factura no encontrada.")
  }

  const { persistGeneratedBillingPdf } = await import("@/lib/billing/pdf-server")
  await persistGeneratedBillingPdf(invoiceId, "invoice", user.id)

  revalidatePath("/facturacion/facturas")
  revalidatePath(nextPath)
  redirect(nextPath)
}

export async function markSelectedInvoicesPaidAction(formData: FormData) {
  const ids = invoiceIds(formData)
  const paidDate = dateValue(formData, "paid_date")
  const supabase = await createClient()
  const user = await requireBillingUser(supabase, "/facturacion/facturas")

  if (!ids.length) {
    redirect("/facturacion/facturas?selected=0")
  }

  const { data, error } = await supabase
    .from("billing_documents")
    .update({
      status: "paid",
      payment_status: "paid",
      paid_date: paidDate,
      updated_by: user.id,
    })
    .in("id", ids)
    .eq("document_type", "invoice")
    .neq("payment_status", "paid")
    .neq("status", "cancelled")
    .neq("status", "discarded")
    .select("id")

  if (error) {
    throw error
  }

  revalidatePath("/facturacion/facturas")
  redirect(`/facturacion/facturas?paid=${data?.length ?? 0}`)
}

export async function resendInvoiceEmailAction(formData: FormData) {
  const invoiceId = requiredText(formData, "invoice_id")
  const nextPath = `/facturacion/facturas/${invoiceId}`
  const supabase = await createClient()
  const user = await requireBillingUser(supabase, nextPath)

  const { data, error } = await supabase
    .from("billing_documents")
    .select("id")
    .eq("id", invoiceId)
    .eq("document_type", "invoice")
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error("Factura no encontrada.")
  }

  const { persistGeneratedBillingPdf } = await import("@/lib/billing/pdf-server")
  await persistGeneratedBillingPdf(invoiceId, "invoice", user.id)
  const mailJob = await enqueueBillingDocumentEmail(invoiceId, null, {
    createdBy: user.id,
    idempotencyScope: `manual-resend:${randomUUID()}`,
  })
  await sendQueuedBillingEmail(mailJob.id)

  revalidatePath("/facturacion/facturas")
  revalidatePath(nextPath)
  redirect(nextPath)
}
