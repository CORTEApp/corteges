import { redirect } from "next/navigation"

import { requireAppUser } from "@/lib/clients/data"
import { createClient } from "@/lib/supabase/server"
import type {
  ExpenseIndividualDetail,
  ExpenseIndividualDocument,
  ExpenseIndividualFilters,
  ExpenseIndividualListItem,
  ExpenseIndividualRecord,
  ExpenseSupplierOption,
} from "@/lib/expenses/types"

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export async function requireExpenseUser(supabase?: SupabaseServerClient, nextPath = "/gastos/individuales") {
  return requireAppUser(supabase, nextPath)
}

function matchesSearch(expense: ExpenseIndividualRecord, query: string) {
  const haystack = [
    expense.title,
    expense.invoice_number,
    expense.supplier_name,
    expense.supplier_tax_id,
    expense.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  return haystack.includes(query.toLowerCase())
}

function matchesFilters(expense: ExpenseIndividualListItem, filters: ExpenseIndividualFilters) {
  if (filters.q && !matchesSearch(expense, filters.q)) {
    return false
  }

  if (filters.supplier && filters.supplier !== "all" && expense.supplier_id !== filters.supplier) {
    return false
  }

  if (filters.payment && filters.payment !== "all" && expense.payment_method !== filters.payment) {
    return false
  }

  if (filters.year && filters.year !== "all") {
    const year = expense.expense_date.slice(0, 4)
    if (year !== filters.year) {
      return false
    }
  }

  if (filters.month && filters.month !== "all") {
    const month = expense.expense_date.slice(5, 7)
    if (month !== filters.month.padStart(2, "0")) {
      return false
    }
  }

  return true
}

async function addDocumentCounts(
  supabase: SupabaseServerClient,
  expenses: ExpenseIndividualRecord[],
): Promise<ExpenseIndividualListItem[]> {
  if (expenses.length === 0) {
    return []
  }

  const expenseIds = expenses.map((expense) => expense.id)
  const { data, error } = await supabase
    .from("expense_individual_documents")
    .select("expense_id")
    .in("expense_id", expenseIds)

  if (error) {
    throw error
  }

  const counts = new Map<string, number>()
  for (const document of data ?? []) {
    const expenseId = document.expense_id as string
    counts.set(expenseId, (counts.get(expenseId) ?? 0) + 1)
  }

  return expenses.map((expense) => ({
    ...expense,
    document_count: counts.get(expense.id) ?? 0,
  }))
}

export async function listExpenseSupplierOptions(): Promise<ExpenseSupplierOption[]> {
  const supabase = await createClient()
  await requireExpenseUser(supabase)

  const { data, error } = await supabase
    .from("suppliers")
    .select("id, tax_id, name, active")
    .order("active", { ascending: false })
    .order("name", { ascending: true })
    .limit(2000)

  if (error) {
    throw error
  }

  return (data ?? []) as ExpenseSupplierOption[]
}

export async function listExpenseIndividuals(filters: ExpenseIndividualFilters): Promise<{
  user: Awaited<ReturnType<typeof requireExpenseUser>>
  expenses: ExpenseIndividualListItem[]
  suppliers: ExpenseSupplierOption[]
}> {
  const supabase = await createClient()
  const user = await requireExpenseUser(supabase)

  const [{ data: expenseData, error: expenseError }, { data: supplierData, error: supplierError }] = await Promise.all([
    supabase
      .from("expense_individuals")
      .select("*")
      .order("expense_date", { ascending: false })
      .order("invoice_number", { ascending: false })
      .limit(2000),
    supabase
      .from("suppliers")
      .select("id, tax_id, name, active")
      .order("active", { ascending: false })
      .order("name", { ascending: true })
      .limit(2000),
  ])

  if (expenseError) {
    throw expenseError
  }

  if (supplierError) {
    throw supplierError
  }

  const expensesWithCounts = await addDocumentCounts(supabase, (expenseData ?? []) as ExpenseIndividualRecord[])
  const expenses = expensesWithCounts.filter((expense) => matchesFilters(expense, filters))

  return {
    user,
    expenses,
    suppliers: (supplierData ?? []) as ExpenseSupplierOption[],
  }
}

export async function getExpenseIndividualDetail(expenseId: string): Promise<ExpenseIndividualDetail | null> {
  const supabase = await createClient()
  const user = await requireExpenseUser(supabase, `/gastos/individuales/${expenseId}`)

  const [{ data: expenseData, error: expenseError }, { data: documentsData, error: documentsError }] =
    await Promise.all([
      supabase
        .from("expense_individuals")
        .select("*")
        .eq("id", expenseId)
        .maybeSingle(),
      supabase
        .from("expense_individual_documents")
        .select("*")
        .eq("expense_id", expenseId)
        .order("created_at", { ascending: false }),
    ])

  if (expenseError) {
    throw expenseError
  }

  if (documentsError) {
    throw documentsError
  }

  if (!expenseData) {
    return null
  }

  return {
    user,
    expense: expenseData as ExpenseIndividualRecord,
    documents: (documentsData ?? []) as ExpenseIndividualDocument[],
  }
}

export async function requireExpenseIndividualDetail(expenseId: string) {
  const detail = await getExpenseIndividualDetail(expenseId)

  if (!detail) {
    redirect("/gastos/individuales")
  }

  return detail
}
