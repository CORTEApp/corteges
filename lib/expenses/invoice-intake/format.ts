import type { ExpenseInvoiceIntakeSourceKind, ExpenseInvoiceIntakeStatus } from "@/lib/expenses/invoice-intake/types"

export const invoiceIntakeStatusLabels: Record<ExpenseInvoiceIntakeStatus, string> = {
  pendiente: "Pendiente",
  extraida: "Extraida",
  requiere_revision: "Revision",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  fallida: "Fallida",
}

export const invoiceIntakeSourceLabels: Record<ExpenseInvoiceIntakeSourceKind, string> = {
  upload: "Subida",
  email: "Email",
}

export function invoiceIntakeStatusTone(status: ExpenseInvoiceIntakeStatus) {
  if (status === "aprobada") {
    return "success" as const
  }

  if (status === "fallida" || status === "rechazada") {
    return "danger" as const
  }

  if (status === "requiere_revision") {
    return "warning" as const
  }

  if (status === "extraida") {
    return "info" as const
  }

  return "neutral" as const
}

