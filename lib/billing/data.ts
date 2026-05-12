import { redirect } from "next/navigation"

import { requireAppUser } from "@/lib/clients/data"
import { createClient } from "@/lib/supabase/server"
import type {
  BillingClientOption,
  BillingDocument,
  BillingDocumentDetail,
  BillingDocumentFile,
  BillingDocumentFilters,
  BillingDocumentLine,
  BillingDocumentListItem,
  BillingDocumentType,
  BillingFacturable,
  BillingFacturableOption,
  BillingFacturableDetail,
  BillingFacturableFilters,
  BillingPayment,
  BillingSubscription,
  BillingSubscriptionDetail,
  BillingSubscriptionFilters,
  BillingSubscriptionFormOptions,
} from "@/lib/billing/types"

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

function matchesSearch(facturable: BillingFacturable, query: string) {
  const haystack = [facturable.code, facturable.description, facturable.type, facturable.unit_type, facturable.comments]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  return haystack.includes(query.toLowerCase())
}

function matchesFilters(facturable: BillingFacturable, filters: BillingFacturableFilters) {
  if (filters.q && !matchesSearch(facturable, filters.q)) {
    return false
  }

  if (filters.active === "active" && !facturable.active) {
    return false
  }

  if (filters.active === "inactive" && facturable.active) {
    return false
  }

  if (filters.current === "current" && !facturable.is_current) {
    return false
  }

  if (filters.current === "history" && facturable.is_current) {
    return false
  }

  if (filters.type && filters.type !== "all" && facturable.type !== filters.type) {
    return false
  }

  if (filters.unitType && filters.unitType !== "all" && facturable.unit_type !== filters.unitType) {
    return false
  }

  return true
}

export async function requireBillingUser(
  supabase?: SupabaseServerClient,
  nextPath = "/facturacion/facturables",
) {
  return requireAppUser(supabase, nextPath)
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function getSubscriptionStatus(
  subscription: Pick<BillingSubscription, "start_date" | "end_date">,
  today = todayISO(),
) {
  if (subscription.start_date > today) {
    return "future" as const
  }

  if (subscription.end_date && subscription.end_date < today) {
    return "history" as const
  }

  return "active" as const
}

function matchesSubscriptionSearch(subscription: BillingSubscription, query: string) {
  const haystack = [
    subscription.client_name,
    subscription.client_tax_id,
    subscription.billing_email,
    subscription.subscription_code,
    subscription.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  return haystack.includes(query.toLowerCase())
}

function matchesSubscriptionFilters(subscription: BillingSubscription, filters: BillingSubscriptionFilters) {
  if (filters.q && !matchesSubscriptionSearch(subscription, filters.q)) {
    return false
  }

  const status = filters.status ?? "active"
  if (status !== "all" && getSubscriptionStatus(subscription) !== status) {
    return false
  }

  return true
}

export async function listSubscriptions(filters: BillingSubscriptionFilters): Promise<{
  user: Awaited<ReturnType<typeof requireBillingUser>>
  subscriptions: BillingSubscription[]
}> {
  const supabase = await createClient()
  const user = await requireBillingUser(supabase, "/facturacion/suscripciones")

  const { data, error } = await supabase
    .from("billing_subscriptions")
    .select("*")
    .order("start_date", { ascending: false })
    .order("client_name", { ascending: true })
    .limit(1000)

  if (error) {
    throw error
  }

  const subscriptions = ((data ?? []) as BillingSubscription[]).filter((subscription) =>
    matchesSubscriptionFilters(subscription, filters),
  )

  return { user, subscriptions }
}

export async function getSubscriptionDetail(subscriptionId: string): Promise<BillingSubscriptionDetail | null> {
  const supabase = await createClient()
  const user = await requireBillingUser(supabase, `/facturacion/suscripciones/${subscriptionId}`)

  const { data, error } = await supabase
    .from("billing_subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  return {
    user,
    subscription: data as BillingSubscription,
  }
}

export async function requireSubscriptionDetail(subscriptionId: string) {
  const detail = await getSubscriptionDetail(subscriptionId)

  if (!detail) {
    redirect("/facturacion/suscripciones")
  }

  return detail
}

export async function listFacturables(filters: BillingFacturableFilters): Promise<{
  user: Awaited<ReturnType<typeof requireBillingUser>>
  facturables: BillingFacturable[]
}> {
  const supabase = await createClient()
  const user = await requireBillingUser(supabase)

  const { data, error } = await supabase
    .from("billing_facturables")
    .select("*")
    .order("code", { ascending: true })
    .limit(1000)

  if (error) {
    throw error
  }

  const facturables = ((data ?? []) as BillingFacturable[]).filter((facturable) =>
    matchesFilters(facturable, filters),
  )

  return { user, facturables }
}

export async function getFacturableDetail(facturableId: string): Promise<BillingFacturableDetail | null> {
  const supabase = await createClient()
  const user = await requireBillingUser(supabase, `/facturacion/facturables/${facturableId}`)

  const { data, error } = await supabase
    .from("billing_facturables")
    .select("*")
    .eq("id", facturableId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  return {
    user,
    facturable: data as BillingFacturable,
  }
}

export async function listFacturableCodes(excludeId?: string) {
  const supabase = await createClient()
  await requireBillingUser(supabase)

  let query = supabase
    .from("billing_facturables")
    .select("id, code")
    .order("code", { ascending: true })

  if (excludeId) {
    query = query.neq("id", excludeId)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return (data ?? [])
    .map((row) => row.code)
    .filter((code): code is string => typeof code === "string" && code.trim().length > 0)
}

export async function requireFacturableDetail(facturableId: string) {
  const detail = await getFacturableDetail(facturableId)

  if (!detail) {
    redirect("/facturacion/facturables")
  }

  return detail
}

function matchesDocumentSearch(document: BillingDocument, query: string) {
  const haystack = [
    document.document_number,
    document.client_name,
    document.client_tax_id,
    document.billing_email,
    document.project,
    document.observations,
    document.source_proforma_number,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  return haystack.includes(query.toLowerCase())
}

function matchesDocumentFilters(document: BillingDocument, filters: BillingDocumentFilters) {
  if (filters.q && !matchesDocumentSearch(document, filters.q)) {
    return false
  }

  if (filters.status && filters.status !== "all" && document.status !== filters.status) {
    return false
  }

  if (filters.payment && filters.payment !== "all" && document.payment_status !== filters.payment) {
    return false
  }

  return true
}

export async function listBillingDocuments(
  documentType: BillingDocumentType,
  filters: BillingDocumentFilters,
): Promise<{
  user: Awaited<ReturnType<typeof requireBillingUser>>
  documents: BillingDocumentListItem[]
}> {
  const supabase = await createClient()
  const user = await requireBillingUser(supabase, `/facturacion/${documentType === "proforma" ? "proformas" : "facturas"}`)

  const { data, error } = await supabase
    .from("billing_documents")
    .select("*")
    .eq("document_type", documentType)
    .order("issue_date", { ascending: false })
    .order("number_value", { ascending: false })
    .limit(1000)

  if (error) {
    throw error
  }

  const documents = ((data ?? []) as BillingDocument[]).filter((document) =>
    matchesDocumentFilters(document, filters),
  )
  const documentIds = documents.map((document) => document.id)

  if (documentIds.length === 0) {
    return { user, documents: [] }
  }

  const [
    { data: linesData, error: linesError },
    { data: invoicesData, error: invoicesError },
  ] = await Promise.all([
    supabase.from("billing_document_lines").select("id, document_id").in("document_id", documentIds),
    documentType === "proforma"
      ? supabase
          .from("billing_documents")
          .select("id, source_proforma_id")
          .eq("document_type", "invoice")
          .in("source_proforma_id", documentIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (linesError) {
    throw linesError
  }

  if (invoicesError) {
    throw invoicesError
  }

  const lineCounts = new Map<string, number>()
  for (const line of (linesData ?? []) as { id: string; document_id: string }[]) {
    lineCounts.set(line.document_id, (lineCounts.get(line.document_id) ?? 0) + 1)
  }

  const invoiceByProforma = new Map<string, string>()
  for (const invoice of (invoicesData ?? []) as { id: string; source_proforma_id: string | null }[]) {
    if (invoice.source_proforma_id) {
      invoiceByProforma.set(invoice.source_proforma_id, invoice.id)
    }
  }

  return {
    user,
    documents: documents.map((document) => ({
      ...document,
      line_count: lineCounts.get(document.id) ?? 0,
      related_invoice_id: invoiceByProforma.get(document.id) ?? null,
    })),
  }
}

export async function getBillingDocumentDetail(
  documentId: string,
  expectedType?: BillingDocumentType,
): Promise<BillingDocumentDetail | null> {
  const supabase = await createClient()
  const user = await requireBillingUser(
    supabase,
    `/facturacion/${expectedType === "invoice" ? "facturas" : "proformas"}/${documentId}`,
  )

  let documentQuery = supabase
    .from("billing_documents")
    .select("*")
    .eq("id", documentId)

  if (expectedType) {
    documentQuery = documentQuery.eq("document_type", expectedType)
  }

  const { data: documentData, error } = await documentQuery.maybeSingle()

  if (error) {
    throw error
  }

  if (!documentData) {
    return null
  }

  const document = documentData as BillingDocument
  const [
    { data: linesData, error: linesError },
    { data: paymentsData, error: paymentsError },
    { data: filesData, error: filesError },
    { data: sourceProformaData, error: sourceProformaError },
    { data: generatedInvoiceData, error: generatedInvoiceError },
  ] = await Promise.all([
    supabase
      .from("billing_document_lines")
      .select("*")
      .eq("document_id", document.id)
      .order("line_index", { ascending: true }),
    supabase
      .from("billing_payments")
      .select("*")
      .eq("proforma_id", document.id)
      .order("payment_date", { ascending: false }),
    supabase
      .from("billing_document_files")
      .select("*")
      .eq("document_id", document.id)
      .order("created_at", { ascending: false }),
    document.source_proforma_id
      ? supabase
          .from("billing_documents")
          .select("*")
          .eq("id", document.source_proforma_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    document.document_type === "proforma"
      ? supabase
          .from("billing_documents")
          .select("*")
          .eq("document_type", "invoice")
          .eq("source_proforma_id", document.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (linesError) {
    throw linesError
  }

  if (paymentsError) {
    throw paymentsError
  }

  if (filesError) {
    throw filesError
  }

  if (sourceProformaError) {
    throw sourceProformaError
  }

  if (generatedInvoiceError) {
    throw generatedInvoiceError
  }

  return {
    user,
    document,
    lines: (linesData ?? []) as BillingDocumentLine[],
    payments: (paymentsData ?? []) as BillingPayment[],
    files: (filesData ?? []) as BillingDocumentFile[],
    sourceProforma: (sourceProformaData as BillingDocument | null) ?? null,
    generatedInvoice: (generatedInvoiceData as BillingDocument | null) ?? null,
  }
}

export async function requireBillingDocumentDetail(documentId: string, expectedType: BillingDocumentType) {
  const detail = await getBillingDocumentDetail(documentId, expectedType)

  if (!detail) {
    redirect(`/facturacion/${expectedType === "invoice" ? "facturas" : "proformas"}`)
  }

  return detail
}

export async function listBillingClients(): Promise<BillingClientOption[]> {
  const supabase = await createClient()
  await requireBillingUser(supabase, "/facturacion/proformas/nuevo")

  const { data, error } = await supabase
    .from("clients")
    .select("id, name, tax_id, billing_email, payment_method")
    .eq("active", true)
    .order("name", { ascending: true })
    .limit(500)

  if (error) {
    throw error
  }

  return (data ?? []) as BillingClientOption[]
}

export async function listBillingFacturableOptions(): Promise<BillingFacturableOption[]> {
  const supabase = await createClient()
  await requireBillingUser(supabase, "/facturacion/proformas/nuevo")

  const { data, error } = await supabase
    .from("billing_facturables")
    .select("id, code, description, unit_price, unit_type")
    .eq("active", true)
    .eq("is_current", true)
    .order("code", { ascending: true })
    .limit(500)

  if (error) {
    throw error
  }

  return (data ?? []) as BillingFacturableOption[]
}

export async function listSubscriptionFormOptions(
  subscription?: BillingSubscription,
): Promise<BillingSubscriptionFormOptions> {
  const supabase = await createClient()
  await requireBillingUser(supabase, subscription ? `/facturacion/suscripciones/${subscription.id}/edit` : "/facturacion/suscripciones/nuevo")

  const [
    { data: clientsData, error: clientsError },
    { data: facturablesData, error: facturablesError },
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, tax_id, billing_email, payment_method")
      .eq("active", true)
      .order("name", { ascending: true })
      .limit(500),
    supabase
      .from("billing_facturables")
      .select("id, code, description, unit_price, unit_type")
      .eq("active", true)
      .eq("is_current", true)
      .order("code", { ascending: true })
      .limit(500),
  ])

  if (clientsError) {
    throw clientsError
  }

  if (facturablesError) {
    throw facturablesError
  }

  const clients = [...((clientsData ?? []) as BillingClientOption[])]
  const facturables = [...((facturablesData ?? []) as BillingFacturableOption[])]

  if (subscription?.client_id && !clients.some((client) => client.id === subscription.client_id)) {
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, tax_id, billing_email, payment_method")
      .eq("id", subscription.client_id)
      .maybeSingle()

    if (error) {
      throw error
    }
    if (data) {
      clients.unshift(data as BillingClientOption)
    }
  }

  if (subscription?.facturable_id && !facturables.some((facturable) => facturable.id === subscription.facturable_id)) {
    const { data, error } = await supabase
      .from("billing_facturables")
      .select("id, code, description, unit_price, unit_type")
      .eq("id", subscription.facturable_id)
      .maybeSingle()

    if (error) {
      throw error
    }
    if (data) {
      facturables.unshift(data as BillingFacturableOption)
    }
  }

  return { clients, facturables }
}

export async function getBillingNumberPreview(documentType: BillingDocumentType, year = new Date().getFullYear()) {
  const supabase = await createClient()
  await requireBillingUser(supabase)
  const series = documentType === "proforma" ? "P" : "F"

  const { data, error } = await supabase
    .from("billing_number_sequences")
    .select("last_value")
    .eq("document_type", documentType)
    .eq("series", series)
    .eq("number_year", year)
    .maybeSingle()

  if (error) {
    throw error
  }

  const nextValue = Number((data as { last_value?: number } | null)?.last_value ?? 0) + 1
  return `${series}-${year}/${nextValue}`
}
