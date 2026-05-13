import type {
  BillingDocument,
  BillingDocumentStatus,
  BillingFacturable,
  BillingInvoiceApprovalStatus,
  BillingPaymentMethod,
  BillingPaymentStatus,
  BillingSubscription,
} from "@/lib/billing/types"

const numberFormatter = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
})

export function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(",", "."))
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

export function formatAmount(value: number | string | null | undefined) {
  return numberFormatter.format(toNumber(value))
}

export function formatFileSize(value: number | string | null | undefined) {
  const size = toNumber(value)
  if (size <= 0) {
    return "0 B"
  }

  if (size < 1024) {
    return `${numberFormatter.format(size)} B`
  }

  if (size < 1024 * 1024) {
    return `${numberFormatter.format(size / 1024)} KB`
  }

  return `${numberFormatter.format(size / (1024 * 1024))} MB`
}

export function facturableStateLabel(facturable: Pick<BillingFacturable, "active" | "is_current">) {
  if (!facturable.active) {
    return "Inactivo"
  }

  if (!facturable.is_current) {
    return "Histórico"
  }

  return "Activo"
}

export function facturableStateTone(facturable: Pick<BillingFacturable, "active" | "is_current">) {
  if (!facturable.active) {
    return "neutral" as const
  }

  if (!facturable.is_current) {
    return "warning" as const
  }

  return "success" as const
}

export const billingDocumentStatusLabels: Record<BillingDocumentStatus, string> = {
  issued: "Emitida",
  paid: "Pagada",
  invoiced: "Facturada",
  discarded: "Descartada",
  cancelled: "Cancelada",
}

export const billingPaymentStatusLabels: Record<BillingPaymentStatus, string> = {
  unpaid: "Sin pago",
  paid: "Pagada",
  legacy_partial: "Pago parcial histórico",
}

export const billingPaymentMethodLabels: Record<BillingPaymentMethod, string> = {
  stripe: "Stripe",
  sepa: "SEPA",
  transfer: "Transferencia",
  other: "Otro",
}

export function billingDocumentStatusTone(status: BillingDocumentStatus) {
  if (status === "paid" || status === "invoiced") {
    return "success" as const
  }

  if (status === "discarded" || status === "cancelled") {
    return "danger" as const
  }

  return "info" as const
}

export function billingPaymentStatusTone(status: BillingPaymentStatus) {
  if (status === "paid") {
    return "success" as const
  }

  if (status === "legacy_partial") {
    return "warning" as const
  }

  return "neutral" as const
}

export function billingDocumentKindLabel(document: Pick<BillingDocument, "document_type">) {
  return document.document_type === "proforma" ? "Proforma" : "Factura"
}

export const billingInvoiceApprovalStatusLabels: Record<BillingInvoiceApprovalStatus, string> = {
  pending: "Pendiente",
  processing: "Procesando",
  sent: "Enviada",
  failed: "Fallida",
  cancelled: "Cancelada",
}

export function billingInvoiceApprovalStatusTone(status: BillingInvoiceApprovalStatus) {
  if (status === "sent") {
    return "success" as const
  }

  if (status === "failed" || status === "cancelled") {
    return "danger" as const
  }

  if (status === "processing") {
    return "info" as const
  }

  return "warning" as const
}

export function formatDate(value?: string | null) {
  if (!value) {
    return "-"
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value))
}

export function subscriptionStatusLabel(status: ReturnType<typeof subscriptionStatusValue>) {
  if (status === "future") {
    return "Futura"
  }

  if (status === "history") {
    return "Finalizada"
  }

  return "Activa"
}

export function subscriptionStatusTone(status: ReturnType<typeof subscriptionStatusValue>) {
  if (status === "future") {
    return "info" as const
  }

  if (status === "history") {
    return "neutral" as const
  }

  return "success" as const
}

export function subscriptionStatusValue(
  subscription: Pick<BillingSubscription, "start_date" | "end_date">,
  today = new Date().toISOString().slice(0, 10),
) {
  if (subscription.start_date > today) {
    return "future" as const
  }

  if (subscription.end_date && subscription.end_date < today) {
    return "history" as const
  }

  return "active" as const
}
