"use server"

import { createHash, randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { normalizeCurrencyCode } from "@/lib/currency-options"
import {
  approveReviewedIntakeItem,
  findExpenseInvoiceFiscalDuplicate,
  insertExpenseInvoiceIntakeEvent,
  markIntakeAutoApprovalFailure,
  type ReviewedInvoiceValues,
} from "@/lib/expenses/invoice-intake/approval"
import { extractPdfText, inferInvoiceDraft } from "@/lib/expenses/invoice-intake/extraction"
import {
  EXPENSE_INVOICE_INTAKE_MAX_PDF_SIZE_BYTES,
  EXPENSE_INVOICE_INTAKE_PDF_MIME_TYPE,
  isLikelyPdfAttachment,
  validatePdfBuffer,
} from "@/lib/expenses/invoice-intake/pdf-validation"
import type { ExpensePaymentMethod, ExpenseSupplierOption } from "@/lib/expenses/types"
import type {
  ExpenseInvoiceIntakeDocument,
  ExpenseInvoiceIntakeItem,
  ExpenseInvoiceSupplierTemplate,
  ExtractedInvoiceDraft,
} from "@/lib/expenses/invoice-intake/types"
import { getModuleOutbox } from "@/lib/mail/settings"
import { listMicrosoftPdfMailAttachmentsForUserWithStats } from "@/lib/microsoft/graph"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdminAccess } from "@/lib/users/server"

const INTAKE_BUCKET = "expense-invoice-intake"
const PAYMENT_METHODS = new Set<ExpensePaymentMethod>(["n26", "caixa", "other"])
const DUPLICATE_INVOICE_REVIEW_MESSAGE =
  "Posible factura duplicada para este proveedor y numero. Revisa exhaustivamente antes de aprobar."

type AdminClient = ReturnType<typeof createAdminClient>
type DuplicateSkipReason = "sha256" | "provider_attachment"

type IntakeSourceInput = {
  sourceKind: "upload" | "email"
  fileName: string
  mimeType: string | null
  buffer: Buffer
  userId: string
  provider?: string | null
  providerMailbox?: string | null
  providerMessageId?: string | null
  providerAttachmentId?: string | null
  providerReceivedAt?: string | null
  senderEmail?: string | null
  senderName?: string | null
  subject?: string | null
  suppliers: ExpenseSupplierOption[]
  templates: ExpenseInvoiceSupplierTemplate[]
}

type IntakeCreateResult = {
  created: boolean
  skipped: boolean
  duplicateInvoice: boolean
  itemId?: string
  reason?: DuplicateSkipReason
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

function currencyValue(formData: FormData) {
  const currency = normalizeCurrencyCode(textValue(formData, "currency"))
  if (!currency) {
    throw new Error("Selecciona una moneda valida: EUR, USD o GBP.")
  }

  return currency
}

function autoApprovalValues(draft: ExtractedInvoiceDraft, supplier: ExpenseSupplierOption | undefined): ReviewedInvoiceValues | null {
  const currency = normalizeCurrencyCode(draft.currency)

  if (
    !supplier?.auto_approve_expense_invoices ||
    !supplier.active ||
    draft.status !== "extraida" ||
    !draft.supplier_id ||
    !draft.invoice_number ||
    !draft.invoice_date ||
    !draft.title ||
    draft.net_amount == null ||
    draft.vat_rate == null ||
    !currency
  ) {
    return null
  }

  return {
    supplierId: draft.supplier_id,
    invoiceNumber: draft.invoice_number,
    invoiceDate: draft.invoice_date,
    title: draft.title,
    netAmount: draft.net_amount,
    vatRate: draft.vat_rate,
    currency,
    paymentMethod: "n26",
    notes: null,
  }
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

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex")
}

function redirectToReception(params: Record<string, string | number | null | undefined> = {}): never {
  const url = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") {
      url.set(key, String(value))
    }
  }

  const suffix = url.size ? `?${url.toString()}` : ""
  redirect(`/gastos/recepcion${suffix}`)
}

function revalidateReception(itemId?: string) {
  revalidatePath("/gastos/recepcion")
  if (itemId) {
    revalidatePath(`/gastos/recepcion/${itemId}`)
  }
  revalidatePath("/gastos/individuales")
}

async function resolveEmailImportSource(actorUserId: string, formData: FormData) {
  const manualMailboxEmail = textValue(formData, "mailbox_email")

  if (manualMailboxEmail) {
    return {
      connectionUserId: actorUserId,
      mailboxEmail: manualMailboxEmail,
      providerMailbox: manualMailboxEmail,
    }
  }

  const outbox = await getModuleOutbox("expense_invoice_intake")
  if (!outbox) {
    throw new Error("Configura un buzon para Recepcion de facturas o indica un buzon compartido.")
  }

  return {
    connectionUserId: outbox.connection_user_id,
    mailboxEmail: outbox.mode === "shared_mailbox" ? outbox.email_address : null,
    providerMailbox: outbox.email_address,
  }
}

async function loadExtractionContext(admin: AdminClient) {
  const [
    { data: supplierData, error: supplierError },
    { data: templateData, error: templateError },
  ] = await Promise.all([
    admin
      .from("suppliers")
      .select("id, tax_id, name, active, contact_email, auto_approve_expense_invoices")
      .order("active", { ascending: false })
      .order("name", { ascending: true })
      .limit(2000),
    admin
      .from("expense_invoice_supplier_templates")
      .select("*")
      .eq("status", "active"),
  ])

  if (supplierError) throw supplierError
  if (templateError) throw templateError

  return {
    suppliers: (supplierData ?? []) as ExpenseSupplierOption[],
    templates: (templateData ?? []) as ExpenseInvoiceSupplierTemplate[],
  }
}

async function duplicateExists(admin: AdminClient, input: IntakeSourceInput, sourceSha256: string) {
  const { data: byHash, error: hashError } = await admin
    .from("expense_invoice_intake_documents")
    .select("item_id")
    .eq("source_sha256", sourceSha256)
    .maybeSingle()

  if (hashError) {
    throw hashError
  }

  if (byHash) {
    return "sha256"
  }

  if (input.provider && input.providerMessageId && input.providerAttachmentId) {
    const { data: byProvider, error: providerError } = await admin
      .from("expense_invoice_intake_documents")
      .select("item_id")
      .eq("provider", input.provider)
      .eq("provider_mailbox", input.providerMailbox ?? "")
      .eq("provider_message_id", input.providerMessageId)
      .eq("provider_attachment_id", input.providerAttachmentId)
      .maybeSingle()

    if (providerError) {
      throw providerError
    }

    if (byProvider) {
      return "provider_attachment"
    }
  }

  return null
}

async function createIntakeFromPdf(input: IntakeSourceInput): Promise<IntakeCreateResult> {
  const admin = createAdminClient()
  const sourceSha256 = sha256(input.buffer)
  const duplicateReason = await duplicateExists(admin, input, sourceSha256)

  if (duplicateReason) {
    return { created: false, skipped: true, duplicateInvoice: false, reason: duplicateReason }
  }

  const { data: itemData, error: itemError } = await admin
    .from("expense_invoice_intake_items")
    .insert({
      status: "pendiente",
      source_kind: input.sourceKind,
      created_by: input.userId,
      updated_by: input.userId,
    })
    .select("*")
    .single()

  if (itemError) {
    throw itemError
  }

  const item = itemData as ExpenseInvoiceIntakeItem
  const fileName = safeFileName(input.fileName)
  const storagePath = `${item.id}/${Date.now()}-${randomUUID()}-${fileName}`
  const mimeType = input.mimeType || "application/pdf"

  const { error: uploadError } = await admin.storage
    .from(INTAKE_BUCKET)
    .upload(storagePath, input.buffer, {
      cacheControl: "3600",
      contentType: mimeType,
      upsert: false,
    })

  if (uploadError) {
    await admin.from("expense_invoice_intake_items").delete().eq("id", item.id)
    throw uploadError
  }

  const { data: documentData, error: documentError } = await admin
    .from("expense_invoice_intake_documents")
    .insert({
      item_id: item.id,
      file_name: input.fileName,
      mime_type: mimeType,
      file_size: input.buffer.byteLength,
      storage_bucket: INTAKE_BUCKET,
      storage_path: storagePath,
      source_sha256: sourceSha256,
      provider: input.provider ?? null,
      provider_mailbox: input.providerMailbox ?? null,
      provider_message_id: input.providerMessageId ?? null,
      provider_attachment_id: input.providerAttachmentId ?? null,
      provider_received_at: input.providerReceivedAt ?? null,
      sender_email: input.senderEmail ?? null,
      sender_name: input.senderName ?? null,
      subject: input.subject ?? null,
      uploaded_by: input.userId,
    })
    .select("*")
    .single()

  if (documentError) {
    await admin.storage.from(INTAKE_BUCKET).remove([storagePath])
    await admin.from("expense_invoice_intake_items").delete().eq("id", item.id)
    throw documentError
  }

  const document = documentData as ExpenseInvoiceIntakeDocument
  let duplicateInvoice = false

  try {
    const extracted = await extractPdfText(input.buffer)
    const draft = inferInvoiceDraft({
      text: extracted.text,
      suppliers: input.suppliers,
      templates: input.templates,
    })
    const fiscalDuplicate = await findExpenseInvoiceFiscalDuplicate(admin, draft.supplier_id, draft.invoice_number, item.id)
    duplicateInvoice = Boolean(fiscalDuplicate)
    const extractionData = fiscalDuplicate
      ? {
          ...draft.extraction_data,
          duplicate_invoice: {
            detected: true,
            checked_at: new Date().toISOString(),
            existing_expense_id: fiscalDuplicate.expenseId,
            existing_intake_item_id: fiscalDuplicate.intakeItemId,
          },
        }
      : draft.extraction_data
    const lastError = fiscalDuplicate
      ? [DUPLICATE_INVOICE_REVIEW_MESSAGE, draft.last_error].filter(Boolean).join(" ")
      : draft.last_error ?? null

    const { error: updateDocumentError } = await admin
      .from("expense_invoice_intake_documents")
      .update({
        extracted_text: extracted.text,
        extracted_pages: extracted.pages,
        extracted_at: new Date().toISOString(),
        extraction_error: null,
      })
      .eq("id", document.id)

    if (updateDocumentError) {
      throw updateDocumentError
    }

    const { error: updateItemError } = await admin
      .from("expense_invoice_intake_items")
      .update({
        status: fiscalDuplicate ? "requiere_revision" : draft.status,
        supplier_id: draft.supplier_id ?? null,
        supplier_tax_id: draft.supplier_tax_id ?? null,
        supplier_name: draft.supplier_name ?? null,
        invoice_number: draft.invoice_number ?? null,
        invoice_date: draft.invoice_date ?? null,
        net_amount: draft.net_amount ?? null,
        vat_rate: draft.vat_rate ?? null,
        total_amount: draft.total_amount ?? null,
        currency: draft.currency ?? "EUR",
        title: draft.title ?? null,
        template_id: draft.template_id ?? null,
        extraction_data: extractionData,
        field_confidence: draft.field_confidence,
        last_error: lastError,
        updated_by: input.userId,
      })
      .eq("id", item.id)

    if (updateItemError) {
      throw updateItemError
    }

    await insertExpenseInvoiceIntakeEvent(admin, {
      itemId: item.id,
      eventType: "extraction_completed",
      fromStatus: "pendiente",
      toStatus: fiscalDuplicate ? "requiere_revision" : draft.status,
      actorUserId: input.userId,
      payload: { document_id: document.id, source_kind: input.sourceKind },
    })

    if (fiscalDuplicate) {
      await insertExpenseInvoiceIntakeEvent(admin, {
        itemId: item.id,
        eventType: "duplicate_invoice_detected",
        fromStatus: draft.status,
        toStatus: "requiere_revision",
        actorUserId: input.userId,
        payload: {
          supplier_id: draft.supplier_id,
          invoice_number: draft.invoice_number,
          existing_expense_id: fiscalDuplicate.expenseId,
          existing_intake_item_id: fiscalDuplicate.intakeItemId,
        },
      })
    }

    const autoValues = fiscalDuplicate
      ? null
      : autoApprovalValues(
          draft,
          input.suppliers.find((supplier) => supplier.id === draft.supplier_id),
        )

    if (autoValues) {
      try {
        await approveReviewedIntakeItem(admin, {
          itemId: item.id,
          actorUserId: input.userId,
          values: autoValues,
          autoApproved: true,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || "No se pudo aprobar automaticamente.")
        await markIntakeAutoApprovalFailure(admin, {
          item: {
            ...item,
            status: draft.status,
            supplier_id: draft.supplier_id ?? null,
            invoice_number: draft.invoice_number ?? null,
            extraction_data: extractionData,
          },
          actorUserId: input.userId,
          error: message,
          supplierId: autoValues.supplierId,
          invoiceNumber: autoValues.invoiceNumber,
        })
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "No se pudo extraer el PDF.")

    await admin
      .from("expense_invoice_intake_documents")
      .update({ extraction_error: message })
      .eq("id", document.id)

    await admin
      .from("expense_invoice_intake_items")
      .update({
        status: "fallida",
        last_error: message,
        updated_by: input.userId,
      })
      .eq("id", item.id)

    await insertExpenseInvoiceIntakeEvent(admin, {
      itemId: item.id,
      eventType: "extraction_failed",
      fromStatus: "pendiente",
      toStatus: "fallida",
      actorUserId: input.userId,
      payload: { document_id: document.id, error: message },
    })
  }

  return { created: true, skipped: false, duplicateInvoice, itemId: item.id }
}

export async function uploadExpenseInvoiceIntakeAction(formData: FormData) {
  const membership = await requireAdminAccess("/gastos/recepcion")
  const admin = createAdminClient()
  const context = await loadExtractionContext(admin)
  const rawFiles = [
    ...formData.getAll("files"),
    formData.get("file"),
  ].filter((file): file is File => file instanceof File && file.size > 0)

  if (rawFiles.length === 0) {
    throw new Error("Selecciona al menos un PDF para subir.")
  }

  let created = 0
  let skippedInvalidFormat = 0
  let duplicateHashCount = 0
  let duplicateInvoiceCount = 0

  for (const rawFile of rawFiles) {
    const fileName = rawFile.name || "factura.pdf"
    if (
      !isLikelyPdfAttachment(fileName, rawFile.type) ||
      rawFile.size > EXPENSE_INVOICE_INTAKE_MAX_PDF_SIZE_BYTES
    ) {
      skippedInvalidFormat += 1
      continue
    }

    const buffer = Buffer.from(await rawFile.arrayBuffer())
    const validation = validatePdfBuffer(buffer)
    if (!validation.ok) {
      skippedInvalidFormat += 1
      continue
    }

    const result = await createIntakeFromPdf({
      sourceKind: "upload",
      fileName,
      mimeType: EXPENSE_INVOICE_INTAKE_PDF_MIME_TYPE,
      buffer,
      userId: membership.user.id,
      suppliers: context.suppliers,
      templates: context.templates,
    })

    if (result.created) created += 1
    if (result.duplicateInvoice) duplicateInvoiceCount += 1
    if (result.skipped && result.reason) duplicateHashCount += 1
  }

  revalidateReception()
  redirectToReception({
    uploaded: created,
    skipped: skippedInvalidFormat,
    duplicateHash: duplicateHashCount,
    duplicateInvoice: duplicateInvoiceCount,
  })
}

export async function importExpenseInvoiceEmailAction(formData: FormData) {
  const membership = await requireAdminAccess("/gastos/recepcion")
  const source = await resolveEmailImportSource(membership.user.id, formData)
  const maxMessages = Math.min(Math.max(numberValue(formData, "max_messages") ?? 25, 1), 50)
  const attachmentResult = await listMicrosoftPdfMailAttachmentsForUserWithStats(source.connectionUserId, {
    mailboxEmail: source.mailboxEmail,
    maxMessages,
    maxAttachmentBytes: EXPENSE_INVOICE_INTAKE_MAX_PDF_SIZE_BYTES,
  })
  const attachments = attachmentResult.attachments
  const admin = createAdminClient()
  const context = await loadExtractionContext(admin)
  let created = 0
  let skippedInvalidFormat = attachmentResult.skippedOversized
  let duplicateHashCount = 0
  let duplicateInvoiceCount = 0

  for (const attachment of attachments) {
    const buffer = Buffer.from(attachment.contentBytes, "base64")
    const validation = validatePdfBuffer(buffer)
    if (!validation.ok) {
      skippedInvalidFormat += 1
      continue
    }

    const result = await createIntakeFromPdf({
      sourceKind: "email",
      fileName: attachment.name,
      mimeType: EXPENSE_INVOICE_INTAKE_PDF_MIME_TYPE,
      buffer,
      userId: membership.user.id,
      provider: "microsoft_graph",
      providerMailbox: attachment.mailboxEmail ?? source.providerMailbox,
      providerMessageId: attachment.messageId,
      providerAttachmentId: attachment.attachmentId,
      providerReceivedAt: attachment.receivedDateTime,
      senderEmail: attachment.senderEmail,
      senderName: attachment.senderName,
      subject: attachment.subject,
      suppliers: context.suppliers,
      templates: context.templates,
    })

    if (result.created) created += 1
    if (result.duplicateInvoice) duplicateInvoiceCount += 1
    if (result.skipped && result.reason) duplicateHashCount += 1
  }

  revalidateReception()
  redirectToReception({
    imported: created,
    skipped: skippedInvalidFormat,
    duplicateHash: duplicateHashCount,
    duplicateInvoice: duplicateInvoiceCount,
    scanned: attachments.length,
  })
}

export async function rejectExpenseInvoiceIntakeAction(formData: FormData) {
  const itemId = requiredText(formData, "item_id")
  const notes = textValue(formData, "review_notes")
  const membership = await requireAdminAccess(`/gastos/recepcion/${itemId}`)
  const admin = createAdminClient()

  const { data: current, error: currentError } = await admin
    .from("expense_invoice_intake_items")
    .select("status")
    .eq("id", itemId)
    .single()

  if (currentError) throw currentError

  const currentStatus = String((current as { status: string }).status)
  if (currentStatus === "aprobada") {
    throw new Error("No se puede rechazar una factura ya aprobada.")
  }

  const { error } = await admin
    .from("expense_invoice_intake_items")
    .update({
      status: "rechazada",
      review_notes: notes,
      rejected_by: membership.user.id,
      rejected_at: new Date().toISOString(),
      updated_by: membership.user.id,
    })
    .eq("id", itemId)

  if (error) throw error

  await insertExpenseInvoiceIntakeEvent(admin, {
    itemId,
    eventType: "rejected",
    fromStatus: currentStatus,
    toStatus: "rechazada",
    actorUserId: membership.user.id,
    payload: { notes },
  })

  revalidateReception(itemId)
  redirectToReception()
}

export async function approveExpenseInvoiceIntakeAction(formData: FormData) {
  const itemId = requiredText(formData, "item_id")
  const membership = await requireAdminAccess(`/gastos/recepcion/${itemId}`)
  const admin = createAdminClient()

  await approveReviewedIntakeItem(admin, {
    itemId,
    actorUserId: membership.user.id,
    values: {
      supplierId: requiredText(formData, "supplier_id"),
      invoiceNumber: requiredText(formData, "invoice_number"),
      invoiceDate: requiredText(formData, "invoice_date"),
      title: requiredText(formData, "title"),
      netAmount: requiredNumber(formData, "net_amount"),
      vatRate: requiredNumber(formData, "vat_rate"),
      currency: currencyValue(formData),
      paymentMethod: paymentMethodValue(formData),
      notes: textValue(formData, "review_notes"),
    },
  })

  revalidateReception(itemId)
  redirectToReception()
}
