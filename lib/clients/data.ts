import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import type {
  AppUser,
  ClientDetail,
  ClientDocument,
  ClientFilters,
  ClientHistoryEntry,
  ClientListItem,
  ClientRecord,
} from "@/lib/clients/types"

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export async function requireAppUser(
  supabase?: SupabaseServerClient,
  nextPath = "/clientes",
): Promise<AppUser> {
  const client = supabase ?? (await createClient())
  const {
    data: { user },
  } = await client.auth.getUser()

  if (!user) {
    redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`)
  }

  return {
    id: user.id,
    email: user.email ?? null,
  }
}

function matchesSearch(client: ClientRecord, query: string) {
  const haystack = [
    client.tax_id,
    client.name,
    client.contact_name,
    client.contact_phone,
    client.contact_email,
    client.billing_email,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  return haystack.includes(query.toLowerCase())
}

function matchesFilters(item: ClientListItem, filters: ClientFilters) {
  if (filters.q && !matchesSearch(item, filters.q)) {
    return false
  }

  if (filters.active === "active" && !item.active) {
    return false
  }

  if (filters.active === "inactive" && item.active) {
    return false
  }

  if (filters.payment && filters.payment !== "all" && item.payment_method !== filters.payment) {
    return false
  }

  return true
}

export async function listClients(filters: ClientFilters): Promise<{
  user: AppUser
  clients: ClientListItem[]
}> {
  const supabase = await createClient()
  const user = await requireAppUser(supabase)

  const { data: clientsData, error } = await supabase
    .from("clients")
    .select("*")
    .order("name", { ascending: true })
    .limit(500)

  if (error) {
    throw error
  }

  const clients = (clientsData ?? []) as ClientRecord[]
  const clientIds = clients.map((client) => client.id)

  if (clientIds.length === 0) {
    return { user, clients: [] }
  }

  const [
    { data: documentsData, error: documentsError },
    { data: historyData, error: historyError },
  ] =
    await Promise.all([
      supabase.from("client_documents").select("id, client_id").in("client_id", clientIds),
      supabase.from("client_history_entries").select("id, client_id").in("client_id", clientIds),
    ])

  if (documentsError) {
    throw documentsError
  }

  if (historyError) {
    throw historyError
  }

  const documents = (documentsData ?? []) as { id: string; client_id: string }[]
  const history = (historyData ?? []) as { id: string; client_id: string }[]

  const documentsByClient = new Map<string, number>()
  const historyByClient = new Map<string, number>()

  for (const document of documents) {
    documentsByClient.set(document.client_id, (documentsByClient.get(document.client_id) ?? 0) + 1)
  }

  for (const entry of history) {
    historyByClient.set(entry.client_id, (historyByClient.get(entry.client_id) ?? 0) + 1)
  }

  const items = clients
    .map<ClientListItem>((client) => ({
      ...client,
      document_count: documentsByClient.get(client.id) ?? 0,
      history_count: historyByClient.get(client.id) ?? 0,
    }))
    .filter((item) => matchesFilters(item, filters))

  return { user, clients: items }
}

export async function getClientDetail(clientId: string): Promise<ClientDetail | null> {
  const supabase = await createClient()
  const user = await requireAppUser(supabase, `/clientes/${clientId}`)

  const { data: clientData, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!clientData) {
    return null
  }

  const [
    { data: documentsData, error: documentsError },
    { data: historyData, error: historyError },
  ] =
    await Promise.all([
      supabase
        .from("client_documents")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false }),
      supabase
        .from("client_history_entries")
        .select("*")
        .eq("client_id", clientId)
        .order("is_current", { ascending: false })
        .order("source_modified_at", { ascending: false, nullsFirst: false })
        .order("sharepoint_item_id", { ascending: false }),
    ])

  if (documentsError) {
    throw documentsError
  }

  if (historyError) {
    throw historyError
  }

  return {
    user,
    client: clientData as ClientRecord,
    documents: (documentsData ?? []) as ClientDocument[],
    history: (historyData ?? []) as ClientHistoryEntry[],
  }
}
