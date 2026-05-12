"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { requireSupplierUser } from "@/lib/suppliers/data"
import type { SupplierPaymentMethod } from "@/lib/suppliers/types"

const PAYMENT_METHODS = new Set<SupplierPaymentMethod>(["unknown", "stripe", "sepa", "transfer", "other"])

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

function paymentMethodValue(formData: FormData): SupplierPaymentMethod {
  const value = textValue(formData, "payment_method") ?? "unknown"
  return PAYMENT_METHODS.has(value as SupplierPaymentMethod) ? (value as SupplierPaymentMethod) : "unknown"
}

async function getActionContext(nextPath: string) {
  const supabase = await createClient()
  const user = await requireSupplierUser(supabase, nextPath)
  return { supabase, userId: user.id }
}

export async function saveSupplierAction(formData: FormData) {
  const supplierId = textValue(formData, "supplier_id")
  const { supabase, userId } = await getActionContext(supplierId ? `/proveedores/${supplierId}/edit` : "/proveedores/nuevo")

  const supplierFields = {
    tax_id: requiredText(formData, "tax_id"),
    name: requiredText(formData, "name"),
    contact_name: textValue(formData, "contact_name"),
    contact_phone: textValue(formData, "contact_phone"),
    contact_email: textValue(formData, "contact_email"),
    start_date: textValue(formData, "start_date"),
    active: formData.get("active") === "on",
    payment_method: paymentMethodValue(formData),
    sepa_reference: textValue(formData, "sepa_reference"),
    stripe_reference: textValue(formData, "stripe_reference"),
    comments: textValue(formData, "comments"),
  }

  const payload = {
    ...supplierFields,
    updated_by: userId,
  }

  if (supplierId) {
    const { error } = await supabase.from("suppliers").update(payload).eq("id", supplierId)

    if (error) {
      throw error
    }

    revalidatePath("/proveedores")
    revalidatePath(`/proveedores/${supplierId}`)
    revalidatePath(`/proveedores/${supplierId}/edit`)
    redirect(`/proveedores/${supplierId}`)
  }

  const { data, error } = await supabase
    .from("suppliers")
    .insert({ ...payload, created_by: userId })
    .select("id")
    .single()

  if (error) {
    throw error
  }

  const created = data as { id: string }
  revalidatePath("/proveedores")
  redirect(`/proveedores/${created.id}`)
}

export async function deleteSupplierAction(formData: FormData) {
  const supplierId = requiredText(formData, "supplier_id")
  const { supabase } = await getActionContext(`/proveedores/${supplierId}`)

  const { count, error: expensesError } = await supabase
    .from("expense_individuals")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", supplierId)

  if (expensesError) {
    throw expensesError
  }

  if ((count ?? 0) > 0) {
    throw new Error("No se puede eliminar el proveedor porque tiene gastos individuales asociados.")
  }

  const { error } = await supabase.from("suppliers").delete().eq("id", supplierId)

  if (error) {
    throw error
  }

  revalidatePath("/proveedores")
  redirect("/proveedores")
}
