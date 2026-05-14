import type { AppUser } from "@/lib/clients/types"

export type ExpensePaymentMethod = "n26" | "caixa" | "other"

export type ExpenseIndividualRecord = {
  id: string
  supplier_id: string
  supplier_tax_id: string
  supplier_name: string
  title: string
  invoice_number: string
  expense_date: string
  payment_method: ExpensePaymentMethod
  net_amount: number | string | null
  vat_rate: number | string
  total_amount: number | string
  currency: string
  notes: string | null
  legacy_has_attachment: boolean
  sharepoint_site_id: string | null
  sharepoint_list_id: string | null
  sharepoint_item_id: number | null
  sharepoint_unique_id: string | null
  sharepoint_etag: string | null
  source_raw: unknown
  imported_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type ExpenseIndividualDocument = {
  id: string
  expense_id: string
  file_name: string
  mime_type: string | null
  file_size: number | string
  storage_bucket: string
  storage_path: string
  source_kind: "upload" | "sharepoint"
  source_sha256: string | null
  source_url: string | null
  source_downloaded_at: string | null
  sharepoint_site_id: string | null
  sharepoint_list_id: string | null
  sharepoint_item_id: number | null
  sharepoint_unique_id: string | null
  binary_file_id: string | null
  uploaded_by: string | null
  created_at: string
}

export type ExpenseIndividualListItem = ExpenseIndividualRecord & {
  document_count: number
}

export type ExpenseIndividualDetail = {
  user: AppUser
  expense: ExpenseIndividualRecord
  documents: ExpenseIndividualDocument[]
}

export type ExpenseIndividualFilters = {
  q?: string
  supplier?: string
  payment?: string
  year?: string
  month?: string
}

export type ExpenseSupplierOption = {
  id: string
  tax_id: string
  name: string
  active: boolean
  contact_email?: string | null
  auto_approve_expense_invoices?: boolean | null
}
