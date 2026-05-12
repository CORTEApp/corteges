import type { ExpensePaymentMethod } from "@/lib/expenses/types"

const amountFormatter = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const compactAmountFormatter = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export const expensePaymentMethodLabels: Record<ExpensePaymentMethod, string> = {
  n26: "N26",
  caixa: "Caixa",
  other: "Otro",
}

export function toExpenseNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(",", "."))
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

export function formatExpenseAmount(value: number | string | null | undefined) {
  return `${amountFormatter.format(toExpenseNumber(value))} €`
}

export function formatExpenseAmountCompact(value: number | string | null | undefined) {
  return `${compactAmountFormatter.format(toExpenseNumber(value))} €`
}

export function formatExpenseDate(value?: string | null) {
  if (!value) {
    return "-"
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value))
}

export function formatExpenseFileSize(value: number | string | null | undefined) {
  const bytes = toExpenseNumber(value)
  if (bytes <= 0) {
    return "0 KB"
  }

  const units = ["B", "KB", "MB", "GB"]
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${compactAmountFormatter.format(size)} ${units[unitIndex]}`
}

export function expenseOriginLabel(expense: { sharepoint_item_id: number | null }) {
  return expense.sharepoint_item_id ? "SharePoint" : "Manual"
}
