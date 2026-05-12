import type { AppUser } from "@/lib/clients/types"

export type SupplierPaymentMethod = "unknown" | "stripe" | "sepa" | "transfer" | "other"

export type SupplierRecord = {
  id: string
  tax_id: string
  name: string
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  start_date: string | null
  active: boolean
  payment_method: SupplierPaymentMethod
  sepa_reference: string | null
  stripe_reference: string | null
  comments: string | null
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

export type SupplierListItem = SupplierRecord

export type SupplierDetail = {
  user: AppUser
  supplier: SupplierRecord
}

export type SupplierFilters = {
  q?: string
  active?: string
  payment?: string
}
