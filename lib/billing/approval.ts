import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { enqueueBillingDocumentEmail, sendQueuedBillingEmail } from "@/lib/mail/billing"
import { calculateApprovalLineAmounts } from "@/lib/billing/approval-amounts.mjs"
import { toNumber } from "@/lib/billing/format"
import type {
  BillingFacturableUnit,
  BillingInvoiceApprovalBatch,
  BillingInvoiceApprovalCandidate,
  BillingInvoiceApprovalCandidateDetail,
  BillingInvoiceApprovalLine,
  BillingInvoiceApprovalPageData,
  BillingSubscription,
} from "@/lib/billing/types"
import type { MailDispatchJob } from "@/lib/mail/types"

type ApprovalSource = "manual" | "cron"

type FacturableUnitRow = {
  id: string
  unit_type: BillingFacturableUnit | null
}

type GroupedSubscription = {
  key: string
  subscriptions: BillingSubscription[]
}

export type PrepareMonthlyInvoiceApprovalResult = {
  batch: BillingInvoiceApprovalBatch
  created: number
  updated: number
  skipped: number
  candidateCount: number
  totalAmount: number
}

export type ApprovalAttemptResult = {
  ok: boolean
  candidateId: string
  invoiceId: string | null
  mailJobId: string | null
  error: string | null
}

function pad2(value: number) {
  return String(value).padStart(2, "0")
}

function todayPeriodStart() {
  const now = new Date()
  return `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-01`
}

export function normalizeBillingPeriodStart(value?: string | null) {
  const raw = String(value ?? "").trim()
  const candidate = raw ? (/^\d{4}-\d{2}$/.test(raw) ? `${raw}-01` : raw.slice(0, 10)) : todayPeriodStart()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
    throw new Error("Periodo de facturacion invalido.")
  }

  const [yearText, monthText] = candidate.split("-")
  const year = Number.parseInt(yearText, 10)
  const month = Number.parseInt(monthText, 10)

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Periodo de facturacion invalido.")
  }

  return `${yearText}-${monthText}-01`
}

export function billingPeriodMonthValue(periodStart: string) {
  return normalizeBillingPeriodStart(periodStart).slice(0, 7)
}

export function billingPeriodEnd(periodStart: string) {
  const [yearText, monthText] = normalizeBillingPeriodStart(periodStart).split("-")
  const year = Number.parseInt(yearText, 10)
  const month = Number.parseInt(monthText, 10)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${yearText}-${monthText}-${pad2(lastDay)}`
}

export function billingPeriodLabel(periodStart: string) {
  const [year, month] = normalizeBillingPeriodStart(periodStart).split("-")
  return `${month}/${year}`
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function nullableText(value: unknown) {
  const normalized = normalizeText(value)
  return normalized ? normalized : null
}

function clientGroupKey(subscription: BillingSubscription) {
  if (subscription.client_id) {
    return `client:${subscription.client_id}`
  }

  const taxId = normalizeText(subscription.client_tax_id)
  if (taxId) {
    return `tax:${taxId.toUpperCase()}`
  }

  const email = normalizeText(subscription.billing_email)
  if (email) {
    return `email:${email.toLowerCase()}`
  }

  return `name:${normalizeText(subscription.client_name).toLowerCase()}`
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function truncateError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "No se pudo aprobar la factura.")
  return message.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]").slice(0, 1200)
}

function groupSubscriptions(subscriptions: BillingSubscription[]): GroupedSubscription[] {
  const groups = new Map<string, BillingSubscription[]>()

  for (const subscription of subscriptions) {
    const key = clientGroupKey(subscription)
    const group = groups.get(key) ?? []
    group.push(subscription)
    groups.set(key, group)
  }

  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      subscriptions: group.sort((a, b) => {
        const clientCompare = a.client_name.localeCompare(b.client_name, "es")
        if (clientCompare !== 0) {
          return clientCompare
        }

        return a.subscription_code.localeCompare(b.subscription_code, "es")
      }),
    }))
    .sort((a, b) => a.subscriptions[0].client_name.localeCompare(b.subscriptions[0].client_name, "es"))
}

async function ensureApprovalBatch(
  periodStart: string,
  periodEnd: string,
  source: ApprovalSource,
  actorUserId?: string | null,
) {
  const admin = createAdminClient()
  const { data: existing, error: existingError } = await admin
    .from("billing_invoice_approval_batches")
    .select("*")
    .eq("period_start", periodStart)
    .maybeSingle()

  if (existingError) {
    throw new Error(existingError.message)
  }

  if (existing) {
    const { data, error } = await admin
      .from("billing_invoice_approval_batches")
      .update({
        period_end: periodEnd,
        status: "open",
        source,
        last_error: null,
        updated_by: actorUserId ?? null,
      })
      .eq("id", existing.id)
      .select("*")
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return data as BillingInvoiceApprovalBatch
  }

  const { data, error } = await admin
    .from("billing_invoice_approval_batches")
    .insert({
      period_start: periodStart,
      period_end: periodEnd,
      status: "open",
      source,
      created_by: actorUserId ?? null,
      updated_by: actorUserId ?? null,
    })
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as BillingInvoiceApprovalBatch
}

async function activeSubscriptionsForPeriod(periodStart: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("billing_subscriptions")
    .select("*")
    .lte("start_date", periodStart)
    .or(`end_date.is.null,end_date.gte.${periodStart}`)
    .order("client_name", { ascending: true })
    .order("subscription_code", { ascending: true })
    .limit(5000)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as BillingSubscription[]
}

async function facturableUnitMap(subscriptions: BillingSubscription[]) {
  const facturableIds = [
    ...new Set(
      subscriptions
        .map((subscription) => subscription.facturable_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]

  if (!facturableIds.length) {
    return new Map<string, BillingFacturableUnit>()
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("billing_facturables")
    .select("id, unit_type")
    .in("id", facturableIds)

  if (error) {
    throw new Error(error.message)
  }

  return new Map(
    ((data ?? []) as FacturableUnitRow[])
      .filter((row) => row.unit_type)
      .map((row) => [row.id, row.unit_type as BillingFacturableUnit]),
  )
}

function buildCandidateLines(
  subscriptions: BillingSubscription[],
  unitByFacturableId: Map<string, BillingFacturableUnit>,
) {
  return subscriptions.map((subscription, index) => {
    const {
      quantity,
      unitPrice,
      vatRate,
      subtotalAmount,
      taxAmount,
      totalAmount,
    } = calculateApprovalLineAmounts({
      recurringTotalAmount: subscription.recurring_total_amount,
      quantity: subscription.quantity,
      applyVat: subscription.apply_vat,
      vatRate: subscription.vat_rate,
    })

    return {
      subscription_id: subscription.id,
      line_index: index + 1,
      facturable_id: subscription.facturable_id,
      code: nullableText(subscription.subscription_code),
      description: subscription.description,
      quantity,
      unit_price: unitPrice,
      vat_rate: vatRate,
      unit_type: subscription.facturable_id
        ? unitByFacturableId.get(subscription.facturable_id) ?? "Unidad"
        : "Unidad",
      subtotal_amount: subtotalAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      currency: subscription.currency || "EUR",
    }
  })
}

async function updateBatchSummary(batchId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("billing_invoice_approval_candidates")
    .select("total_amount")
    .eq("batch_id", batchId)
    .neq("status", "cancelled")

  if (error) {
    throw new Error(error.message)
  }

  const candidates = (data ?? []) as Array<{ total_amount: number | string }>
  const totalAmount = roundMoney(candidates.reduce((total, candidate) => total + toNumber(candidate.total_amount), 0))

  const { data: batch, error: batchError } = await admin
    .from("billing_invoice_approval_batches")
    .update({
      candidate_count: candidates.length,
      total_amount: totalAmount,
    })
    .eq("id", batchId)
    .select("*")
    .single()

  if (batchError) {
    throw new Error(batchError.message)
  }

  return batch as BillingInvoiceApprovalBatch
}

export async function prepareMonthlyInvoiceApprovalCandidates(
  periodInput?: string | null,
  actorUserId?: string | null,
  source: ApprovalSource = "manual",
): Promise<PrepareMonthlyInvoiceApprovalResult> {
  const periodStart = normalizeBillingPeriodStart(periodInput)
  const periodEnd = billingPeriodEnd(periodStart)
  const batch = await ensureApprovalBatch(periodStart, periodEnd, source, actorUserId)
  const subscriptions = await activeSubscriptionsForPeriod(periodStart)
  const unitByFacturableId = await facturableUnitMap(subscriptions)
  let created = 0
  let updated = 0
  let skipped = 0

  for (const group of groupSubscriptions(subscriptions)) {
    const lines = buildCandidateLines(group.subscriptions, unitByFacturableId)
    const subtotalAmount = roundMoney(lines.reduce((total, line) => total + line.subtotal_amount, 0))
    const taxAmount = roundMoney(lines.reduce((total, line) => total + line.tax_amount, 0))
    const totalAmount = roundMoney(lines.reduce((total, line) => total + line.total_amount, 0))
    const first = group.subscriptions[0]
    const admin = createAdminClient()

    const { data: existing, error: existingError } = await admin
      .from("billing_invoice_approval_candidates")
      .select("*")
      .eq("period_start", periodStart)
      .eq("client_group_key", group.key)
      .maybeSingle()

    if (existingError) {
      throw new Error(existingError.message)
    }

    const existingCandidate = existing as BillingInvoiceApprovalCandidate | null
    if (
      existingCandidate &&
      (existingCandidate.status === "sent" ||
        existingCandidate.status === "cancelled" ||
        existingCandidate.status === "processing" ||
        Boolean(existingCandidate.invoice_id))
    ) {
      skipped += 1
      continue
    }

    const payload = {
      batch_id: batch.id,
      period_start: periodStart,
      period_end: periodEnd,
      client_group_key: group.key,
      client_id: first.client_id,
      client_name: first.client_name,
      client_tax_id: first.client_tax_id,
      billing_email: first.billing_email,
      currency: first.currency || "EUR",
      subtotal_amount: subtotalAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      status: "pending",
      last_error: null,
      updated_by: actorUserId ?? null,
    }

    const candidate = existingCandidate
      ? await updateCandidate(existingCandidate.id, payload)
      : await insertCandidate({ ...payload, created_by: actorUserId ?? null })

    if (existingCandidate) {
      updated += 1
    } else {
      created += 1
    }

    const { error: deleteLinesError } = await admin
      .from("billing_invoice_approval_lines")
      .delete()
      .eq("candidate_id", candidate.id)

    if (deleteLinesError) {
      throw new Error(deleteLinesError.message)
    }

    const { error: insertLinesError } = await admin
      .from("billing_invoice_approval_lines")
      .insert(lines.map((line) => ({ ...line, candidate_id: candidate.id })))

    if (insertLinesError) {
      throw new Error(insertLinesError.message)
    }
  }

  const updatedBatch = await updateBatchSummary(batch.id)

  return {
    batch: updatedBatch,
    created,
    updated,
    skipped,
    candidateCount: updatedBatch.candidate_count,
    totalAmount: toNumber(updatedBatch.total_amount),
  }
}

async function insertCandidate(payload: Record<string, unknown>) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("billing_invoice_approval_candidates")
    .insert(payload)
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as BillingInvoiceApprovalCandidate
}

async function updateCandidate(id: string, payload: Record<string, unknown>) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("billing_invoice_approval_candidates")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as BillingInvoiceApprovalCandidate
}

export async function listInvoiceApprovalPageData(periodInput?: string | null): Promise<BillingInvoiceApprovalPageData> {
  const admin = createAdminClient()
  const periodStart = normalizeBillingPeriodStart(periodInput)
  const { data: batchData, error: batchError } = await admin
    .from("billing_invoice_approval_batches")
    .select("*")
    .eq("period_start", periodStart)
    .maybeSingle()

  if (batchError) {
    throw new Error(batchError.message)
  }

  const { data: candidateData, error: candidateError } = await admin
    .from("billing_invoice_approval_candidates")
    .select("*")
    .eq("period_start", periodStart)
    .order("client_name", { ascending: true })

  if (candidateError) {
    throw new Error(candidateError.message)
  }

  const candidates = (candidateData ?? []) as BillingInvoiceApprovalCandidate[]
  if (!candidates.length) {
    return {
      batch: (batchData as BillingInvoiceApprovalBatch | null) ?? null,
      candidates: [],
    }
  }

  const { data: lineData, error: lineError } = await admin
    .from("billing_invoice_approval_lines")
    .select("*")
    .in("candidate_id", candidates.map((candidate) => candidate.id))
    .order("line_index", { ascending: true })

  if (lineError) {
    throw new Error(lineError.message)
  }

  const linesByCandidate = new Map<string, BillingInvoiceApprovalLine[]>()
  for (const line of (lineData ?? []) as BillingInvoiceApprovalLine[]) {
    const lines = linesByCandidate.get(line.candidate_id) ?? []
    lines.push(line)
    linesByCandidate.set(line.candidate_id, lines)
  }

  return {
    batch: (batchData as BillingInvoiceApprovalBatch | null) ?? null,
    candidates: candidates.map((candidate) => ({
      ...candidate,
      lines: linesByCandidate.get(candidate.id) ?? [],
    })) satisfies BillingInvoiceApprovalCandidateDetail[],
  }
}

async function markCandidateFailed(
  candidateId: string,
  error: unknown,
  actorUserId?: string | null,
  invoiceId?: string | null,
  mailJobId?: string | null,
) {
  const admin = createAdminClient()
  const message = truncateError(error)
  const { error: updateError } = await admin
    .from("billing_invoice_approval_candidates")
    .update({
      status: "failed",
      invoice_id: invoiceId ?? undefined,
      mail_job_id: mailJobId ?? undefined,
      last_error: message,
      updated_by: actorUserId ?? null,
    })
    .eq("id", candidateId)
    .neq("status", "cancelled")

  if (updateError) {
    throw new Error(updateError.message)
  }

  return message
}

export async function approveBillingInvoiceCandidate(
  candidateId: string,
  actorUserId?: string | null,
): Promise<ApprovalAttemptResult> {
  const id = normalizeText(candidateId)
  if (!id) {
    throw new Error("Falta el candidato de factura.")
  }

  let invoiceId: string | null = null
  let mailJob: MailDispatchJob | null = null

  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc("approve_billing_invoice_candidate", {
      p_candidate_id: id,
      p_actor_user_id: actorUserId ?? null,
    })

    if (error) {
      throw new Error(error.message)
    }

    invoiceId = String(data)
    const { persistGeneratedBillingPdf } = await import("@/lib/billing/pdf-server")
    await persistGeneratedBillingPdf(invoiceId, "invoice", actorUserId ?? null)
    mailJob = await enqueueBillingDocumentEmail(invoiceId, null, { createdBy: actorUserId ?? null })
    const sentJob = await sendQueuedBillingEmail(mailJob.id)

    const { error: updateError } = await admin
      .from("billing_invoice_approval_candidates")
      .update({
        status: "sent",
        invoice_id: invoiceId,
        mail_job_id: sentJob.id,
        sent_at: sentJob.sent_at ?? new Date().toISOString(),
        last_error: null,
        updated_by: actorUserId ?? null,
      })
      .eq("id", id)

    if (updateError) {
      throw new Error(updateError.message)
    }

    return {
      ok: true,
      candidateId: id,
      invoiceId,
      mailJobId: sentJob.id,
      error: null,
    }
  } catch (error) {
    const message = await markCandidateFailed(id, error, actorUserId, invoiceId, mailJob?.id)
    return {
      ok: false,
      candidateId: id,
      invoiceId,
      mailJobId: mailJob?.id ?? null,
      error: message,
    }
  }
}

export async function cancelInvoiceApprovalCandidate(candidateId: string, actorUserId?: string | null) {
  const id = normalizeText(candidateId)
  if (!id) {
    throw new Error("Falta el candidato de factura.")
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("billing_invoice_approval_candidates")
    .update({
      status: "cancelled",
      cancelled_by: actorUserId ?? null,
      cancelled_at: new Date().toISOString(),
      last_error: null,
      updated_by: actorUserId ?? null,
    })
    .eq("id", id)
    .is("invoice_id", null)
    .in("status", ["pending", "failed"])
    .select("id")
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error("Solo se pueden cancelar candidatos pendientes o fallidos sin factura emitida.")
  }
}
