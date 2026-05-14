import { redirect } from "next/navigation"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { requireAdminAccess } from "@/lib/users/server"
import type {
  ExpenseInvoiceIntakeDetail,
  ExpenseInvoiceIntakeDocument,
  ExpenseInvoiceIntakeEvent,
  ExpenseInvoiceIntakeFilters,
  ExpenseInvoiceIntakeItem,
  ExpenseInvoiceIntakeListItem,
  ExpenseInvoiceSupplierTemplate,
} from "@/lib/expenses/invoice-intake/types"
import type { ExpenseSupplierOption } from "@/lib/expenses/types"

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>
type UserProfileRow = {
  id: string
  display_name: string | null
  email: string | null
}

export async function requireExpenseInvoiceIntakeAdmin(
  supabase?: SupabaseServerClient,
  nextPath = "/gastos/recepcion",
) {
  void supabase
  return requireAdminAccess(nextPath)
}

function itemMatchesSearch(item: ExpenseInvoiceIntakeListItem, query: string) {
  const document = item.primary_document
  const haystack = [
    item.title,
    item.invoice_number,
    item.supplier_name,
    item.supplier_tax_id,
    item.last_error,
    document?.file_name,
    document?.subject,
    document?.sender_email,
    document?.source_sha256,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  return haystack.includes(query.toLowerCase())
}

function itemMatchesFilters(item: ExpenseInvoiceIntakeListItem, filters: ExpenseInvoiceIntakeFilters) {
  if (filters.q && !itemMatchesSearch(item, filters.q)) {
    return false
  }

  if (filters.status && filters.status !== "all" && item.status !== filters.status) {
    return false
  }

  if (filters.supplier && filters.supplier !== "all" && item.supplier_id !== filters.supplier) {
    return false
  }

  if (filters.source && filters.source !== "all" && item.source_kind !== filters.source) {
    return false
  }

  return true
}

function composeListItems(
  items: ExpenseInvoiceIntakeItem[],
  documents: ExpenseInvoiceIntakeDocument[],
): ExpenseInvoiceIntakeListItem[] {
  const documentsByItem = new Map<string, ExpenseInvoiceIntakeDocument[]>()

  for (const document of documents) {
    const current = documentsByItem.get(document.item_id) ?? []
    current.push(document)
    documentsByItem.set(document.item_id, current)
  }

  return items.map((item) => {
    const itemDocuments = documentsByItem.get(item.id) ?? []
    return {
      ...item,
      document_count: itemDocuments.length,
      primary_document: itemDocuments[0] ?? null,
    }
  })
}

async function attachEventActorProfiles(events: ExpenseInvoiceIntakeEvent[]) {
  const actorIds = Array.from(
    new Set(events.map((event) => event.actor_user_id).filter((id): id is string => Boolean(id))),
  )

  if (actorIds.length === 0) {
    return events.map((event) => ({ ...event, actor_profile: null }))
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("user_profiles")
    .select("id, display_name, email")
    .in("id", actorIds)

  if (error) {
    throw error
  }

  const profileById = new Map(
    ((data ?? []) as UserProfileRow[]).map((profile) => [
      profile.id,
      {
        display_name: profile.display_name,
        email: profile.email,
      },
    ]),
  )

  return events.map((event) => ({
    ...event,
    actor_profile: event.actor_user_id ? profileById.get(event.actor_user_id) ?? null : null,
  }))
}

export async function listExpenseInvoiceIntake(filters: ExpenseInvoiceIntakeFilters): Promise<{
  items: ExpenseInvoiceIntakeListItem[]
  suppliers: ExpenseSupplierOption[]
  templates: ExpenseInvoiceSupplierTemplate[]
}> {
  const supabase = await createClient()
  await requireExpenseInvoiceIntakeAdmin(supabase)

  const [
    { data: itemData, error: itemError },
    { data: documentData, error: documentError },
    { data: supplierData, error: supplierError },
    { data: templateData, error: templateError },
  ] = await Promise.all([
    supabase
      .from("expense_invoice_intake_items")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("expense_invoice_intake_documents")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("suppliers")
      .select("id, tax_id, name, active")
      .order("active", { ascending: false })
      .order("name", { ascending: true })
      .limit(2000),
    supabase
      .from("expense_invoice_supplier_templates")
      .select("*")
      .eq("status", "active")
      .order("updated_at", { ascending: false }),
  ])

  if (itemError) throw itemError
  if (documentError) throw documentError
  if (supplierError) throw supplierError
  if (templateError) throw templateError

  const items = composeListItems(
    (itemData ?? []) as ExpenseInvoiceIntakeItem[],
    (documentData ?? []) as ExpenseInvoiceIntakeDocument[],
  ).filter((item) => itemMatchesFilters(item, filters))

  return {
    items,
    suppliers: (supplierData ?? []) as ExpenseSupplierOption[],
    templates: (templateData ?? []) as ExpenseInvoiceSupplierTemplate[],
  }
}

export async function getExpenseInvoiceIntakeDetail(itemId: string): Promise<ExpenseInvoiceIntakeDetail | null> {
  const supabase = await createClient()
  const user = await requireExpenseInvoiceIntakeAdmin(supabase, `/gastos/recepcion/${itemId}`)

  const [
    { data: itemData, error: itemError },
    { data: documentData, error: documentError },
    { data: supplierData, error: supplierError },
    { data: eventData, error: eventError },
  ] = await Promise.all([
    supabase
      .from("expense_invoice_intake_items")
      .select("*")
      .eq("id", itemId)
      .maybeSingle(),
    supabase
      .from("expense_invoice_intake_documents")
      .select("*")
      .eq("item_id", itemId)
      .order("created_at", { ascending: false }),
    supabase
      .from("suppliers")
      .select("id, tax_id, name, active")
      .order("active", { ascending: false })
      .order("name", { ascending: true })
      .limit(2000),
    supabase
      .from("expense_invoice_intake_events")
      .select("*")
      .eq("item_id", itemId)
      .order("created_at", { ascending: false }),
  ])

  if (itemError) throw itemError
  if (documentError) throw documentError
  if (supplierError) throw supplierError
  if (eventError) throw eventError

  if (!itemData) {
    return null
  }

  const events = await attachEventActorProfiles((eventData ?? []) as ExpenseInvoiceIntakeEvent[])

  return {
    user: user.user,
    item: itemData as ExpenseInvoiceIntakeItem,
    documents: (documentData ?? []) as ExpenseInvoiceIntakeDocument[],
    suppliers: (supplierData ?? []) as ExpenseSupplierOption[],
    events,
  }
}

export async function requireExpenseInvoiceIntakeDetail(itemId: string) {
  const detail = await getExpenseInvoiceIntakeDetail(itemId)

  if (!detail) {
    redirect("/gastos/recepcion")
  }

  return detail
}
