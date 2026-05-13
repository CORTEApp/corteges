import type { AppUser } from "@/lib/clients/types"

export const BILLING_FACTURABLE_TYPES = [
  "Aplicación",
  "Suscripción",
  "Licencia",
  "Programación",
  "Descuento",
  "Otro",
] as const

export const BILLING_FACTURABLE_UNITS = ["Unidad", "Hora"] as const

export type BillingFacturableType = (typeof BILLING_FACTURABLE_TYPES)[number]
export type BillingFacturableUnit = (typeof BILLING_FACTURABLE_UNITS)[number]

export type BillingFacturable = {
  id: string
  code: string
  description: string
  type: BillingFacturableType
  unit_price: number | string
  unit_type: BillingFacturableUnit
  comments: string | null
  active: boolean
  is_current: boolean
  sharepoint_site_id: string | null
  sharepoint_list_id: string | null
  sharepoint_item_id: number | null
  sharepoint_unique_id: string | null
  sharepoint_etag: string | null
  imported_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type BillingFacturableFilters = {
  q?: string
  active?: string
  current?: string
  type?: string
  unitType?: string
}

export type BillingFacturableDetail = {
  user: AppUser
  facturable: BillingFacturable
}

export const BILLING_DOCUMENT_TYPES = ["proforma", "invoice"] as const
export const BILLING_DOCUMENT_STATUSES = ["issued", "paid", "invoiced", "discarded", "cancelled"] as const
export const BILLING_PAYMENT_STATUSES = ["unpaid", "paid", "legacy_partial"] as const
export const BILLING_PAYMENT_METHODS = ["stripe", "sepa", "transfer", "other"] as const

export type BillingDocumentType = (typeof BILLING_DOCUMENT_TYPES)[number]
export type BillingDocumentStatus = (typeof BILLING_DOCUMENT_STATUSES)[number]
export type BillingPaymentStatus = (typeof BILLING_PAYMENT_STATUSES)[number]
export type BillingPaymentMethod = (typeof BILLING_PAYMENT_METHODS)[number]

export type BillingDocument = {
  id: string
  document_type: BillingDocumentType
  status: BillingDocumentStatus
  payment_status: BillingPaymentStatus
  series: string
  number_year: number
  number_value: number
  document_number: string
  source_proforma_id: string | null
  source_proforma_number: string | null
  client_id: string | null
  client_name: string
  client_tax_id: string | null
  billing_email: string | null
  project: string | null
  issue_date: string
  due_date: string | null
  paid_date: string | null
  payment_method: BillingPaymentMethod | null
  subtotal_amount: number | string
  tax_amount: number | string
  total_amount: number | string
  currency: string
  observations: string | null
  sharepoint_site_id: string | null
  sharepoint_list_id: string | null
  sharepoint_item_id: number | null
  sharepoint_unique_id: string | null
  sharepoint_etag: string | null
  imported_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type BillingDocumentLine = {
  id: string
  document_id: string
  line_index: number
  facturable_id: string | null
  code: string | null
  description: string
  quantity: number | string
  unit_price: number | string
  vat_rate: number | string
  unit_type: BillingFacturableUnit
  subtotal_amount: number | string
  tax_amount: number | string
  total_amount: number | string
  sharepoint_site_id: string | null
  sharepoint_list_id: string | null
  sharepoint_item_id: number | null
  sharepoint_unique_id: string | null
  sharepoint_etag: string | null
  imported_at: string | null
  created_at: string
}

export type BillingPayment = {
  id: string
  proforma_id: string
  amount: number | string
  payment_date: string
  payment_method: BillingPaymentMethod
  notes: string | null
  created_by: string | null
  created_at: string
}

export type BillingDocumentFile = {
  id: string
  document_id: string
  file_name: string
  mime_type: string | null
  file_size: number | string
  storage_bucket: string
  storage_path: string
  source_kind: "upload" | "sharepoint" | "generated"
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

export type BillingDocumentFilters = {
  q?: string
  status?: string
  payment?: string
}

export type BillingDocumentListItem = BillingDocument & {
  line_count: number
  related_invoice_id?: string | null
}

export type BillingDocumentDetail = {
  user: AppUser
  document: BillingDocument
  lines: BillingDocumentLine[]
  payments: BillingPayment[]
  files: BillingDocumentFile[]
  sourceProforma: BillingDocument | null
  generatedInvoice: BillingDocument | null
}

export type BillingClientOption = {
  id: string
  name: string
  tax_id: string
  billing_email: string | null
  payment_method: string
}

export type BillingFacturableOption = Pick<
  BillingFacturable,
  "id" | "code" | "description" | "unit_price" | "unit_type"
>

export type BillingSubscription = {
  id: string
  client_id: string | null
  client_tax_id: string | null
  client_name: string
  billing_email: string | null
  facturable_id: string | null
  subscription_code: string
  description: string
  start_date: string
  end_date: string | null
  quantity: number | string
  recurring_total_amount: number | string
  currency: string
  sharepoint_site_id: string | null
  sharepoint_list_id: string | null
  sharepoint_item_id: number | null
  sharepoint_unique_id: string | null
  sharepoint_etag: string | null
  imported_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type BillingSubscriptionFilters = {
  q?: string
  status?: "active" | "history" | "future" | "all" | string
}

export type BillingSubscriptionDetail = {
  user: AppUser
  subscription: BillingSubscription
}

export type BillingSubscriptionFormOptions = {
  clients: BillingClientOption[]
  facturables: BillingFacturableOption[]
}
