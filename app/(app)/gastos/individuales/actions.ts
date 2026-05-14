"use server"

import { createHash } from "node:crypto"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireExpenseUser } from "@/lib/expenses/data"
import type { ExpensePaymentMethod } from "@/lib/expenses/types"
import { createClient } from "@/lib/supabase/server"

const PAYMENT_METHODS = new Set<ExpensePaymentMethod>(["n26", "caixa", "other"])
const EXPENSE_INVOICE_UNIQUE_INDEX = "idx_expense_individuals_supplier_invoice_unique"
const DUPLICATE_EXPENSE_INVOICE_MESSAGE =
  "Ya existe un gasto individual para este proveedor y numero de factura."

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>
type DatabaseError = {
  code?: string | null
  message?: string | null
  details?: string | null
}

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

  const parsed = Number.parseFloat(value.replace(",", "."))
  return Number.isFinite(parsed) ? parsed : null
}

function requiredNumber(formData: FormData, key: string) {
  const value = numberValue(formData, key)
  if (value == null) {
    throw new Error(`Missing required numeric field: ${key}`)
  }
  return value
}

function paymentMethodValue(formData: FormData): ExpensePaymentMethod {
  const value = textValue(formData, "payment_method") ?? "n26"
  return PAYMENT_METHODS.has(value as ExpensePaymentMethod) ? (value as ExpensePaymentMethod) : "other"
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function normalizeInvoiceNumber(value: string) {
  return value.trim().toUpperCase()
}

function expenseDatabaseErrorMessage(error: DatabaseError) {
  const databaseMessage = [error.message, error.details].filter(Boolean).join(" ")
  if (error.code === "23505" || databaseMessage.includes(EXPENSE_INVOICE_UNIQUE_INDEX)) {
    return DUPLICATE_EXPENSE_INVOICE_MESSAGE
  }

  return error.message ?? "No se pudo guardar el gasto individual."
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

async function getActionContext(nextPath: string) {
  const supabase = await createClient()
  const user = await requireExpenseUser(supabase, nextPath)
  return { supabase, userId: user.id }
}

async function supplierSnapshot(supabase: SupabaseServerClient, supplierId: string) {
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, tax_id, name")
    .eq("id", supplierId)
    .single()

  if (error) {
    throw error
  }

  return data as { id: string; tax_id: string; name: string }
}

async function assertUniqueExpenseInvoice(
  supabase: SupabaseServerClient,
  supplierId: string,
  invoiceNumber: string,
  expenseId?: string | null,
) {
  const invoiceKey = normalizeInvoiceNumber(invoiceNumber)
  if (!invoiceKey) {
    return
  }

  const { data, error } = await supabase
    .from("expense_individuals")
    .select("id, invoice_number")
    .eq("supplier_id", supplierId)
    .not("invoice_number", "is", null)
    .limit(2000)

  if (error) {
    throw error
  }

  const duplicate = ((data ?? []) as Array<{ id: string; invoice_number: string | null }>).find(
    (expense) =>
      expense.id !== expenseId &&
      normalizeInvoiceNumber(expense.invoice_number ?? "") === invoiceKey,
  )

  if (duplicate) {
    throw new Error(DUPLICATE_EXPENSE_INVOICE_MESSAGE)
  }
}

function revalidateExpensePaths(expenseId?: string) {
  revalidatePath("/gastos/individuales")
  if (expenseId) {
    revalidatePath(`/gastos/individuales/${expenseId}`)
    revalidatePath(`/gastos/individuales/${expenseId}/edit`)
  }
}

export async function saveExpenseIndividualAction(formData: FormData) {
  const expenseId = textValue(formData, "expense_id")
  const { supabase, userId } = await getActionContext(
    expenseId ? `/gastos/individuales/${expenseId}/edit` : "/gastos/individuales/nuevo",
  )
  const supplier = await supplierSnapshot(supabase, requiredText(formData, "supplier_id"))
  const netAmount = requiredNumber(formData, "net_amount")
  const vatRate = requiredNumber(formData, "vat_rate")

  const payload = {
    supplier_id: supplier.id,
    supplier_tax_id: supplier.tax_id,
    supplier_name: supplier.name,
    title: requiredText(formData, "title"),
    invoice_number: requiredText(formData, "invoice_number"),
    expense_date: requiredText(formData, "expense_date"),
    payment_method: paymentMethodValue(formData),
    net_amount: netAmount,
    vat_rate: vatRate,
    total_amount: roundMoney(netAmount * (1 + vatRate / 100)),
    currency: "EUR",
    notes: textValue(formData, "notes"),
    updated_by: userId,
  }

  await assertUniqueExpenseInvoice(supabase, supplier.id, payload.invoice_number, expenseId)

  if (expenseId) {
    const { error } = await supabase
      .from("expense_individuals")
      .update(payload)
      .eq("id", expenseId)

    if (error) {
      throw new Error(expenseDatabaseErrorMessage(error))
    }

    revalidateExpensePaths(expenseId)
    redirect(`/gastos/individuales/${expenseId}`)
  }

  const { data, error } = await supabase
    .from("expense_individuals")
    .insert({ ...payload, created_by: userId })
    .select("id")
    .single()

  if (error) {
    throw new Error(expenseDatabaseErrorMessage(error))
  }

  const created = data as { id: string }
  revalidateExpensePaths(created.id)
  redirect(`/gastos/individuales/${created.id}`)
}

export async function deleteExpenseIndividualAction(formData: FormData) {
  const expenseId = requiredText(formData, "expense_id")
  const { supabase } = await getActionContext(`/gastos/individuales/${expenseId}`)

  const { data: documents, error: documentsError } = await supabase
    .from("expense_individual_documents")
    .select("storage_bucket, storage_path")
    .eq("expense_id", expenseId)

  if (documentsError) {
    throw documentsError
  }

  for (const document of documents ?? []) {
    const storageDocument = document as { storage_bucket: string; storage_path: string }
    const { error: removeError } = await supabase
      .storage
      .from(storageDocument.storage_bucket)
      .remove([storageDocument.storage_path])

    if (removeError) {
      throw removeError
    }
  }

  const { error } = await supabase
    .from("expense_individuals")
    .delete()
    .eq("id", expenseId)

  if (error) {
    throw error
  }

  revalidatePath("/gastos/individuales")
  redirect("/gastos/individuales")
}

export async function uploadExpenseIndividualDocumentAction(formData: FormData) {
  const expenseId = requiredText(formData, "expense_id")
  const rawFiles = [
    ...formData.getAll("files"),
    formData.get("file"),
  ].filter((file): file is File => file instanceof File && file.size > 0)

  if (rawFiles.length === 0) {
    throw new Error("Selecciona al menos un archivo para subir.")
  }

  const { supabase, userId } = await getActionContext(`/gastos/individuales/${expenseId}/edit`)
  const bucket = "expense-documents"

  for (const rawFile of rawFiles) {
    const fileName = safeFileName(rawFile.name)
    const storagePath = `${expenseId}/${Date.now()}-${crypto.randomUUID()}-${fileName}`
    const buffer = Buffer.from(await rawFile.arrayBuffer())
    const sourceSha256 = createHash("sha256").update(buffer).digest("hex")

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, buffer, {
        cacheControl: "3600",
        contentType: rawFile.type || "application/octet-stream",
        upsert: false,
      })

    if (uploadError) {
      throw uploadError
    }

    const { error: insertError } = await supabase.from("expense_individual_documents").insert({
      expense_id: expenseId,
      file_name: rawFile.name,
      mime_type: rawFile.type || null,
      file_size: rawFile.size,
      storage_bucket: bucket,
      storage_path: storagePath,
      source_kind: "upload",
      source_sha256: sourceSha256,
      uploaded_by: userId,
    })

    if (insertError) {
      await supabase.storage.from(bucket).remove([storagePath])
      throw insertError
    }
  }

  revalidateExpensePaths(expenseId)
  redirect(`/gastos/individuales/${expenseId}/edit#documentos`)
}

export async function deleteExpenseIndividualDocumentAction(formData: FormData) {
  const expenseId = requiredText(formData, "expense_id")
  const documentId = requiredText(formData, "document_id")
  const { supabase } = await getActionContext(`/gastos/individuales/${expenseId}/edit`)

  const { data, error } = await supabase
    .from("expense_individual_documents")
    .select("storage_bucket, storage_path")
    .eq("expense_id", expenseId)
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
    .from("expense_individual_documents")
    .delete()
    .eq("expense_id", expenseId)
    .eq("id", documentId)

  if (deleteError) {
    throw deleteError
  }

  revalidateExpensePaths(expenseId)
  redirect(`/gastos/individuales/${expenseId}/edit#documentos`)
}
