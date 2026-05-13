"use server"

import { createHash, randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { buildSupplierTemplateRules, extractPdfText, inferInvoiceDraft, amountMatchesTotal, roundMoney } from "@/lib/expenses/invoice-intake/extraction"
import type { ExpensePaymentMethod, ExpenseSupplierOption } from "@/lib/expenses/types"
import type { ExpenseInvoiceIntakeDocument, ExpenseInvoiceIntakeItem, ExpenseInvoiceSupplierTemplate } from "@/lib/expenses/invoice-intake/types"
import { getModuleOutbox } from "@/lib/mail/settings"
import { listMicrosoftPdfMailAttachmentsForUser } from "@/lib/microsoft/graph"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdminAccess } from "@/lib/users/server"

const INTAKE_BUCKET = "expense-invoice-intake"
const EXPENSE_DOCUMENTS_BUCKET = "expense-documents"
const PAYMENT_METHODS = new Set<ExpensePaymentMethod>(["n26", "caixa", "other"])

type AdminClient = ReturnType<typeof createAdminClient>

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
  itemId?: string
  reason?: string
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
      .select("id, tax_id, name, active")
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

async function insertEvent(
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
    return { created: false, skipped: true, reason: duplicateReason }
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

  try {
    const extracted = await extractPdfText(input.buffer)
    const draft = inferInvoiceDraft({
      text: extracted.text,
      suppliers: input.suppliers,
      templates: input.templates,
    })

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
        status: draft.status,
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
        extraction_data: draft.extraction_data,
        field_confidence: draft.field_confidence,
        last_error: draft.last_error ?? null,
        updated_by: input.userId,
      })
      .eq("id", item.id)

    if (updateItemError) {
      throw updateItemError
    }

    await insertEvent(admin, {
      itemId: item.id,
      eventType: "extraction_completed",
      fromStatus: "pendiente",
      toStatus: draft.status,
      actorUserId: input.userId,
      payload: { document_id: document.id, source_kind: input.sourceKind },
    })
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

    await insertEvent(admin, {
      itemId: item.id,
      eventType: "extraction_failed",
      fromStatus: "pendiente",
      toStatus: "fallida",
      actorUserId: input.userId,
      payload: { document_id: document.id, error: message },
    })
  }

  return { created: true, skipped: false, itemId: item.id }
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
  let skipped = 0

  for (const rawFile of rawFiles) {
    const fileName = rawFile.name || "factura.pdf"
    if (!fileName.toLowerCase().endsWith(".pdf") && rawFile.type !== "application/pdf") {
      skipped += 1
      continue
    }

    const buffer = Buffer.from(await rawFile.arrayBuffer())
    const result = await createIntakeFromPdf({
      sourceKind: "upload",
      fileName,
      mimeType: rawFile.type || "application/pdf",
      buffer,
      userId: membership.user.id,
      suppliers: context.suppliers,
      templates: context.templates,
    })

    if (result.created) created += 1
    if (result.skipped) skipped += 1
  }

  revalidateReception()
  redirectToReception({ uploaded: created, skipped })
}

export async function importExpenseInvoiceEmailAction(formData: FormData) {
  const membership = await requireAdminAccess("/gastos/recepcion")
  const source = await resolveEmailImportSource(membership.user.id, formData)
  const maxMessages = Math.min(Math.max(numberValue(formData, "max_messages") ?? 25, 1), 50)
  const attachments = await listMicrosoftPdfMailAttachmentsForUser(source.connectionUserId, {
    mailboxEmail: source.mailboxEmail,
    maxMessages,
  })
  const admin = createAdminClient()
  const context = await loadExtractionContext(admin)
  let created = 0
  let skipped = 0

  for (const attachment of attachments) {
    const buffer = Buffer.from(attachment.contentBytes, "base64")
    const result = await createIntakeFromPdf({
      sourceKind: "email",
      fileName: attachment.name,
      mimeType: attachment.contentType || "application/pdf",
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
    if (result.skipped) skipped += 1
  }

  revalidateReception()
  redirectToReception({ imported: created, skipped, scanned: attachments.length })
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

  await insertEvent(admin, {
    itemId,
    eventType: "rejected",
    fromStatus: currentStatus,
    toStatus: "rechazada",
    actorUserId: membership.user.id,
    payload: { notes },
  })

  revalidateReception(itemId)
  redirect(`/gastos/recepcion/${itemId}`)
}

export async function approveExpenseInvoiceIntakeAction(formData: FormData) {
  const itemId = requiredText(formData, "item_id")
  const supplierId = requiredText(formData, "supplier_id")
  const invoiceNumber = requiredText(formData, "invoice_number")
  const invoiceDate = requiredText(formData, "invoice_date")
  const title = requiredText(formData, "title")
  const netAmount = requiredNumber(formData, "net_amount")
  const vatRate = requiredNumber(formData, "vat_rate")
  const totalAmount = requiredNumber(formData, "total_amount")
  const currency = (textValue(formData, "currency") ?? "EUR").toUpperCase()
  const paymentMethod = paymentMethodValue(formData)
  const notes = textValue(formData, "review_notes")
  const membership = await requireAdminAccess(`/gastos/recepcion/${itemId}`)
  const admin = createAdminClient()

  if (!amountMatchesTotal(netAmount, vatRate, totalAmount)) {
    throw new Error("La base, IVA y total no cuadran. Corrige los importes antes de aprobar.")
  }

  const [
    { data: itemData, error: itemError },
    { data: documentData, error: documentError },
    { data: supplierData, error: supplierError },
    { data: duplicateExpenseData, error: duplicateExpenseError },
    { data: duplicateIntakeData, error: duplicateIntakeError },
  ] = await Promise.all([
    admin
      .from("expense_invoice_intake_items")
      .select("*")
      .eq("id", itemId)
      .single(),
    admin
      .from("expense_invoice_intake_documents")
      .select("*")
      .eq("item_id", itemId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    admin
      .from("suppliers")
      .select("id, tax_id, name")
      .eq("id", supplierId)
      .single(),
    admin
      .from("expense_individuals")
      .select("id")
      .eq("supplier_id", supplierId)
      .ilike("invoice_number", invoiceNumber)
      .maybeSingle(),
    admin
      .from("expense_invoice_intake_items")
      .select("id")
      .eq("supplier_id", supplierId)
      .ilike("invoice_number", invoiceNumber)
      .neq("id", itemId)
      .neq("status", "rechazada")
      .limit(1)
      .maybeSingle(),
  ])

  if (itemError) throw itemError
  if (documentError) throw documentError
  if (supplierError) throw supplierError
  if (duplicateExpenseError) throw duplicateExpenseError
  if (duplicateIntakeError) throw duplicateIntakeError

  const item = itemData as ExpenseInvoiceIntakeItem
  const document = documentData as ExpenseInvoiceIntakeDocument | null
  const supplier = supplierData as { id: string; tax_id: string; name: string }

  if (item.status === "aprobada") {
    throw new Error("Esta factura ya esta aprobada.")
  }

  if (duplicateExpenseData) {
    throw new Error("Ya existe un gasto individual para este proveedor y numero de factura.")
  }

  if (duplicateIntakeData) {
    throw new Error("Ya existe otra recepcion abierta para este proveedor y numero de factura.")
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
      title,
      invoice_number: invoiceNumber,
      expense_date: invoiceDate,
      payment_method: paymentMethod,
      net_amount: roundMoney(netAmount),
      vat_rate: roundMoney(vatRate),
      total_amount: roundMoney(totalAmount),
      currency,
      notes,
      legacy_has_attachment: false,
      source_raw: {
        source: "expense_invoice_intake",
        intake_item_id: itemId,
        intake_document_id: document.id,
      },
      created_by: membership.user.id,
      updated_by: membership.user.id,
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
      uploaded_by: membership.user.id,
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
    invoice_number: invoiceNumber,
    invoice_date: invoiceDate,
    net_amount: roundMoney(netAmount),
    vat_rate: roundMoney(vatRate),
    total_amount: roundMoney(totalAmount),
    currency,
    title,
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
    },
    last_approved_item_id: itemId,
    updated_by: membership.user.id,
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
        created_by: membership.user.id,
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
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      net_amount: roundMoney(netAmount),
      vat_rate: roundMoney(vatRate),
      total_amount: roundMoney(totalAmount),
      currency,
      title,
      payment_method: paymentMethod,
      review_notes: notes,
      approved_expense_id: expenseId,
      approved_by: membership.user.id,
      approved_at: new Date().toISOString(),
      updated_by: membership.user.id,
    })
    .eq("id", itemId)

  if (updateItemError) throw updateItemError

  await insertEvent(admin, {
    itemId,
    eventType: "approved",
    fromStatus: item.status,
    toStatus: "aprobada",
    actorUserId: membership.user.id,
    payload: { expense_id: expenseId, supplier_id: supplier.id, invoice_number: invoiceNumber },
  })

  revalidateReception(itemId)
  redirect(`/gastos/individuales/${expenseId}`)
}
