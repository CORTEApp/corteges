import type { SupplierPaymentMethod } from "@/lib/suppliers/types"

export const supplierPaymentMethodLabels: Record<SupplierPaymentMethod, string> = {
  unknown: "Sin definir",
  stripe: "Stripe",
  sepa: "SEPA",
  transfer: "Transferencia",
  other: "Otro",
}

export function formatSupplierDate(value: string | null) {
  if (!value) {
    return "-"
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value))
}

export function supplierOriginLabel(supplier: { sharepoint_item_id: number | null }) {
  return supplier.sharepoint_item_id ? "SharePoint" : "Manual"
}
