"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireAppUser } from "@/lib/clients/data"
import type { PaymentMethod } from "@/lib/clients/types"
import { createClient } from "@/lib/supabase/server"

const PAYMENT_METHODS = new Set<PaymentMethod>(["unknown", "stripe", "sepa", "transfer", "other"])

function textValue(formData: FormData, key: string) {
  const value = formData.get(key)
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function requiredText(formData: FormData, key: string) {
  const value = textValue(formData, key)
  if (!value) {
    throw new Error(`Missing required field: ${key}`)
  }
  return value
}

function numberValue(formData: FormData, key: string) {
  const value = textValue(formData, key)
  if (!value) {
    return null
  }

  const normalized = value.replace(",", ".")
  const parsed = Number.parseFloat(normalized)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number field: ${key}`)
  }

  return parsed
}

function intValue(formData: FormData, key: string) {
  const value = numberValue(formData, key)
  return value === null ? null : Math.trunc(value)
}

function paymentMethodValue(formData: FormData): PaymentMethod {
  const value = textValue(formData, "payment_method") ?? "unknown"
  return PAYMENT_METHODS.has(value as PaymentMethod) ? (value as PaymentMethod) : "unknown"
}

function safeFileName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "documento"
}

function manualSharePointItemId() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000)
}

async function createCurrentManualHistoryEntry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  payload: {
    tax_id: string
    name: string
    address: string | null
    contact_name: string | null
    contact_phone: string | null
    contact_email: string | null
    billing_email: string | null
    start_date: string | null
    customer_rating: number | null
    active: boolean
    payment_method: PaymentMethod
    stripe_reference: string | null
    sepa_reference: string | null
    payment_notes: string | null
    comments: string | null
  },
  userId: string,
) {
  const now = new Date().toISOString()
  const sourceKey = `manual:${crypto.randomUUID()}`

  const { error: clearCurrentError } = await supabase
    .from("client_history_entries")
    .update({ is_current: false })
    .eq("client_id", clientId)
    .eq("is_current", true)

  if (clearCurrentError) {
    throw clearCurrentError
  }

  const { data, error } = await supabase
    .from("client_history_entries")
    .insert({
      client_id: clientId,
      tax_id: payload.tax_id,
      name: payload.name,
      address: payload.address,
      contact_name: payload.contact_name,
      contact_phone: payload.contact_phone,
      contact_email: payload.contact_email,
      billing_email: payload.billing_email,
      start_date: payload.start_date,
      customer_rating: payload.customer_rating,
      active: payload.active,
      active_label: payload.active ? "SI" : "NO",
      payment_method: payload.payment_method,
      stripe_reference: payload.stripe_reference,
      sepa_reference: payload.sepa_reference,
      payment_notes: payload.payment_notes,
      comments: payload.comments,
      current_line: "SI",
      source_kind: "manual",
      source_key: sourceKey,
      is_current: true,
      created_by: userId,
      source_created_at: now,
      source_modified_at: now,
      sharepoint_site_id: "manual",
      sharepoint_list_id: "clients",
      sharepoint_item_id: manualSharePointItemId(),
      sharepoint_unique_id: sourceKey,
      sharepoint_etag: null,
      raw: {
        source: "manual",
        client_id: clientId,
        payload,
      },
      imported_at: now,
    })
    .select("id")
    .single()

  if (error) {
    throw error
  }

  const historyEntry = data as { id: string }
  const { error: pointerError } = await supabase
    .from("clients")
    .update({ current_history_entry_id: historyEntry.id })
    .eq("id", clientId)

  if (pointerError) {
    throw pointerError
  }

  return historyEntry.id
}

async function getActionContext(nextPath: string) {
  const supabase = await createClient()
  const user = await requireAppUser(supabase, nextPath)
  return { supabase, userId: user.id }
}

export async function saveClientAction(formData: FormData) {
  const clientId = textValue(formData, "client_id")
  const { supabase, userId } = await getActionContext(clientId ? `/clientes/${clientId}/edit` : "/clientes/nuevo")

  const clientFields = {
    tax_id: requiredText(formData, "tax_id"),
    name: requiredText(formData, "name"),
    address: textValue(formData, "address"),
    contact_name: textValue(formData, "contact_name"),
    contact_phone: textValue(formData, "contact_phone"),
    contact_email: textValue(formData, "contact_email"),
    billing_email: textValue(formData, "billing_email"),
    start_date: textValue(formData, "start_date"),
    customer_rating: intValue(formData, "customer_rating"),
    active: formData.get("active") === "on",
    payment_method: paymentMethodValue(formData),
    stripe_reference: textValue(formData, "stripe_reference"),
    sepa_reference: textValue(formData, "sepa_reference"),
    payment_notes: textValue(formData, "payment_notes"),
    comments: textValue(formData, "comments"),
  }

  const payload = {
    ...clientFields,
    updated_by: userId,
  }

  if (clientId) {
    const { error } = await supabase.from("clients").update(payload).eq("id", clientId)

    if (error) {
      throw error
    }

    await createCurrentManualHistoryEntry(supabase, clientId, clientFields, userId)

    revalidatePath("/clientes")
    revalidatePath(`/clientes/${clientId}`)
    revalidatePath(`/clientes/${clientId}/edit`)
    redirect(`/clientes/${clientId}`)
  }

  const { data, error } = await supabase
    .from("clients")
    .insert({ ...payload, created_by: userId })
    .select("id")
    .single()

  if (error) {
    throw error
  }

  const created = data as { id: string }
  await createCurrentManualHistoryEntry(supabase, created.id, clientFields, userId)
  revalidatePath("/clientes")
  redirect(`/clientes/${created.id}`)
}

export async function deleteClientAction(formData: FormData) {
  const clientId = requiredText(formData, "client_id")
  const { supabase } = await getActionContext(`/clientes/${clientId}/edit`)

  const { error } = await supabase.from("clients").delete().eq("id", clientId)

  if (error) {
    throw error
  }

  revalidatePath("/clientes")
  redirect("/clientes")
}

export async function uploadClientDocumentAction(formData: FormData) {
  const clientId = requiredText(formData, "client_id")
  const rawFile = formData.get("file")

  if (!(rawFile instanceof File) || rawFile.size === 0) {
    throw new Error("Selecciona un archivo para subir.")
  }

  const { supabase, userId } = await getActionContext(`/clientes/${clientId}/edit`)
  const fileName = safeFileName(rawFile.name)
  const storagePath = `${clientId}/${Date.now()}-${crypto.randomUUID()}-${fileName}`
  const bucket = "client-documents"

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, rawFile, {
      cacheControl: "3600",
      contentType: rawFile.type || "application/octet-stream",
      upsert: false,
    })

  if (uploadError) {
    throw uploadError
  }

  const { error: insertError } = await supabase.from("client_documents").insert({
    client_id: clientId,
    file_name: rawFile.name,
    mime_type: rawFile.type || null,
    file_size: rawFile.size,
    storage_bucket: bucket,
    storage_path: storagePath,
    source_kind: "upload",
    uploaded_by: userId,
  })

  if (insertError) {
    await supabase.storage.from(bucket).remove([storagePath])
    throw insertError
  }

  revalidatePath(`/clientes/${clientId}`)
  revalidatePath(`/clientes/${clientId}/edit`)
  redirect(`/clientes/${clientId}/edit#documentos`)
}

export async function deleteClientDocumentAction(formData: FormData) {
  const clientId = requiredText(formData, "client_id")
  const documentId = requiredText(formData, "document_id")
  const { supabase } = await getActionContext(`/clientes/${clientId}`)

  const { data, error } = await supabase
    .from("client_documents")
    .select("storage_bucket, storage_path")
    .eq("client_id", clientId)
    .eq("id", documentId)
    .single()

  if (error) {
    throw error
  }

  const document = data as { storage_bucket: string; storage_path: string }
  const { error: removeError } = await supabase.storage.from(document.storage_bucket).remove([document.storage_path])
  if (removeError) {
    throw removeError
  }

  const { error: deleteError } = await supabase
    .from("client_documents")
    .delete()
    .eq("client_id", clientId)
    .eq("id", documentId)

  if (deleteError) {
    throw deleteError
  }

  revalidatePath(`/clientes/${clientId}`)
  revalidatePath(`/clientes/${clientId}/edit`)
  redirect(`/clientes/${clientId}/edit#documentos`)
}
