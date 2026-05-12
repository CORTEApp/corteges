import { redirect } from "next/navigation"

import { requireAppUser } from "@/lib/clients/data"
import { createClient } from "@/lib/supabase/server"
import type { SupplierDetail, SupplierFilters, SupplierListItem, SupplierRecord } from "@/lib/suppliers/types"

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export async function requireSupplierUser(supabase?: SupabaseServerClient, nextPath = "/proveedores") {
  return requireAppUser(supabase, nextPath)
}

function matchesSearch(supplier: SupplierRecord, query: string) {
  const haystack = [
    supplier.tax_id,
    supplier.name,
    supplier.contact_name,
    supplier.contact_phone,
    supplier.contact_email,
    supplier.sepa_reference,
    supplier.stripe_reference,
    supplier.comments,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  return haystack.includes(query.toLowerCase())
}

function matchesFilters(supplier: SupplierListItem, filters: SupplierFilters) {
  if (filters.q && !matchesSearch(supplier, filters.q)) {
    return false
  }

  if (filters.active === "active" && !supplier.active) {
    return false
  }

  if (filters.active === "inactive" && supplier.active) {
    return false
  }

  if (filters.payment && filters.payment !== "all" && supplier.payment_method !== filters.payment) {
    return false
  }

  return true
}

export async function listSuppliers(filters: SupplierFilters): Promise<{
  user: Awaited<ReturnType<typeof requireSupplierUser>>
  suppliers: SupplierListItem[]
}> {
  const supabase = await createClient()
  const user = await requireSupplierUser(supabase)

  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .order("name", { ascending: true })
    .limit(1000)

  if (error) {
    throw error
  }

  const suppliers = ((data ?? []) as SupplierRecord[]).filter((supplier) => matchesFilters(supplier, filters))

  return { user, suppliers }
}

export async function getSupplierDetail(supplierId: string): Promise<SupplierDetail | null> {
  const supabase = await createClient()
  const user = await requireSupplierUser(supabase, `/proveedores/${supplierId}`)

  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", supplierId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  return {
    user,
    supplier: data as SupplierRecord,
  }
}

export async function requireSupplierDetail(supplierId: string) {
  const detail = await getSupplierDetail(supplierId)

  if (!detail) {
    redirect("/proveedores")
  }

  return detail
}
