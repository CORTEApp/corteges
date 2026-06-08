import type { AppUser } from "@/lib/clients/types"
import type {
  ExpenseIndividualDocument,
  ExpenseIndividualRecord,
  ExpensePaymentMethod,
  ExpenseSupplierOption,
} from "@/lib/expenses/types"

export const EXPENSE_INVOICE_INTAKE_STATUSES = [
  "pendiente",
  "extraida",
  "requiere_revision",
  "aprobada",
  "rechazada",
  "fallida",
] as const

export type ExpenseInvoiceIntakeStatus = (typeof EXPENSE_INVOICE_INTAKE_STATUSES)[number]
export type ExpenseInvoiceIntakeSourceKind = "upload" | "email"

export type ExpenseInvoiceIntakeItem = {
  id: string
  status: ExpenseInvoiceIntakeStatus
  source_kind: ExpenseInvoiceIntakeSourceKind
  supplier_id: string | null
  supplier_tax_id: string | null
  supplier_name: string | null
  invoice_number: string | null
  invoice_date: string | null
  net_amount: number | string | null
  vat_rate: number | string | null
  total_amount: number | string | null
  currency: string
  title: string | null
  payment_method: ExpensePaymentMethod
  template_id: string | null
  extraction_data: unknown
  field_confidence: unknown
  last_error: string | null
  review_notes: string | null
  approved_expense_id: string | null
  approved_by: string | null
  approved_at: string | null
  rejected_by: string | null
  rejected_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type ExpenseInvoiceIntakeDocument = {
  id: string
  item_id: string
  file_name: string
  mime_type: string | null
  file_size: number | string
  storage_bucket: string
  storage_path: string
  source_sha256: string
  provider: string | null
  provider_mailbox: string | null
  provider_message_id: string | null
  provider_attachment_id: string | null
  provider_received_at: string | null
  sender_email: string | null
  sender_name: string | null
  subject: string | null
  extracted_text: string | null
  extracted_pages: number | null
  extracted_at: string | null
  extraction_error: string | null
  uploaded_by: string | null
  created_at: string
}

export type ExpenseInvoiceSupplierTemplate = {
  id: string
  supplier_id: string
  status: "active" | "disabled"
  version: number
  extraction_rules: unknown
  field_map: unknown
  sample_count: number
  success_count: number
  last_approved_item_id: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type ExpenseInvoiceIntakeEvent = {
  id: string
  item_id: string
  event_type: string
  from_status: ExpenseInvoiceIntakeStatus | null
  to_status: ExpenseInvoiceIntakeStatus | null
  actor_user_id: string | null
  actor_profile: {
    display_name: string | null
    email: string | null
  } | null
  payload: unknown
  created_at: string
}

export type ExpenseInvoiceIntakeListItem = ExpenseInvoiceIntakeItem & {
  document_count: number
  primary_document: ExpenseInvoiceIntakeDocument | null
}

export type ExpenseInvoiceDuplicateExpenseOrigin = ExpenseIndividualRecord & {
  documents: ExpenseIndividualDocument[]
}

export type ExpenseInvoiceDuplicateIntakeOrigin = ExpenseInvoiceIntakeItem & {
  documents: ExpenseInvoiceIntakeDocument[]
}

export type ExpenseInvoiceDuplicateOrigin = {
  checkedAt: string | null
  existingExpenseId: string | null
  existingIntakeItemId: string | null
  expense: ExpenseInvoiceDuplicateExpenseOrigin | null
  intakeItem: ExpenseInvoiceDuplicateIntakeOrigin | null
}

export type ExpenseInvoiceIntakeDetail = {
  user: AppUser
  item: ExpenseInvoiceIntakeItem
  documents: ExpenseInvoiceIntakeDocument[]
  suppliers: ExpenseSupplierOption[]
  events: ExpenseInvoiceIntakeEvent[]
  duplicateOrigin: ExpenseInvoiceDuplicateOrigin | null
}

export type ExpenseInvoiceIntakeFilters = {
  q?: string
  status?: string
  supplier?: string
  source?: string
}

export type ExtractedInvoiceDraft = {
  supplier_id?: string | null
  supplier_tax_id?: string | null
  supplier_name?: string | null
  invoice_number?: string | null
  invoice_date?: string | null
  net_amount?: number | null
  vat_rate?: number | null
  total_amount?: number | null
  currency?: string
  title?: string | null
  template_id?: string | null
  extraction_data: Record<string, unknown>
  field_confidence: Record<string, number>
  status: "extraida" | "requiere_revision" | "fallida"
  last_error?: string | null
}

export type SupplierTemplateFieldRule = {
  regex: string
  parser: "text" | "date" | "money" | "rate"
  line_hint?: string
}

export type SupplierTemplateRules = {
  version: 1
  fields: Partial<Record<keyof ExtractedInvoiceDraft, SupplierTemplateFieldRule>>
}
