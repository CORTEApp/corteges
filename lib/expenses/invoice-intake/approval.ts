import "server-only"

import { randomUUID } from "node:crypto"

import { normalizeCurrencyCode } from "@/lib/currency-options"
import { calculateInvoiceTotal, roundMoney } from "@/lib/expenses/invoice-intake/amounts"
import { duplicateInvoiceExtractionData } from "@/lib/expenses/invoice-intake/duplicates"
import { buildSupplierTemplateRules } from "@/lib/expenses/invoice-intake/extraction"
import type {
  ExpenseInvoiceIntakeDocument,
  ExpenseInvoiceIntakeItem,
  ExpenseInvoiceSupplierTemplate,
} from "@/lib/expenses/invoice-intake/types"
import type { ExpensePaymentMethod } from "@/lib/expenses/types"
import type { createAdminClient } from "@/lib/supabase/admin"

const EXPENSE_DOCUMENTS_BUCKET = "expense-documents"
export const EXPENSE_INVOICE_DUPLICATE_REVIEW_MESSAGE =
  "Posible factura duplicada para este proveedor y numero. Revisa exhaustivamente antes de aprobar."

type AdminClient = ReturnType<typeof createAdminClient>

export type FiscalDuplicateMatch = {
  expenseId: string | null
  intakeItemId: string | null
}

export class ExpenseInvoiceFiscalDuplicateError extends Error {
  duplicate: FiscalDuplicateMatch

  constructor(duplicate: FiscalDuplicateMatch) {
    super(duplicate.expenseId
      ? "Ya existe un gasto individual para este proveedor y numero de factura."
      : "Ya existe otra recepcion abierta para este proveedor y numero de factura.")
    this.name = "ExpenseInvoiceFiscalDuplicateError"
    this.duplicate = duplicate
  }
}

export type ReviewedInvoiceValues = {
  supplierId: string
  invoiceNumber: string
  invoiceDate: string
  title: string
  netAmount: number
  vatRate: number
  currency: string
  paymentMethod: ExpensePaymentMethod
  notes: string | null
}

type SupplierApprovalSnapshot = {
  id: string
  tax_id: string
  name: string
  auto_approve_expense_invoices?: boolean | null
}

export type SupplierAutoApprovalCandidate = {
  item: ExpenseInvoiceIntakeItem
  values: ReviewedInvoiceValues
}

function safeFileName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 140) || "factura.pdf"
}

function normalizeInvoiceNumber(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase()
}

function numericValue(value: number | string | null | undefined) {
  if (value == null) {
    return null
  }

  const parsed = typeof value === "number" ? value : Number.parseFloat(value.replace(",", "."))
  return Number.isFinite(parsed) ? parsed : null
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

export async function insertExpenseInvoiceIntakeEvent(
  admin: AdminClient,
  input: {
    itemId: string
    eventType: string
    fromStatus?: string | null
    toStatus?: string | null
    actorUserId?: string | null
    payload?: Record<string, unknown>
  },
) {
  const { error } = await admin.from("expense_invoice_intake_events").insert({
    item_id: input.itemId,
    event_type: input.eventType,
    from_status: input.fromStatus ?? null,
    to_status: input.toStatus ?? null,
    actor_user_id: input.actorUserId ?? null,
    payload: input.payload ?? {},
  })

  if (error) {
    throw error
  }
}

export function reviewedValuesFromExtractedIntakeItem(
  item: ExpenseInvoiceIntakeItem,
  options: { paymentMethod?: ExpensePaymentMethod; notes?: string | null } = {},
): ReviewedInvoiceValues | null {
  const netAmount = numericValue(item.net_amount)
  const vatRate = numericValue(item.vat_rate)
  const currency = normalizeCurrencyCode(item.currency)

  if (
    item.status !== "extraida" ||
    !item.supplier_id ||
    !item.invoice_number ||
    !item.invoice_date ||
    !item.title ||
    netAmount == null ||
    vatRate == null ||
    !currency
  ) {
    return null
  }

  return {
    supplierId: item.supplier_id,
    invoiceNumber: item.invoice_number,
    invoiceDate: item.invoice_date,
    title: item.title,
    netAmount,
    vatRate,
    currency,
    paymentMethod: options.paymentMethod ?? item.payment_method ?? "n26",
    notes: options.notes ?? item.review_notes ?? null,
  }
}

export async function findExpenseInvoiceFiscalDuplicate(
  admin: AdminClient,
  supplierId: string | null | undefined,
  invoiceNumber: string | null | undefined,
  excludeItemId?: string,
): Promise<FiscalDuplicateMatch | null> {
  const invoiceKey = normalizeInvoiceNumber(invoiceNumber)
  if (!supplierId || !invoiceKey) {
    return null
  }

  const [
    { data: expenseData, error: expenseError },
    { data: intakeData, error: intakeError },
  ] = await Promise.all([
    admin
      .from("expense_individuals")
      .select("id, invoice_number")
      .eq("supplier_id", supplierId)
      .not("invoice_number", "is", null)
      .limit(2000),
    admin
      .from("expense_invoice_intake_items")
      .select("id, invoice_number")
      .eq("supplier_id", supplierId)
      .not("invoice_number", "is", null)
      .neq("status", "rechazada")
      .limit(2000),
  ])

  if (expenseError) throw expenseError
  if (intakeError) throw intakeError

  const duplicateExpense = ((expenseData ?? []) as Array<{ id: string; invoice_number: string | null }>).find(
    (expense) => normalizeInvoiceNumber(expense.invoice_number) === invoiceKey,
  )
  const duplicateIntake = ((intakeData ?? []) as Array<{ id: string; invoice_number: string | null }>).find(
    (intake) => intake.id !== excludeItemId && normalizeInvoiceNumber(intake.invoice_number) === invoiceKey,
  )

  if (!duplicateExpense && !duplicateIntake) {
    return null
  }

  return {
    expenseId: duplicateExpense?.id ?? null,
    intakeItemId: duplicateIntake?.id ?? null,
  }
}

export async function listSupplierAutoApprovalCandidates(
  admin: AdminClient,
  supplierId: string,
): Promise<SupplierAutoApprovalCandidate[]> {
  const { data, error } = await admin
    .from("expense_invoice_intake_items")
    .select("*")
    .eq("supplier_id", supplierId)
    .eq("status", "extraida")
    .order("created_at", { ascending: true })
    .limit(500)

  if (error) {
    throw error
  }

  const rawCandidates = ((data ?? []) as ExpenseInvoiceIntakeItem[])
    .map((item) => {
      const values = reviewedValuesFromExtractedIntakeItem(item)
      return values ? { item, values } : null
    })
    .filter((candidate): candidate is SupplierAutoApprovalCandidate => Boolean(candidate))

  if (rawCandidates.length === 0) {
    return []
  }

  const itemIds = rawCandidates.map((candidate) => candidate.item.id)
  const { data: documentData, error: documentError } = await admin
    .from("expense_invoice_intake_documents")
    .select("item_id")
    .in("item_id", itemIds)

  if (documentError) {
    throw documentError
  }

  const itemIdsWithDocument = new Set(((documentData ?? []) as Array<{ item_id: string }>).map((row) => row.item_id))
  const candidates: SupplierAutoApprovalCandidate[] = []

  for (const candidate of rawCandidates) {
    if (!itemIdsWithDocument.has(candidate.item.id)) {
      continue
    }

    const duplicate = await findExpenseInvoiceFiscalDuplicate(
      admin,
      candidate.values.supplierId,
      candidate.values.invoiceNumber,
      candidate.item.id,
    )

    if (!duplicate) {
      candidates.push(candidate)
    }
  }

  return candidates
}

export async function markIntakeAutoApprovalFailure(
  admin: AdminClient,
  input: {
    item: ExpenseInvoiceIntakeItem
    actorUserId: string
    error: string
    supplierId?: string | null
    invoiceNumber?: string | null
  },
) {
  const autoApprovalError = `No se pudo aprobar automaticamente: ${input.error}`

  const { error: updateError } = await admin
    .from("expense_invoice_intake_items")
    .update({
      status: "requiere_revision",
      last_error: autoApprovalError,
      extraction_data: {
        ...objectValue(input.item.extraction_data),
        auto_approval: {
          attempted: true,
          failed_at: new Date().toISOString(),
          error: input.error,
        },
      },
      updated_by: input.actorUserId,
    })
    .eq("id", input.item.id)

  if (updateError) {
    throw updateError
  }

  await insertExpenseInvoiceIntakeEvent(admin, {
    itemId: input.item.id,
    eventType: "auto_approval_failed",
    fromStatus: input.item.status,
    toStatus: "requiere_revision",
    actorUserId: input.actorUserId,
    payload: {
      error: input.error,
      supplier_id: input.supplierId ?? input.item.supplier_id,
      invoice_number: input.invoiceNumber ?? input.item.invoice_number,
    },
  })
}

function duplicateLastError(current: string | null) {
  if (current?.includes(EXPENSE_INVOICE_DUPLICATE_REVIEW_MESSAGE)) {
    return current
  }

  return [EXPENSE_INVOICE_DUPLICATE_REVIEW_MESSAGE, current].filter(Boolean).join(" ")
}

async function markIntakeFiscalDuplicateReview(
  admin: AdminClient,
  input: {
    item: ExpenseInvoiceIntakeItem
    supplier: SupplierApprovalSnapshot
    actorUserId: string
    values: ReviewedInvoiceValues
    totalAmount: number
    duplicate: FiscalDuplicateMatch
  },
) {
  const { error } = await admin
    .from("expense_invoice_intake_items")
    .update({
      status: "requiere_revision",
      supplier_id: input.supplier.id,
      supplier_tax_id: input.supplier.tax_id,
      supplier_name: input.supplier.name,
      invoice_number: input.values.invoiceNumber,
      invoice_date: input.values.invoiceDate,
      net_amount: roundMoney(input.values.netAmount),
      vat_rate: roundMoney(input.values.vatRate),
      total_amount: roundMoney(input.totalAmount),
      currency: input.values.currency,
      title: input.values.title,
      payment_method: input.values.paymentMethod,
      review_notes: input.values.notes,
      extraction_data: duplicateInvoiceExtractionData(input.item.extraction_data, input.duplicate),
      last_error: duplicateLastError(input.item.last_error),
      updated_by: input.actorUserId,
    })
    .eq("id", input.item.id)

  if (error) {
    throw error
  }

  await insertExpenseInvoiceIntakeEvent(admin, {
    itemId: input.item.id,
    eventType: "duplicate_invoice_detected",
    fromStatus: input.item.status,
    toStatus: "requiere_revision",
    actorUserId: input.actorUserId,
    payload: {
      supplier_id: input.supplier.id,
      invoice_number: input.values.invoiceNumber,
      existing_expense_id: input.duplicate.expenseId,
      existing_intake_item_id: input.duplicate.intakeItemId,
      source: "approval_guard",
    },
  })
}

export async function approveReviewedIntakeItem(
  admin: AdminClient,
  input: {
    itemId: string
    actorUserId: string
    values: ReviewedInvoiceValues
    autoApproved?: boolean
  },
) {
  const totalAmount = calculateInvoiceTotal(input.values.netAmount, input.values.vatRate)
  const [
    { data: itemData, error: itemError },
    { data: documentData, error: documentError },
    { data: supplierData, error: supplierError },
  ] = await Promise.all([
    admin
      .from("expense_invoice_intake_items")
      .select("*")
      .eq("id", input.itemId)
      .single(),
    admin
      .from("expense_invoice_intake_documents")
      .select("*")
      .eq("item_id", input.itemId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    admin
      .from("suppliers")
      .select("id, tax_id, name, auto_approve_expense_invoices")
      .eq("id", input.values.supplierId)
      .single(),
  ])

  if (itemError) throw itemError
  if (documentError) throw documentError
  if (supplierError) throw supplierError

  const item = itemData as ExpenseInvoiceIntakeItem
  const document = documentData as ExpenseInvoiceIntakeDocument | null
  const supplier = supplierData as SupplierApprovalSnapshot
  const fiscalDuplicate = await findExpenseInvoiceFiscalDuplicate(
    admin,
    input.values.supplierId,
    input.values.invoiceNumber,
    input.itemId,
  )

  if (item.status === "aprobada") {
    throw new Error("Esta factura ya esta aprobada.")
  }

  if (fiscalDuplicate) {
    await markIntakeFiscalDuplicateReview(admin, {
      item,
      supplier,
      actorUserId: input.actorUserId,
      values: input.values,
      totalAmount,
      duplicate: fiscalDuplicate,
    })
    throw new ExpenseInvoiceFiscalDuplicateError(fiscalDuplicate)
  }

  if (!document) {
    throw new Error("No hay PDF asociado a esta recepcion.")
  }

  const { data: originalFile, error: downloadError } = await admin.storage
    .from(document.storage_bucket)
    .download(document.storage_path)

  if (downloadError) {
    throw downloadError
  }

  const expenseId = randomUUID()
  const expenseStoragePath = `${expenseId}/${Date.now()}-${randomUUID()}-${safeFileName(document.file_name)}`
  const originalBuffer = Buffer.from(await originalFile.arrayBuffer())
  let expenseCreated = false
  let storageUploaded = false

  try {
    const { error: expenseError } = await admin.from("expense_individuals").insert({
      id: expenseId,
      supplier_id: supplier.id,
      supplier_tax_id: supplier.tax_id,
      supplier_name: supplier.name,
      title: input.values.title,
      invoice_number: input.values.invoiceNumber,
      expense_date: input.values.invoiceDate,
      payment_method: input.values.paymentMethod,
      net_amount: roundMoney(input.values.netAmount),
      vat_rate: roundMoney(input.values.vatRate),
      total_amount: roundMoney(totalAmount),
      currency: input.values.currency,
      notes: input.values.notes,
      legacy_has_attachment: false,
      source_raw: {
        source: "expense_invoice_intake",
        intake_item_id: input.itemId,
        intake_document_id: document.id,
        auto_approved: Boolean(input.autoApproved),
      },
      created_by: input.actorUserId,
      updated_by: input.actorUserId,
    })

    if (expenseError) throw expenseError
    expenseCreated = true

    const { error: uploadError } = await admin.storage
      .from(EXPENSE_DOCUMENTS_BUCKET)
      .upload(expenseStoragePath, originalBuffer, {
        cacheControl: "3600",
        contentType: document.mime_type || "application/pdf",
        upsert: false,
      })

    if (uploadError) throw uploadError
    storageUploaded = true

    const { error: documentInsertError } = await admin.from("expense_individual_documents").insert({
      expense_id: expenseId,
      file_name: document.file_name,
      mime_type: document.mime_type,
      file_size: document.file_size,
      storage_bucket: EXPENSE_DOCUMENTS_BUCKET,
      storage_path: expenseStoragePath,
      source_kind: "upload",
      source_sha256: document.source_sha256,
      source_url: null,
      source_downloaded_at: new Date().toISOString(),
      uploaded_by: input.actorUserId,
    })

    if (documentInsertError) throw documentInsertError
  } catch (error) {
    if (storageUploaded) {
      await admin.storage.from(EXPENSE_DOCUMENTS_BUCKET).remove([expenseStoragePath])
    }

    if (expenseCreated) {
      await admin.from("expense_individuals").delete().eq("id", expenseId)
    }

    throw error
  }

  const reviewedValues = {
    supplier_tax_id: supplier.tax_id,
    supplier_name: supplier.name,
    invoice_number: input.values.invoiceNumber,
    invoice_date: input.values.invoiceDate,
    net_amount: roundMoney(input.values.netAmount),
    vat_rate: roundMoney(input.values.vatRate),
    total_amount: roundMoney(totalAmount),
    currency: input.values.currency,
    title: input.values.title,
  }

  const { data: existingTemplateData, error: templateReadError } = await admin
    .from("expense_invoice_supplier_templates")
    .select("*")
    .eq("supplier_id", supplier.id)
    .eq("status", "active")
    .maybeSingle()

  if (templateReadError) throw templateReadError

  const templateRules = buildSupplierTemplateRules(document.extracted_text ?? "", reviewedValues)
  const templatePayload = {
    supplier_id: supplier.id,
    status: "active",
    extraction_rules: templateRules,
    field_map: {
      reviewed_fields: Object.keys(reviewedValues),
      last_reviewed_at: new Date().toISOString(),
      auto_approved: Boolean(input.autoApproved),
    },
    last_approved_item_id: input.itemId,
    updated_by: input.actorUserId,
  }

  if (existingTemplateData) {
    const existingTemplate = existingTemplateData as ExpenseInvoiceSupplierTemplate
    const { error: templateUpdateError } = await admin
      .from("expense_invoice_supplier_templates")
      .update({
        ...templatePayload,
        version: existingTemplate.version + 1,
        sample_count: existingTemplate.sample_count + 1,
        success_count: existingTemplate.success_count + 1,
      })
      .eq("id", existingTemplate.id)

    if (templateUpdateError) throw templateUpdateError
  } else {
    const { error: templateInsertError } = await admin
      .from("expense_invoice_supplier_templates")
      .insert({
        ...templatePayload,
        version: 1,
        sample_count: 1,
        success_count: 1,
        created_by: input.actorUserId,
      })

    if (templateInsertError) throw templateInsertError
  }

  const { error: updateItemError } = await admin
    .from("expense_invoice_intake_items")
    .update({
      status: "aprobada",
      supplier_id: supplier.id,
      supplier_tax_id: supplier.tax_id,
      supplier_name: supplier.name,
      invoice_number: input.values.invoiceNumber,
      invoice_date: input.values.invoiceDate,
      net_amount: roundMoney(input.values.netAmount),
      vat_rate: roundMoney(input.values.vatRate),
      total_amount: roundMoney(totalAmount),
      currency: input.values.currency,
      title: input.values.title,
      payment_method: input.values.paymentMethod,
      review_notes: input.values.notes,
      approved_expense_id: expenseId,
      approved_by: input.actorUserId,
      approved_at: new Date().toISOString(),
      updated_by: input.actorUserId,
    })
    .eq("id", input.itemId)

  if (updateItemError) throw updateItemError

  await insertExpenseInvoiceIntakeEvent(admin, {
    itemId: input.itemId,
    eventType: input.autoApproved ? "auto_approved" : "approved",
    fromStatus: item.status,
    toStatus: "aprobada",
    actorUserId: input.actorUserId,
    payload: {
      expense_id: expenseId,
      supplier_id: supplier.id,
      invoice_number: input.values.invoiceNumber,
      auto_approved: Boolean(input.autoApproved),
    },
  })

  return { expenseId }
}
