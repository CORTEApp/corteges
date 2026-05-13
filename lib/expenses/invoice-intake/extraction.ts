import pdfParse from "pdf-parse/lib/pdf-parse.js"

import type { ExpenseSupplierOption } from "@/lib/expenses/types"
import type {
  ExtractedInvoiceDraft,
  ExpenseInvoiceSupplierTemplate,
  SupplierTemplateFieldRule,
  SupplierTemplateRules,
} from "@/lib/expenses/invoice-intake/types"

type InvoiceField =
  | "supplier_tax_id"
  | "supplier_name"
  | "invoice_number"
  | "invoice_date"
  | "net_amount"
  | "vat_rate"
  | "total_amount"
  | "currency"
  | "title"

type ReviewedInvoiceValues = {
  supplier_tax_id: string
  supplier_name: string
  invoice_number: string
  invoice_date: string
  net_amount: number
  vat_rate: number
  total_amount: number
  currency: string
  title: string
}

const TAX_ID_PATTERN = /\b(?:ES\s*)?[A-Z]\s*[-.]?\s*\d\s*[-.]?\s*\d\s*[-.]?\s*\d\s*[-.]?\s*\d\s*[-.]?\s*\d\s*[-.]?\s*\d\s*[-.]?\s*\d\s*[-.]?\s*[A-Z0-9]\b|\b(?:ES\s*)?\d\s*[-.]?\s*\d\s*[-.]?\s*\d\s*[-.]?\s*\d\s*[-.]?\s*\d\s*[-.]?\s*\d\s*[-.]?\s*\d\s*[-.]?\s*\d\s*[-.]?\s*[A-Z]\b/gi
const DATE_PATTERN = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b|\b(\d{4})-(\d{2})-(\d{2})\b/g
const MONEY_PATTERN = /-?\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,4})?|-?\d+(?:[.,]\d{1,4})?/g

export async function extractPdfText(buffer: Buffer) {
  const parsed = await pdfParse(buffer)
  const text = normalizeExtractedText(parsed.text ?? "")

  if (text.replace(/\s+/g, "").length < 20) {
    throw new Error("El PDF no contiene texto extraible. Los escaneados requieren OCR y quedan fuera de esta v1.")
  }

  return {
    text,
    pages: Number(parsed.numpages ?? 0),
  }
}

export function inferInvoiceDraft(input: {
  text: string
  suppliers: ExpenseSupplierOption[]
  templates: ExpenseInvoiceSupplierTemplate[]
}): ExtractedInvoiceDraft {
  const lines = splitLines(input.text)
  const field_confidence: Record<string, number> = {}
  const extraction_data: Record<string, unknown> = {
    extractor: "deterministic_pdf_text_v1",
    text_length: input.text.length,
  }

  const supplier = findSupplier(input.text, input.suppliers)
  let draft: ExtractedInvoiceDraft = {
    supplier_id: supplier?.id ?? null,
    supplier_tax_id: supplier?.tax_id ?? firstTaxId(input.text),
    supplier_name: supplier?.name ?? null,
    invoice_number: extractInvoiceNumber(lines),
    invoice_date: extractInvoiceDate(lines),
    net_amount: extractMoneyByLabels(lines, ["base imponible", "subtotal", "importe neto", "base"]),
    vat_rate: extractVatRate(lines),
    total_amount: extractMoneyByLabels(lines, ["total factura", "total a pagar", "importe total", "total"]),
    currency: detectCurrency(input.text),
    extraction_data,
    field_confidence,
    status: "requiere_revision",
    last_error: null,
  }

  if (draft.supplier_id) {
    field_confidence.supplier_id = 0.95
    field_confidence.supplier_tax_id = 0.95
    field_confidence.supplier_name = 0.95
  } else if (draft.supplier_tax_id) {
    field_confidence.supplier_tax_id = 0.6
  }

  markConfidence(field_confidence, "invoice_number", draft.invoice_number, 0.72)
  markConfidence(field_confidence, "invoice_date", draft.invoice_date, 0.72)
  markConfidence(field_confidence, "net_amount", draft.net_amount, 0.66)
  markConfidence(field_confidence, "vat_rate", draft.vat_rate, 0.66)
  markConfidence(field_confidence, "total_amount", draft.total_amount, 0.72)

  const template = draft.supplier_id
    ? input.templates.find((candidate) => candidate.supplier_id === draft.supplier_id && candidate.status === "active")
    : undefined

  if (template) {
    draft = mergeTemplateDraft(draft, applySupplierTemplate(template, lines))
    draft.template_id = template.id
    draft.extraction_data = {
      ...draft.extraction_data,
      template_id: template.id,
      template_version: template.version,
    }
  }

  if (draft.total_amount != null && draft.vat_rate != null && draft.net_amount == null) {
    draft.net_amount = roundMoney(draft.total_amount / (1 + draft.vat_rate / 100))
    field_confidence.net_amount = 0.55
  }

  if (draft.net_amount != null && draft.vat_rate != null && draft.total_amount == null) {
    draft.total_amount = roundMoney(draft.net_amount * (1 + draft.vat_rate / 100))
    field_confidence.total_amount = 0.55
  }

  draft.title = buildTitle(draft)
  markConfidence(field_confidence, "title", draft.title, 0.7)

  const missing = missingRequiredDraftFields(draft)
  const totalOk = draft.net_amount != null && draft.vat_rate != null && draft.total_amount != null
    ? amountMatchesTotal(draft.net_amount, draft.vat_rate, draft.total_amount)
    : false

  if (missing.length === 0 && totalOk) {
    draft.status = "extraida"
  } else {
    draft.status = "requiere_revision"
    draft.last_error = missing.length
      ? `Faltan campos: ${missing.join(", ")}.`
      : "Los importes no cuadran con el IVA detectado."
  }

  draft.extraction_data = {
    ...draft.extraction_data,
    missing_fields: missing,
    amount_check: totalOk,
  }

  return draft
}

export function buildSupplierTemplateRules(text: string, values: ReviewedInvoiceValues): SupplierTemplateRules {
  const lines = splitLines(text)
  const fields: SupplierTemplateRules["fields"] = {}

  addRule(fields, "invoice_number", lines, values.invoice_number, "text")
  addRule(fields, "invoice_date", lines, values.invoice_date, "date")
  addRule(fields, "net_amount", lines, values.net_amount, "money")
  addRule(fields, "vat_rate", lines, values.vat_rate, "rate")
  addRule(fields, "total_amount", lines, values.total_amount, "money")
  addRule(fields, "supplier_tax_id", lines, values.supplier_tax_id, "text")

  return {
    version: 1,
    fields,
  }
}

export function normalizeTaxId(value: string | null | undefined) {
  const normalized = String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")

  if (normalized.startsWith("ES") && normalized.length > 9) {
    return normalized.slice(2)
  }

  return normalized
}

export function parseMoney(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }

  const raw = String(value ?? "")
    .replace(/[^\d,.\-]/g, "")
    .trim()

  if (!raw) {
    return null
  }

  const lastComma = raw.lastIndexOf(",")
  const lastDot = raw.lastIndexOf(".")
  const decimalSeparator = lastComma > lastDot ? "," : lastDot > -1 ? "." : ""
  const withoutThousands = decimalSeparator === ","
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw.replace(/,/g, "")
  const parsed = Number.parseFloat(withoutThousands)
  return Number.isFinite(parsed) ? roundMoney(parsed) : null
}

export function parseDateToIso(value: string | null | undefined) {
  const raw = String(value ?? "").trim()
  if (!raw) {
    return null
  }

  const iso = raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (iso) {
    return validIsoDate(iso[1], iso[2], iso[3])
  }

  const european = raw.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/)
  if (!european) {
    return null
  }

  const year = european[3].length === 2 ? `20${european[3]}` : european[3]
  return validIsoDate(year, european[2], european[1])
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function amountMatchesTotal(netAmount: number, vatRate: number, totalAmount: number) {
  return Math.abs(roundMoney(netAmount * (1 + vatRate / 100)) - roundMoney(totalAmount)) <= 0.03
}

function normalizeExtractedText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n")
    .trim()
}

function splitLines(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
}

function findSupplier(text: string, suppliers: ExpenseSupplierOption[]) {
  const taxIds = new Set((text.match(TAX_ID_PATTERN) ?? []).map(normalizeTaxId).filter(Boolean))
  return suppliers.find((supplier) => taxIds.has(normalizeTaxId(supplier.tax_id)))
}

function firstTaxId(text: string) {
  const match = text.match(TAX_ID_PATTERN)?.[0]
  return match ? normalizeTaxId(match) : null
}

function extractInvoiceNumber(lines: string[]) {
  const patterns = [
    /(?:n[ouú]m(?:ero)?\.?\s*)?(?:de\s*)?factura\s*(?:n[ºo.]|num(?:ero)?|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9./_-]{2,})/i,
    /(?:invoice|bill)\s*(?:no\.?|number|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9./_-]{2,})/i,
    /\b(?:n[ºo.]|num(?:ero)?|no\.)\s*[:#-]?\s*([A-Z0-9][A-Z0-9./_-]{2,})/i,
  ]

  for (const line of lines.slice(0, 40)) {
    for (const pattern of patterns) {
      const match = line.match(pattern)
      const value = cleanIdentifier(match?.[1])
      if (value && !/fecha|date|total|iva/i.test(value)) {
        return value
      }
    }
  }

  return null
}

function extractInvoiceDate(lines: string[]) {
  const preferred = lines.find((line) => /fecha|date|emisi[oó]n|expedici[oó]n/i.test(line))
  const candidates = preferred ? [preferred, ...lines] : lines

  for (const line of candidates.slice(0, 80)) {
    const match = [...line.matchAll(DATE_PATTERN)][0]?.[0]
    const parsed = parseDateToIso(match)
    if (parsed) {
      return parsed
    }
  }

  return null
}

function extractVatRate(lines: string[]) {
  const candidates = lines.filter((line) => /iva|vat|i\.v\.a/i.test(line))
  for (const line of candidates) {
    const match = line.match(/(\d{1,2}(?:[.,]\d{1,2})?)\s*%/)
    const parsed = parseMoney(match?.[1])
    if (parsed != null && parsed >= 0 && parsed <= 100) {
      return parsed
    }
  }

  return null
}

function extractMoneyByLabels(lines: string[], labels: string[]) {
  const normalizedLabels = labels.map((label) => label.toLowerCase())
  const candidates = [...lines]
    .reverse()
    .filter((line) => normalizedLabels.some((label) => line.toLowerCase().includes(label)))

  for (const line of candidates) {
    const values = moneyValues(line)
    const last = values.at(-1)
    if (last != null) {
      return last
    }
  }

  return null
}

function moneyValues(line: string) {
  return [...line.matchAll(MONEY_PATTERN)]
    .map((match) => parseMoney(match[0]))
    .filter((value): value is number => value != null)
}

function detectCurrency(text: string) {
  if (/\bUSD\b|\$/i.test(text)) {
    return "USD"
  }

  if (/\bGBP\b|£/i.test(text)) {
    return "GBP"
  }

  return "EUR"
}

function buildTitle(draft: ExtractedInvoiceDraft) {
  if (draft.title) {
    return draft.title
  }

  const number = draft.invoice_number ? ` ${draft.invoice_number}` : ""
  const supplier = draft.supplier_name ? ` - ${draft.supplier_name}` : ""
  return `Factura${number}${supplier}`.trim()
}

function missingRequiredDraftFields(draft: ExtractedInvoiceDraft) {
  const missing: string[] = []
  if (!draft.supplier_id) missing.push("proveedor")
  if (!draft.invoice_number) missing.push("factura")
  if (!draft.invoice_date) missing.push("fecha")
  if (draft.net_amount == null) missing.push("base")
  if (draft.vat_rate == null) missing.push("iva")
  if (draft.total_amount == null) missing.push("total")
  return missing
}

function markConfidence(target: Record<string, number>, field: string, value: unknown, confidence: number) {
  if (value !== null && value !== undefined && value !== "") {
    target[field] = confidence
  }
}

function mergeTemplateDraft(base: ExtractedInvoiceDraft, templateDraft: Partial<ExtractedInvoiceDraft>) {
  const merged: ExtractedInvoiceDraft = {
    ...base,
    ...Object.fromEntries(
      Object.entries(templateDraft).filter(([, value]) => value !== null && value !== undefined && value !== ""),
    ),
    field_confidence: { ...base.field_confidence },
    extraction_data: { ...base.extraction_data },
  }

  for (const key of Object.keys(templateDraft)) {
    if (key in merged.field_confidence) {
      merged.field_confidence[key] = Math.max(Number(merged.field_confidence[key] ?? 0), 0.9)
    }
  }

  return merged
}

function applySupplierTemplate(template: ExpenseInvoiceSupplierTemplate, lines: string[]) {
  const rules = parseTemplateRules(template.extraction_rules)
  const draft: Partial<ExtractedInvoiceDraft> = {}

  for (const [field, rule] of Object.entries(rules.fields) as Array<[InvoiceField, SupplierTemplateFieldRule]>) {
    const value = applyRule(lines, rule)
    if (value == null) {
      continue
    }

    if (rule.parser === "money" || rule.parser === "rate") {
      const parsed = parseMoney(value)
      if (parsed != null) {
        ;(draft as Record<string, unknown>)[field] = parsed
      }
      continue
    }

    if (rule.parser === "date") {
      const parsed = parseDateToIso(value)
      if (parsed) {
        ;(draft as Record<string, unknown>)[field] = parsed
      }
      continue
    }

    ;(draft as Record<string, unknown>)[field] = cleanIdentifier(value)
  }

  return draft
}

function parseTemplateRules(value: unknown): SupplierTemplateRules {
  if (!value || typeof value !== "object" || !("fields" in value)) {
    return { version: 1, fields: {} }
  }

  return value as SupplierTemplateRules
}

function applyRule(lines: string[], rule: SupplierTemplateFieldRule) {
  let regex: RegExp
  try {
    regex = new RegExp(rule.regex, "i")
  } catch {
    return null
  }

  const candidates = rule.line_hint
    ? [
        ...lines.filter((line) => line.toLowerCase().includes(String(rule.line_hint).toLowerCase())),
        ...lines,
      ]
    : lines

  for (const line of candidates) {
    const match = line.match(regex)
    if (match?.[1]) {
      return match[1]
    }
  }

  return null
}

function addRule(
  fields: SupplierTemplateRules["fields"],
  field: InvoiceField,
  lines: string[],
  value: string | number,
  parser: SupplierTemplateFieldRule["parser"],
) {
  const line = findLineForValue(lines, value, parser)
  if (!line) {
    return
  }

  const regex = ruleRegexForLine(line, value, parser)
  if (!regex) {
    return
  }

  fields[field] = {
    regex,
    parser,
    line_hint: lineHint(line, value),
  }
}

function findLineForValue(lines: string[], value: string | number, parser: SupplierTemplateFieldRule["parser"]) {
  if (parser === "money" || parser === "rate") {
    const expected = parseMoney(value)
    if (expected == null) {
      return null
    }

    return lines.find((line) => moneyValues(line).some((candidate) => Math.abs(candidate - expected) <= 0.03)) ?? null
  }

  const needle = parser === "date" ? parseDateToIso(String(value)) : cleanIdentifier(String(value)).toLowerCase()
  return lines.find((line) => {
    if (parser === "date") {
      return [...line.matchAll(DATE_PATTERN)].some((match) => parseDateToIso(match[0]) === needle)
    }

    return line.toLowerCase().includes(String(needle))
  }) ?? null
}

function ruleRegexForLine(line: string, value: string | number, parser: SupplierTemplateFieldRule["parser"]) {
  if (parser === "money" || parser === "rate") {
    const label = lineHint(line, value)
    const prefix = label ? `${escapeRegExp(label)}.*?` : ""
    return `${prefix}(${MONEY_PATTERN.source})`
  }

  if (parser === "date") {
    const label = lineHint(line, value)
    const prefix = label ? `${escapeRegExp(label)}.*?` : ""
    return `${prefix}(\\d{1,2}[./-]\\d{1,2}[./-]\\d{2,4}|\\d{4}-\\d{2}-\\d{2})`
  }

  const textValue = cleanIdentifier(String(value))
  const index = line.toLowerCase().indexOf(textValue.toLowerCase())
  const prefix = index > -1 ? line.slice(0, index).trim().slice(-42) : ""
  const prefixPattern = prefix ? `${escapeRegExp(prefix)}\\s*` : ""
  return `${prefixPattern}([A-Z0-9][A-Z0-9./_-]{2,})`
}

function lineHint(line: string, value: string | number) {
  const marker = typeof value === "number" ? String(value).replace(".", ",") : String(value)
  const index = line.toLowerCase().indexOf(marker.toLowerCase())
  const before = index > 0 ? line.slice(0, index) : line
  const label = before
    .replace(/[0-9.,€$£%]/g, " ")
    .split(/\s+/)
    .filter((part) => part.length > 2)
    .slice(-3)
    .join(" ")
    .trim()

  return label || undefined
}

function cleanIdentifier(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .replace(/^[#:.\-\s]+/, "")
    .replace(/[;,\s]+$/, "")
}

function validIsoDate(year: string, month: string, day: string) {
  const paddedMonth = month.padStart(2, "0")
  const paddedDay = day.padStart(2, "0")
  const iso = `${year}-${paddedMonth}-${paddedDay}`
  const parsed = new Date(`${iso}T00:00:00.000Z`)

  if (
    Number.isNaN(parsed.valueOf())
    || parsed.getUTCFullYear() !== Number(year)
    || parsed.getUTCMonth() + 1 !== Number(paddedMonth)
    || parsed.getUTCDate() !== Number(paddedDay)
  ) {
    return null
  }

  return iso
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")
}
