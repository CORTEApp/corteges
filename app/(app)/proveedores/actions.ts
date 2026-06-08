"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import {
  ExpenseInvoiceFiscalDuplicateError,
  approveReviewedIntakeItem,
  listSupplierAutoApprovalCandidates,
  markIntakeAutoApprovalFailure,
} from "@/lib/expenses/invoice-intake/approval"
import { createAdminClient } from "@/lib/supabase/admin"
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

function redirectToSupplier(supplierId: string, params: Record<string, string | number | null | undefined> = {}): never {
  const url = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") {
      url.set(key, String(value))
    }
  }

  const suffix = url.size ? `?${url.toString()}` : ""
  redirect(`/proveedores/${supplierId}${suffix}`)
}

async function getActionContext(nextPath: string) {
  const supabase = await createClient()
  const user = await requireSupplierUser(supabase, nextPath)
  return { supabase, userId: user.id }
}

export async function saveSupplierAction(formData: FormData) {
  const supplierId = textValue(formData, "supplier_id")
  const { supabase, userId } = await getActionContext(supplierId ? `/proveedores/${supplierId}/edit` : "/proveedores/nuevo")
  let wasAutoApprovalEnabled = false

  if (supplierId) {
    const { data: currentSupplier, error: currentSupplierError } = await supabase
      .from("suppliers")
      .select("auto_approve_expense_invoices")
      .eq("id", supplierId)
      .single()

    if (currentSupplierError) {
      throw currentSupplierError
    }

    wasAutoApprovalEnabled = Boolean(
      (currentSupplier as { auto_approve_expense_invoices?: boolean | null }).auto_approve_expense_invoices,
    )
  }

  const supplierFields = {
    tax_id: requiredText(formData, "tax_id"),
    name: requiredText(formData, "name"),
    contact_name: textValue(formData, "contact_name"),
    contact_phone: textValue(formData, "contact_phone"),
    contact_email: textValue(formData, "contact_email"),
    start_date: textValue(formData, "start_date"),
    active: formData.get("active") === "on",
    auto_approve_expense_invoices: formData.get("auto_approve_expense_invoices") === "on",
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

    if (!wasAutoApprovalEnabled && supplierFields.auto_approve_expense_invoices) {
      const admin = createAdminClient()
      const candidates = await listSupplierAutoApprovalCandidates(admin, supplierId)
      if (candidates.length > 0) {
        redirectToSupplier(supplierId, { autoApprovalReview: 1 })
      }
    }

    redirectToSupplier(supplierId)
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

export async function approveSupplierExtractedInvoicesAction(formData: FormData) {
  const supplierId = requiredText(formData, "supplier_id")
  const { userId } = await getActionContext(`/proveedores/${supplierId}`)
  const admin = createAdminClient()

  const { data: supplierData, error: supplierError } = await admin
    .from("suppliers")
    .select("auto_approve_expense_invoices")
    .eq("id", supplierId)
    .single()

  if (supplierError) {
    throw supplierError
  }

  if (!(supplierData as { auto_approve_expense_invoices?: boolean | null }).auto_approve_expense_invoices) {
    throw new Error("La aprobación automática no está activa para este proveedor.")
  }

  const candidates = await listSupplierAutoApprovalCandidates(admin, supplierId)
  let approved = 0
  let failed = 0

  for (const candidate of candidates) {
    try {
      await approveReviewedIntakeItem(admin, {
        itemId: candidate.item.id,
        actorUserId: userId,
        values: candidate.values,
        autoApproved: true,
      })
      approved += 1
    } catch (error) {
      failed += 1
      if (error instanceof ExpenseInvoiceFiscalDuplicateError) {
        continue
      }

      const message = error instanceof Error ? error.message : String(error || "No se pudo aprobar automaticamente.")
      await markIntakeAutoApprovalFailure(admin, {
        item: candidate.item,
        actorUserId: userId,
        error: message,
        supplierId,
        invoiceNumber: candidate.values.invoiceNumber,
      })
    }
  }

  revalidatePath("/proveedores")
  revalidatePath(`/proveedores/${supplierId}`)
  revalidatePath("/gastos/recepcion")
  revalidatePath("/gastos/individuales")
  redirectToSupplier(supplierId, { autoApproved: approved, autoFailed: failed })
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
