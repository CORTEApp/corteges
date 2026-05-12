import type { PaymentMethod } from "@/lib/clients/types"

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  unknown: "Sin definir",
  stripe: "Stripe",
  sepa: "SEPA",
  transfer: "Transferencia",
  other: "Otro",
}

export function formatMoney(value: number, currency = "EUR") {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatDate(value: string | null) {
  if (!value) {
    return "-"
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value))
}

export function formatFileSize(value: number | null) {
  if (!value) {
    return "-"
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`
}
