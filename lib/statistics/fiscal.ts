import "server-only"

import { requireAppUser } from "@/lib/clients/data"
import { createClient } from "@/lib/supabase/server"

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export const FISCAL_PERIODS = [
  { id: "t1", label: "T1", months: [1, 2, 3], description: "Enero - marzo" },
  { id: "t2", label: "T2", months: [4, 5, 6], description: "Abril - junio" },
  { id: "t3", label: "T3", months: [7, 8, 9], description: "Julio - septiembre" },
  { id: "t4", label: "T4", months: [10, 11, 12], description: "Octubre - diciembre" },
  { id: "annual", label: "Anual", months: [1, 12], description: "Ejercicio completo" },
] as const

export const FISCAL_VIEWS = [
  { id: "gastos", label: "Gastos" },
  { id: "ingresos", label: "Ingresos" },
  { id: "impuestos", label: "Declaracion de impuestos" },
] as const

export type FiscalPeriodId = (typeof FISCAL_PERIODS)[number]["id"]
export type FiscalViewId = (typeof FISCAL_VIEWS)[number]["id"]

export type FiscalIrpfBracket = {
  upTo: number | null
  rate: number
}

export type FiscalTaxSettings = {
  id: string | null
  taxYear: number
  active: boolean
  profileLabel: string
  irpfBrackets: FiscalIrpfBracket[]
  sourceNote: string | null
  source: "database" | "default"
}

export type FiscalIncomeRow = {
  id: string
  documentNumber: string
  clientName: string
  clientTaxId: string | null
  project: string | null
  issueDate: string
  subtotalAmount: number
  taxAmount: number
  totalAmount: number
  status: string
  paymentStatus: string
}

export type FiscalExpenseRow = {
  id: string
  title: string
  supplierName: string
  supplierTaxId: string
  invoiceNumber: string
  expenseDate: string
  paymentMethod: string
  netAmount: number
  vatRate: number
  taxAmount: number
  totalAmount: number
}

export type FiscalTotals = {
  incomeSubtotal: number
  incomeTax: number
  incomeTotal: number
  expenseSubtotal: number
  expenseTax: number
  expenseTotal: number
  vatNet: number
  profit: number
  irpfEstimate: number
  reserveEstimate: number
  appliedIrpfBracket: FiscalIrpfBracket | null
  appliedIrpfBracketLabel: string
}

export type FiscalBillingStatistics = {
  taxYear: number
  period: (typeof FISCAL_PERIODS)[number]
  view: (typeof FISCAL_VIEWS)[number]
  range: { start: string; end: string }
  settings: FiscalTaxSettings
  incomes: FiscalIncomeRow[]
  expenses: FiscalExpenseRow[]
  totals: FiscalTotals
}

export const DEFAULT_IRPF_BRACKETS: FiscalIrpfBracket[] = [
  { upTo: 12450, rate: 19 },
  { upTo: 20200, rate: 24 },
  { upTo: 35200, rate: 30 },
  { upTo: 60000, rate: 37 },
  { upTo: 300000, rate: 45 },
  { upTo: null, rate: 47 },
]

const EXCLUDED_INVOICE_STATUSES = new Set(["cancelled", "discarded"])

function pad(value: number) {
  return String(value).padStart(2, "0")
}

export function currentFiscalYear() {
  return new Date().getFullYear()
}

export function normalizeFiscalYear(value: string | string[] | undefined, fallback = currentFiscalYear()) {
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = Number.parseInt(raw ?? "", 10)
  if (!Number.isFinite(parsed) || parsed < 2000 || parsed > 2200) {
    return fallback
  }

  return parsed
}

export function normalizeFiscalPeriod(value: string | string[] | undefined): FiscalPeriodId {
  const raw = Array.isArray(value) ? value[0] : value
  return FISCAL_PERIODS.some((period) => period.id === raw) ? (raw as FiscalPeriodId) : "t1"
}

export function normalizeFiscalView(value: string | string[] | undefined): FiscalViewId {
  const raw = Array.isArray(value) ? value[0] : value
  return FISCAL_VIEWS.some((view) => view.id === raw) ? (raw as FiscalViewId) : "gastos"
}

export function getFiscalPeriod(periodId: FiscalPeriodId) {
  return FISCAL_PERIODS.find((period) => period.id === periodId) ?? FISCAL_PERIODS[0]
}

export function getFiscalView(viewId: FiscalViewId) {
  return FISCAL_VIEWS.find((view) => view.id === viewId) ?? FISCAL_VIEWS[0]
}

export function fiscalPeriodDateRange(year: number, periodId: FiscalPeriodId) {
  const period = getFiscalPeriod(periodId)
  const startMonth = period.id === "annual" ? 1 : period.months[0]
  const endMonth = period.id === "annual" ? 12 : period.months[period.months.length - 1]
  const endDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate()

  return {
    start: `${year}-${pad(startMonth)}-01`,
    end: `${year}-${pad(endMonth)}-${pad(endDay)}`,
  }
}

export function fiscalUrl({
  view,
  period,
  year,
}: {
  view: FiscalViewId
  period: FiscalPeriodId
  year: number
}) {
  const params = new URLSearchParams({
    vista: view,
    periodo: period,
    year: String(year),
  })

  return `/estadisticas/facturacion?${params.toString()}`
}

export function fiscalExportUrl({
  view,
  period,
  year,
}: {
  view: FiscalViewId
  period: FiscalPeriodId
  year: number
}) {
  const params = new URLSearchParams({
    periodo: period,
    year: String(year),
  })

  return `/estadisticas/facturacion/export/${view}?${params.toString()}`
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(",", "."))
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function normalizeBracket(value: unknown): FiscalIrpfBracket | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const record = value as { up_to?: unknown; upTo?: unknown; rate?: unknown }
  const rawUpTo = record.up_to ?? record.upTo
  const upTo =
    rawUpTo === null || rawUpTo === "" || rawUpTo === undefined
      ? null
      : toNumber(rawUpTo as number | string)
  const rate = toNumber(record.rate as number | string)

  if ((upTo !== null && upTo <= 0) || rate < 0 || rate > 100) {
    return null
  }

  return { upTo, rate }
}

export function normalizeIrpfBrackets(value: unknown, fallback = DEFAULT_IRPF_BRACKETS) {
  if (!Array.isArray(value)) {
    return fallback
  }

  const brackets = value
    .map(normalizeBracket)
    .filter((bracket): bracket is FiscalIrpfBracket => Boolean(bracket))
    .sort((a, b) => {
      if (a.upTo === null) return 1
      if (b.upTo === null) return -1
      return a.upTo - b.upTo
    })

  if (brackets.length === 0) {
    return fallback
  }

  const hasOpenBracket = brackets.some((bracket) => bracket.upTo === null)
  return hasOpenBracket ? brackets : [...brackets, { upTo: null, rate: brackets.at(-1)?.rate ?? 0 }]
}

function defaultFiscalTaxSettings(taxYear: number): FiscalTaxSettings {
  return {
    id: null,
    taxYear,
    active: true,
    profileLabel: `Estimacion IRPF general ${taxYear}`,
    irpfBrackets: DEFAULT_IRPF_BRACKETS,
    sourceNote: "Perfil estimativo editable. No sustituye la liquidacion oficial ni las tablas autonomicas aplicables.",
    source: "default",
  }
}

export async function getFiscalTaxSettingsForYear(
  taxYear: number,
  supabase?: SupabaseServerClient,
): Promise<FiscalTaxSettings> {
  const client = supabase ?? (await createClient())
  const { data, error } = await client
    .from("fiscal_tax_settings")
    .select("*")
    .eq("tax_year", taxYear)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return defaultFiscalTaxSettings(taxYear)
  }

  const row = data as {
    id: string
    tax_year: number
    active: boolean
    profile_label: string
    irpf_brackets: unknown
    source_note: string | null
  }

  return {
    id: row.id,
    taxYear: row.tax_year,
    active: row.active,
    profileLabel: row.profile_label,
    irpfBrackets: normalizeIrpfBrackets(row.irpf_brackets),
    sourceNote: row.source_note,
    source: "database",
  }
}

function calculateProgressiveIrpf(base: number, brackets: FiscalIrpfBracket[]) {
  if (base <= 0) {
    return {
      amount: 0,
      appliedBracket: null,
    }
  }

  let lower = 0
  let amount = 0
  let appliedBracket: FiscalIrpfBracket | null = null

  for (const bracket of brackets) {
    const upper = bracket.upTo ?? Number.POSITIVE_INFINITY
    const taxable = Math.max(0, Math.min(base, upper) - lower)

    if (taxable > 0) {
      amount += taxable * (bracket.rate / 100)
      appliedBracket = bracket
    }

    lower = upper
    if (base <= upper) {
      break
    }
  }

  return {
    amount: roundMoney(amount),
    appliedBracket,
  }
}

function bracketLabel(bracket: FiscalIrpfBracket | null, base: number) {
  if (!bracket || base <= 0) {
    return "Sin beneficio positivo"
  }

  const limit = bracket.upTo === null ? "sin limite" : `hasta ${formatFiscalAmount(bracket.upTo)}`
  return `${formatFiscalPercent(bracket.rate)} ${limit}`
}

function sumRows<T>(rows: T[], selector: (row: T) => number) {
  return roundMoney(rows.reduce((total, row) => total + selector(row), 0))
}

function mapExpense(row: {
  id: string
  title: string
  supplier_name: string
  supplier_tax_id: string
  invoice_number: string
  expense_date: string
  payment_method: string
  net_amount: number | string | null
  vat_rate: number | string
  total_amount: number | string
}): FiscalExpenseRow {
  const totalAmount = roundMoney(toNumber(row.total_amount))
  const vatRate = toNumber(row.vat_rate)
  const netAmount =
    row.net_amount === null && vatRate > 0
      ? roundMoney(totalAmount / (1 + vatRate / 100))
      : roundMoney(toNumber(row.net_amount ?? totalAmount))
  const taxAmount = roundMoney(totalAmount - netAmount)

  return {
    id: row.id,
    title: row.title,
    supplierName: row.supplier_name,
    supplierTaxId: row.supplier_tax_id,
    invoiceNumber: row.invoice_number,
    expenseDate: row.expense_date,
    paymentMethod: row.payment_method,
    netAmount,
    vatRate,
    taxAmount,
    totalAmount,
  }
}

function mapIncome(row: {
  id: string
  document_number: string
  client_name: string
  client_tax_id: string | null
  project: string | null
  issue_date: string
  subtotal_amount: number | string
  tax_amount: number | string
  total_amount: number | string
  status: string
  payment_status: string
}): FiscalIncomeRow {
  const subtotalAmount = roundMoney(toNumber(row.subtotal_amount))
  const totalAmount = roundMoney(toNumber(row.total_amount))
  const storedTaxAmount = roundMoney(toNumber(row.tax_amount))
  const balances = Math.abs(roundMoney(subtotalAmount + storedTaxAmount) - totalAmount) <= 0.02
  const derivedTaxAmount = roundMoney(totalAmount - subtotalAmount)
  const taxAmount = balances || derivedTaxAmount < 0 ? storedTaxAmount : derivedTaxAmount

  return {
    id: row.id,
    documentNumber: row.document_number,
    clientName: row.client_name,
    clientTaxId: row.client_tax_id,
    project: row.project,
    issueDate: row.issue_date,
    subtotalAmount,
    taxAmount,
    totalAmount,
    status: row.status,
    paymentStatus: row.payment_status,
  }
}

function calculateTotals(
  incomes: FiscalIncomeRow[],
  expenses: FiscalExpenseRow[],
  settings: FiscalTaxSettings,
): FiscalTotals {
  const incomeSubtotal = sumRows(incomes, (row) => row.subtotalAmount)
  const incomeTax = sumRows(incomes, (row) => row.taxAmount)
  const incomeTotal = sumRows(incomes, (row) => row.totalAmount)
  const expenseSubtotal = sumRows(expenses, (row) => row.netAmount)
  const expenseTax = sumRows(expenses, (row) => row.taxAmount)
  const expenseTotal = sumRows(expenses, (row) => row.totalAmount)
  const vatNet = roundMoney(incomeTax - expenseTax)
  const profit = roundMoney(incomeSubtotal - expenseSubtotal)
  const { amount: irpfEstimate, appliedBracket } = calculateProgressiveIrpf(profit, settings.irpfBrackets)
  const reserveEstimate = roundMoney(Math.max(0, vatNet) + irpfEstimate)

  return {
    incomeSubtotal,
    incomeTax,
    incomeTotal,
    expenseSubtotal,
    expenseTax,
    expenseTotal,
    vatNet,
    profit,
    irpfEstimate,
    reserveEstimate,
    appliedIrpfBracket: appliedBracket,
    appliedIrpfBracketLabel: bracketLabel(appliedBracket, profit),
  }
}

export async function listFiscalBillingStatistics({
  taxYear,
  periodId,
  viewId,
  nextPath = "/estadisticas/facturacion",
}: {
  taxYear: number
  periodId: FiscalPeriodId
  viewId: FiscalViewId
  nextPath?: string
}): Promise<FiscalBillingStatistics> {
  const supabase = await createClient()
  await requireAppUser(supabase, nextPath)

  const range = fiscalPeriodDateRange(taxYear, periodId)
  const [settings, incomeResult, expenseResult] = await Promise.all([
    getFiscalTaxSettingsForYear(taxYear, supabase),
    supabase
      .from("billing_documents")
      .select("id, document_number, client_name, client_tax_id, project, issue_date, subtotal_amount, tax_amount, total_amount, status, payment_status")
      .eq("document_type", "invoice")
      .gte("issue_date", range.start)
      .lte("issue_date", range.end)
      .order("issue_date", { ascending: false })
      .order("number_value", { ascending: false })
      .limit(5000),
    supabase
      .from("expense_individuals")
      .select("id, title, supplier_name, supplier_tax_id, invoice_number, expense_date, payment_method, net_amount, vat_rate, total_amount")
      .gte("expense_date", range.start)
      .lte("expense_date", range.end)
      .order("expense_date", { ascending: false })
      .order("invoice_number", { ascending: false })
      .limit(5000),
  ])

  if (incomeResult.error) {
    throw incomeResult.error
  }

  if (expenseResult.error) {
    throw expenseResult.error
  }

  const incomes = ((incomeResult.data ?? []) as Parameters<typeof mapIncome>[0][])
    .filter((row) => !EXCLUDED_INVOICE_STATUSES.has(row.status))
    .map(mapIncome)
  const expenses = ((expenseResult.data ?? []) as Parameters<typeof mapExpense>[0][]).map(mapExpense)

  return {
    taxYear,
    period: getFiscalPeriod(periodId),
    view: getFiscalView(viewId),
    range,
    settings,
    incomes,
    expenses,
    totals: calculateTotals(incomes, expenses, settings),
  }
}

export async function upsertFiscalTaxSettings(input: {
  taxYear: number
  profileLabel: string
  irpfBrackets: FiscalIrpfBracket[]
  sourceNote?: string | null
  actorUserId?: string | null
}) {
  const taxYear = Math.trunc(input.taxYear)
  if (!Number.isFinite(taxYear) || taxYear < 2000 || taxYear > 2200) {
    throw new Error("El año fiscal no es valido.")
  }

  const profileLabel = input.profileLabel.trim()
  if (!profileLabel) {
    throw new Error("La etiqueta fiscal es obligatoria.")
  }

  const irpfBrackets = normalizeIrpfBrackets(input.irpfBrackets, [])
  if (!irpfBrackets.length) {
    throw new Error("Define al menos un tramo IRPF.")
  }

  let previousLimit = 0
  for (const bracket of irpfBrackets) {
    if (bracket.upTo !== null) {
      if (bracket.upTo <= previousLimit) {
        throw new Error("Los limites de IRPF deben ser crecientes.")
      }
      previousLimit = bracket.upTo
    }
    if (bracket.rate < 0 || bracket.rate > 100) {
      throw new Error("Los tipos IRPF deben estar entre 0 y 100.")
    }
  }

  const supabase = await createClient()
  const { error: deactivateError } = await supabase
    .from("fiscal_tax_settings")
    .update({ active: false, updated_by: input.actorUserId ?? null })
    .eq("active", true)
    .neq("tax_year", taxYear)

  if (deactivateError) {
    throw deactivateError
  }

  const payload = {
    tax_year: taxYear,
    active: true,
    profile_label: profileLabel,
    irpf_brackets: irpfBrackets.map((bracket) => ({ up_to: bracket.upTo, rate: bracket.rate })),
    source_note: input.sourceNote?.trim() || null,
    updated_by: input.actorUserId ?? null,
  }

  const { data, error } = await supabase
    .from("fiscal_tax_settings")
    .upsert(
      {
        ...payload,
        created_by: input.actorUserId ?? null,
      },
      { onConflict: "tax_year" },
    )
    .select("*")
    .single()

  if (error) {
    throw error
  }

  return data
}

const amountFormatter = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const percentFormatter = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function formatFiscalAmount(value: number | string | null | undefined) {
  return `${amountFormatter.format(toNumber(value))} €`
}

export function formatFiscalPercent(value: number | string | null | undefined) {
  return `${percentFormatter.format(toNumber(value))} %`
}

export function formatFiscalDate(value?: string | null) {
  if (!value) {
    return "-"
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value))
}

function csvCell(value: unknown) {
  const normalized = value == null ? "" : String(value)
  return `"${normalized.replace(/"/g, '""')}"`
}

function csvAmount(value: number) {
  return amountFormatter.format(value)
}

function csvPercent(value: number) {
  return percentFormatter.format(value)
}

function csvLines(rows: unknown[][]) {
  return `\uFEFFsep=;\r\n${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`
}

export function buildFiscalCsv(kind: FiscalViewId, data: FiscalBillingStatistics) {
  if (kind === "gastos") {
    return csvLines([
      ["Fecha", "Proveedor", "CIF", "Factura", "Concepto", "Base EUR", "IVA %", "IVA EUR", "Total EUR", "Pago", "Ficha"],
      ...data.expenses.map((expense) => [
        formatFiscalDate(expense.expenseDate),
        expense.supplierName,
        expense.supplierTaxId,
        expense.invoiceNumber,
        expense.title,
        csvAmount(expense.netAmount),
        csvPercent(expense.vatRate),
        csvAmount(expense.taxAmount),
        csvAmount(expense.totalAmount),
        expense.paymentMethod,
        `/gastos/individuales/${expense.id}`,
      ]),
    ])
  }

  if (kind === "ingresos") {
    return csvLines([
      ["Fecha", "Cliente", "CIF", "Factura", "Proyecto", "Base EUR", "IVA EUR", "Total EUR", "Estado", "Pago", "Ficha"],
      ...data.incomes.map((income) => [
        formatFiscalDate(income.issueDate),
        income.clientName,
        income.clientTaxId ?? "",
        income.documentNumber,
        income.project ?? "",
        csvAmount(income.subtotalAmount),
        csvAmount(income.taxAmount),
        csvAmount(income.totalAmount),
        income.status,
        income.paymentStatus,
        `/facturacion/facturas/${income.id}`,
      ]),
    ])
  }

  return csvLines([
    ["Periodo", "Año", "Base ingresos EUR", "IVA repercutido EUR", "Base gastos EUR", "IVA soportado EUR", "IVA neto EUR", "Beneficio EUR", "Tramo IRPF", "IRPF estimado EUR", "Total estimado EUR", "Perfil fiscal", "Nota"],
    [
      data.period.label,
      data.taxYear,
      csvAmount(data.totals.incomeSubtotal),
      csvAmount(data.totals.incomeTax),
      csvAmount(data.totals.expenseSubtotal),
      csvAmount(data.totals.expenseTax),
      csvAmount(data.totals.vatNet),
      csvAmount(data.totals.profit),
      data.totals.appliedIrpfBracketLabel,
      csvAmount(data.totals.irpfEstimate),
      csvAmount(data.totals.reserveEstimate),
      data.settings.profileLabel,
      data.settings.sourceNote ?? "",
    ],
  ])
}

export function fiscalCsvFileName(kind: FiscalViewId, data: FiscalBillingStatistics) {
  return `estadisticas-facturacion-${data.period.label}-${data.taxYear}-${kind}.csv`
}
