"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireBillingUser } from "@/lib/billing/data"
import { createClient } from "@/lib/supabase/server"

function requiredText(formData: FormData, key: string) {
  const value = formData.get(key)
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Falta el campo obligatorio: ${key}`)
  }

  return value.trim()
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
