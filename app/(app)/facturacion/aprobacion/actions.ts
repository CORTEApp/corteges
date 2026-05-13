"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import {
  approveBillingInvoiceCandidate,
  billingPeriodMonthValue,
  cancelInvoiceApprovalCandidate,
  normalizeBillingPeriodStart,
  prepareMonthlyInvoiceApprovalCandidates,
} from "@/lib/billing/approval"
import { requireAdminAccess } from "@/lib/users/server"

function textValue(formData: FormData, key: string) {
  const value = formData.get(key)
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function candidateIds(formData: FormData) {
  return formData
    .getAll("candidate_id")
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)
}

function redirectToApproval(periodStart: string, params: Record<string, string | number | null | undefined> = {}): never {
  const url = new URLSearchParams()
  url.set("period", billingPeriodMonthValue(periodStart))

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") {
      url.set(key, String(value))
    }
  }

  redirect(`/facturacion/aprobacion?${url.toString()}`)
}

export async function generateInvoiceApprovalCandidatesAction(formData: FormData) {
  const periodStart = normalizeBillingPeriodStart(textValue(formData, "period"))
  const membership = await requireAdminAccess("/facturacion/aprobacion")
  const result = await prepareMonthlyInvoiceApprovalCandidates(periodStart, membership.user.id, "manual")

  revalidatePath("/facturacion/aprobacion")
  redirectToApproval(periodStart, {
    generated: result.created + result.updated,
    skipped: result.skipped,
  })
}

export async function approveInvoiceApprovalCandidateAction(formData: FormData) {
  const periodStart = normalizeBillingPeriodStart(textValue(formData, "period"))
  const candidateId = textValue(formData, "candidate_id")
  const membership = await requireAdminAccess("/facturacion/aprobacion")

  if (!candidateId) {
    redirectToApproval(periodStart, { approved: 0, failed: 1 })
  }

  const result = await approveBillingInvoiceCandidate(candidateId, membership.user.id)

  revalidatePath("/facturacion/aprobacion")
  revalidatePath("/facturacion/facturas")
  redirectToApproval(periodStart, {
    approved: result.ok ? 1 : 0,
    failed: result.ok ? 0 : 1,
  })
}

export async function approveSelectedInvoiceApprovalCandidatesAction(formData: FormData) {
  const periodStart = normalizeBillingPeriodStart(textValue(formData, "period"))
  const ids = candidateIds(formData)
  const membership = await requireAdminAccess("/facturacion/aprobacion")

  if (!ids.length) {
    redirectToApproval(periodStart, { selected: 0 })
  }

  let approved = 0
  let failed = 0

  for (const id of ids) {
    const result = await approveBillingInvoiceCandidate(id, membership.user.id)
    if (result.ok) {
      approved += 1
    } else {
      failed += 1
    }
  }

  revalidatePath("/facturacion/aprobacion")
  revalidatePath("/facturacion/facturas")
  redirectToApproval(periodStart, { approved, failed })
}

export async function cancelInvoiceApprovalCandidateAction(formData: FormData) {
  const periodStart = normalizeBillingPeriodStart(textValue(formData, "period"))
  const candidateId = textValue(formData, "candidate_id")
  const membership = await requireAdminAccess("/facturacion/aprobacion")

  if (!candidateId) {
    redirectToApproval(periodStart, { cancelled: 0 })
  }

  await cancelInvoiceApprovalCandidate(candidateId, membership.user.id)

  revalidatePath("/facturacion/aprobacion")
  redirectToApproval(periodStart, { cancelled: 1 })
}
