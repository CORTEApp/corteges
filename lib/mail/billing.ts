import { createAdminClient } from "@/lib/supabase/admin"
import { sendMicrosoftMailForUser, type MicrosoftMailAttachment } from "@/lib/microsoft/graph"
import type { BillingDocument, BillingDocumentFile } from "@/lib/billing/types"
import { mailRecipientList, splitMailRecipients } from "@/lib/mail/recipients.mjs"
import { getModuleOutbox, listMailOutboxes } from "@/lib/mail/settings"
import type { MailDispatchJob, MailOutbox } from "@/lib/mail/types"

type EnqueueBillingDocumentEmailOptions = {
  createdBy?: string | null
}

const BILLING_DOCUMENTS_BUCKET = "billing-documents"

function safeText(value: unknown) {
  return String(value ?? "")
}

function escapeHtml(value: unknown) {
  return safeText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function truncateError(error: unknown) {
  const message = error instanceof Error ? error.message : safeText(error || "No se pudo enviar el email.")
  return message.slice(0, 1200)
}

function billingSubject(document: BillingDocument) {
  return `${document.document_type === "invoice" ? "Factura" : "Proforma"} ${document.document_number}`
}

function billingBodyHtml(document: BillingDocument) {
  const title = document.document_type === "invoice" ? "Factura" : "Proforma"
  return [
    `<p>Hola,</p>`,
    `<p>Adjuntamos ${escapeHtml(title.toLowerCase())} <strong>${escapeHtml(document.document_number)}</strong>.</p>`,
    `<p>Cliente: ${escapeHtml(document.client_name)}</p>`,
    `<p>Importe: ${escapeHtml(document.total_amount)} ${escapeHtml(document.currency)}</p>`,
    `<p>Un saludo.</p>`,
  ].join("")
}

async function requireBillingDocument(documentId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("billing_documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error("Documento de facturacion no encontrado.")
  }

  return data as BillingDocument
}

async function requireOutbox(outboxId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("mail_outboxes")
    .select("*")
    .eq("id", outboxId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error("Buzon emisor no encontrado.")
  }

  const outbox = data as MailOutbox
  if (!outbox.active) {
    throw new Error("El buzon emisor no esta activo.")
  }

  return outbox
}

async function latestGeneratedPdf(documentId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("billing_document_files")
    .select("*")
    .eq("document_id", documentId)
    .eq("source_kind", "generated")
    .eq("mime_type", "application/pdf")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error("Genera el PDF antes de encolar el envio.")
  }

  return data as BillingDocumentFile
}

async function filesById(fileIds: string[]) {
  if (fileIds.length === 0) {
    return []
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("billing_document_files")
    .select("*")
    .in("id", fileIds)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as BillingDocumentFile[]
}

async function downloadAttachment(file: BillingDocumentFile): Promise<MicrosoftMailAttachment> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.storage
    .from(file.storage_bucket || BILLING_DOCUMENTS_BUCKET)
    .download(file.storage_path)

  if (error) {
    throw new Error(error.message)
  }

  const bytes = Buffer.from(await data.arrayBuffer()).toString("base64")
  return {
    name: file.file_name,
    contentType: file.mime_type ?? "application/pdf",
    contentBytes: bytes,
  }
}

export async function listBillingOutboxes() {
  return listMailOutboxes()
}

export async function enqueueBillingDocumentEmail(
  documentId: string,
  outboxId?: string | null,
  options: EnqueueBillingDocumentEmailOptions = {},
) {
  const supabase = createAdminClient()
  const [document, resolvedOutbox, generatedPdf] = await Promise.all([
    requireBillingDocument(documentId),
    outboxId ? requireOutbox(outboxId) : getModuleOutbox("billing"),
    latestGeneratedPdf(documentId),
  ])

  if (!resolvedOutbox) {
    throw new Error("Configura un buzon Microsoft para Facturacion en Configuracion.")
  }

  const outbox = resolvedOutbox
  const recipients = splitMailRecipients([document.billing_email])
  if (!recipients.length) {
    throw new Error("El documento no tiene correo de cobro.")
  }

  const idempotencyKey = `billing-document:${document.id}:outbox:${outbox.id}:v1`
  const { data: existing, error: existingError } = await supabase
    .from("mail_dispatch_jobs")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle()

  if (existingError) {
    throw new Error(existingError.message)
  }

  if (existing) {
    return existing as MailDispatchJob
  }

  const { data, error } = await supabase
    .from("mail_dispatch_jobs")
    .insert({
      billing_document_id: document.id,
      outbox_id: outbox.id,
      idempotency_key: idempotencyKey,
      recipient_to: recipients,
      subject: billingSubject(document),
      body_html: billingBodyHtml(document),
      attachment_file_ids: [generatedPdf.id],
      status: "queued",
      created_by: options.createdBy ?? null,
      updated_by: options.createdBy ?? null,
    })
    .select("*")
    .single()

  if (error) {
    if (error.code === "23505") {
      const { data: racedJob, error: racedError } = await supabase
        .from("mail_dispatch_jobs")
        .select("*")
        .eq("idempotency_key", idempotencyKey)
        .single()

      if (racedError) {
        throw new Error(racedError.message)
      }

      return racedJob as MailDispatchJob
    }

    throw new Error(error.message)
  }

  return data as MailDispatchJob
}

export async function sendQueuedBillingEmail(jobId: string) {
  const supabase = createAdminClient()
  const { data: jobData, error: jobError } = await supabase
    .from("mail_dispatch_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle()

  if (jobError) {
    throw new Error(jobError.message)
  }

  if (!jobData) {
    throw new Error("Trabajo de email no encontrado.")
  }

  const job = jobData as MailDispatchJob
  if (job.status === "sent" || job.status === "cancelled" || job.status === "sending") {
    return job
  }

  const attempts = job.attempts + 1
  const { data: sendingJob, error: sendingError } = await supabase
    .from("mail_dispatch_jobs")
    .update({
      status: "sending",
      attempts,
      last_error: null,
      updated_by: job.created_by,
    })
    .eq("id", job.id)
    .in("status", ["queued", "failed"])
    .select("*")
    .maybeSingle()

  if (sendingError) {
    throw new Error(sendingError.message)
  }

  if (!sendingJob) {
    const { data: currentJob, error: currentError } = await supabase
      .from("mail_dispatch_jobs")
      .select("*")
      .eq("id", job.id)
      .single()

    if (currentError) {
      throw new Error(currentError.message)
    }

    return currentJob as MailDispatchJob
  }

  try {
    const [outbox, files] = await Promise.all([
      requireOutbox(job.outbox_id),
      filesById(job.attachment_file_ids),
    ])

    if (!outbox.connection_user_id) {
      throw new Error("El buzon emisor no tiene conexion Microsoft asociada.")
    }

    const attachments = await Promise.all(files.map(downloadAttachment))
    await sendMicrosoftMailForUser(outbox.connection_user_id, {
      mailboxEmail: outbox.mode === "shared_mailbox" ? outbox.email_address : null,
      subject: job.subject,
      bodyHtml: job.body_html,
      to: mailRecipientList(job.recipient_to),
      cc: mailRecipientList(job.recipient_cc),
      bcc: mailRecipientList(job.recipient_bcc),
      attachments,
      saveToSentItems: true,
    })

    const { data: sentJob, error: sentError } = await supabase
      .from("mail_dispatch_jobs")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        last_error: null,
        updated_by: job.created_by,
      })
      .eq("id", job.id)
      .select("*")
      .single()

    if (sentError) {
      throw new Error(sentError.message)
    }

    return sentJob as MailDispatchJob
  } catch (error) {
    const message = truncateError(error)
    await Promise.all([
      supabase
        .from("mail_dispatch_jobs")
        .update({
          status: "failed",
          last_error: message,
          updated_by: job.created_by,
        })
        .eq("id", job.id),
      supabase
        .from("mail_outboxes")
        .update({ last_error: message })
        .eq("id", job.outbox_id),
    ])

    throw new Error(message)
  }
}
