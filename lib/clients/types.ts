export type PaymentMethod = "unknown" | "stripe" | "sepa" | "transfer" | "other"

export type AppUser = {
  id: string
  email: string | null
}

export type ClientRecord = {
  id: string
  tax_id: string
  name: string
  address: string | null
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  billing_email: string | null
  start_date: string | null
  customer_rating: number | null
  active: boolean
  payment_method: PaymentMethod
  stripe_reference: string | null
  sepa_reference: string | null
  payment_notes: string | null
  comments: string | null
  sharepoint_site_id: string | null
  sharepoint_list_id: string | null
  sharepoint_item_id: number | null
  sharepoint_unique_id: string | null
  current_history_entry_id: string | null
  created_at: string
  updated_at: string
}

export type ClientDocument = {
  id: string
  client_id: string
  file_name: string
  mime_type: string | null
  file_size: number | null
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

export type ClientHistoryEntry = {
  id: string
  client_id: string | null
  tax_id: string | null
  name: string | null
  address: string | null
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  billing_email: string | null
  start_date: string | null
  customer_rating: number | null
  active: boolean | null
  active_label: string | null
  payment_method: PaymentMethod
  stripe_reference: string | null
  sepa_reference: string | null
  payment_notes: string | null
  comments: string | null
  current_line: string | null
  source_kind: "sharepoint" | "manual"
  source_key: string
  is_current: boolean
  created_by: string | null
  lead_id: string | null
  source_created_at: string | null
  source_modified_at: string | null
  sharepoint_site_id: string
  sharepoint_list_id: string
  sharepoint_item_id: number
  sharepoint_unique_id: string | null
  sharepoint_etag: string | null
  imported_at: string
}

export type ClientListItem = ClientRecord & {
  document_count: number
  history_count: number
}

export type ClientDetail = {
  user: AppUser
  client: ClientRecord
  documents: ClientDocument[]
  history: ClientHistoryEntry[]
}

export type ClientFilters = {
  q?: string
  active?: string
  payment?: string
}
