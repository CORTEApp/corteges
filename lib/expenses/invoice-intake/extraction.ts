import pdfParse from "pdf-parse/lib/pdf-parse.js"

import type { ExpenseSupplierOption } from "@/lib/expenses/types"
import type {
  ExtractedInvoiceDraft,
  ExpenseInvoiceSupplierTemplate,
  SupplierTemplateFieldRule,
  SupplierTemplateRules,
} from "@/lib/expenses/invoice-intake/types"
import { amountMatchesTotal, calculateInvoiceTotal, roundMoney } from "@/lib/expenses/invoice-intake/amounts"

export { amountMatchesTotal, roundMoney }

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

type ExtractMatch<T> = {
  value: T
  source: string
}

type SupplierMatch = {
  supplier: ExpenseSupplierOption
  taxId: string
  source: string
}

const EXTRACTOR_VERSION = "deterministic_pdf_text_v2"
const TAX_ID_PATTERN = /\b(?:ES\s*)?[A-Z]\s*[-.]?\s*\d\s*[-.]?\s*\d\s*[-.]?\s*\d\s*[-.]?\s*\d\s*[-.]?\s*\d\s*[-.]?\s*\d\s*[-.]?\s*\d\s*[-.]?\s*[A-Z0-9]\b|\b(?:ES\s*)?\d\s*[-.]?\s*\d\s*[-.]?\s*\d\s*[-.]?\s*\d\s*[-.]?\s*\d\s*[-.]?\s*\d\s*[-.]?\s*\d\s*[-.]?\s*\d\s*[-.]?\s*[A-Z]\b/gi
const EU_VAT_PATTERN = /\bEU\s*(?:OSS\s*)?VAT\s*(EU\s*\d{6,})\b|\b(EU\s*\d{6,})\b/gi
const DATE_PATTERN = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b|\b(\d{4})-(\d{2})-(\d{2})\b/g
const MONEY_PATTERN = /-?(?:\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,4})?|\d+(?:[.,]\d{1,4})?)/g
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const MONTHS: Record<string, string> = {
  january: "01",
  jan: "01",
  enero: "01",
  february: "02",
  feb: "02",
  febrero: "02",
  march: "03",
  mar: "03",
  marzo: "03",
  april: "04",
  apr: "04",
  abril: "04",
  may: "05",
  mayo: "05",
  june: "06",
  jun: "06",
  junio: "06",
  july: "07",
  jul: "07",
  julio: "07",
  august: "08",
  aug: "08",
  agosto: "08",
  september: "09",
  sep: "09",
  sept: "09",
  septiembre: "09",
  october: "10",
  oct: "10",
  octubre: "10",
  november: "11",
  nov: "11",
  noviembre: "11",
  december: "12",
  dec: "12",
  diciembre: "12",
}

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
  const normalizedText = normalizeExtractedText(input.text)
  const lines = splitLines(normalizedText)
  const field_confidence: Record<string, number> = {}
  const fieldSources: Record<string, string> = {}
  const extraction_data: Record<string, unknown> = {
    extractor: EXTRACTOR_VERSION,
    text_length: normalizedText.length,
  }

  const supplierMatch = findSupplier(normalizedText, lines, input.suppliers)
  const invoiceNumber = extractInvoiceNumber(lines)
  const invoiceDate = extractInvoiceDate(lines)
  const netAmount = extractMoneyByLabels(lines, ["total excluding tax", "base imponible", "subtotal", "importe neto", "base"])
  const vatRate = extractVatRate(lines)
  const totalAmount = extractMoneyByLabels(
    lines,
    ["amount due", "total factura", "total a pagar", "importe total", "total"],
    ["total excluding tax"],
  )

  if (supplierMatch) {
    fieldSources.supplier_id = supplierMatch.source
    fieldSources.supplier_tax_id = supplierMatch.source
    fieldSources.supplier_name = supplierMatch.source
  }
  addFieldSource(fieldSources, "invoice_number", invoiceNumber)
  addFieldSource(fieldSources, "invoice_date", invoiceDate)
  addFieldSource(fieldSources, "net_amount", netAmount)
  addFieldSource(fieldSources, "vat_rate", vatRate)
  addFieldSource(fieldSources, "total_amount", totalAmount)

  let draft: ExtractedInvoiceDraft = {
    supplier_id: supplierMatch?.supplier.id ?? null,
    supplier_tax_id: supplierMatch?.supplier.tax_id ?? firstTaxId(normalizedText)?.value ?? null,
    supplier_name: supplierMatch?.supplier.name ?? null,
    invoice_number: invoiceNumber?.value ?? null,
    invoice_date: invoiceDate?.value ?? null,
    net_amount: netAmount?.value ?? null,
    vat_rate: vatRate?.value ?? null,
    total_amount: totalAmount?.value ?? null,
    currency: detectCurrency(normalizedText),
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
    draft.total_amount = calculateInvoiceTotal(draft.net_amount, draft.vat_rate)
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
    field_sources: fieldSources,
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
    .replace(/^EUOSSVATEU/, "EU")
    .replace(/^EUOSSVAT/, "EU")
    .replace(/^EUROPEANUNIONVAT/, "EU")

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
  const decimalSeparator = decimalSeparatorForMoney(raw, lastComma, lastDot)
  const withoutThousands = decimalSeparator === ","
    ? raw.replace(/\./g, "").replace(",", ".")
    : decimalSeparator === "."
      ? raw.replace(/,/g, "")
      : raw.replace(/[.,\s]/g, "")
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
    const englishTextual = raw.match(
      /(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(\d{4})\b/i,
    )
    if (englishTextual) {
      return validIsoDate(englishTextual[3], MONTHS[englishTextual[1].toLowerCase()], englishTextual[2])
    }

    const spanishTextual = raw.match(
      /\b(\d{1,2})\s*(?:de\s*)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s*(?:de\s*)?(\d{4})\b/i,
    )
    if (spanishTextual) {
      return validIsoDate(spanishTextual[3], MONTHS[spanishTextual[2].toLowerCase()], spanishTextual[1])
    }

    return null
  }

  const year = european[3].length === 2 ? `20${european[3]}` : european[3]
  return validIsoDate(year, european[2], european[1])
}

function normalizeExtractedText(value: string) {
  return value
    .replace(/([A-Z0-9])\u0000([A-Z0-9])/gi, "$1-$2")
    .replace(/\u0000/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n")
    .replace(/(\d+[.,]\d{2})(\d{1,2}(?:[.,]\d{1,2})?%)/g, "$1 $2")
    .replace(/(\d)([€$£])/g, "$1 $2")
    .replace(/([€$£])(?=\d)/g, "$1 ")
    .trim()
}

function splitLines(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
}

function findSupplier(text: string, lines: string[], suppliers: ExpenseSupplierOption[]): SupplierMatch | null {
  const taxIds = extractTaxIds(text)
  for (const taxId of taxIds) {
    const supplier = suppliers.find((candidate) => normalizeTaxId(candidate.tax_id) === taxId)
    if (supplier) {
      return { supplier, taxId, source: `tax_id:${taxId}` }
    }
  }

  const emails = new Set((text.match(EMAIL_PATTERN) ?? []).map((email) => email.toLowerCase()))
  const byEmail = suppliers.find((supplier) => supplier.contact_email && emails.has(supplier.contact_email.toLowerCase()))
  if (byEmail) {
    return {
      supplier: byEmail,
      taxId: normalizeTaxId(byEmail.tax_id),
      source: `email:${byEmail.contact_email}`,
    }
  }

  const normalizedText = normalizeSearchText(text)
  const byExactName = suppliers.find((supplier) => {
    const normalizedName = normalizeSearchText(supplier.name)
    return normalizedName.length >= 5 && normalizedText.includes(normalizedName)
  })

  if (byExactName) {
    return {
      supplier: byExactName,
      taxId: normalizeTaxId(byExactName.tax_id),
      source: `name:${lineContaining(lines, byExactName.name) ?? byExactName.name}`,
    }
  }

  return null
}

function firstTaxId(text: string) {
  const value = extractTaxIds(text)[0]
  return value ? { value, source: `tax_id:${value}` } : null
}

function extractInvoiceNumber(lines: string[]): ExtractMatch<string> | null {
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
        return { value, source: line }
      }
    }
  }

  return null
}

function extractInvoiceDate(lines: string[]): ExtractMatch<string> | null {
  const preferred = lines.filter((line) => /date of issue|invoice date|fecha.*factura|fecha.*emisi[oó]n|emisi[oó]n|expedici[oó]n/i.test(line))
  const fallback = lines.filter((line) => !preferred.includes(line))
  const candidates = [...preferred, ...fallback]

  for (const line of candidates.slice(0, 80)) {
    const match = [...line.matchAll(DATE_PATTERN)][0]?.[0]
    const parsed = parseDateToIso(match ?? line)
    if (parsed) {
      return { value: parsed, source: line }
    }
  }

  return null
}

function extractVatRate(lines: string[]): ExtractMatch<number> | null {
  const candidates = lines.filter((line) => /iva|vat|i\.v\.a/i.test(line))
  for (const line of candidates) {
    const match = line.match(/(\d{1,2}(?:[.,]\d{1,2})?)\s*%/)
    const parsed = parseMoney(match?.[1])
    if (parsed != null && parsed >= 0 && parsed <= 100) {
      return { value: parsed, source: line }
    }
  }

  return null
}

function extractMoneyByLabels(lines: string[], labels: string[], excludedLabels: string[] = []): ExtractMatch<number> | null {
  const normalizedLabels = labels.map((label) => label.toLowerCase())
  const normalizedExcludedLabels = excludedLabels.map((label) => label.toLowerCase())
  const candidates = [...lines]
    .reverse()
    .filter((line) => {
      const normalizedLine = line.toLowerCase()
      return normalizedLabels.some((label) => normalizedLine.includes(label)) &&
        !normalizedExcludedLabels.some((label) => normalizedLine.includes(label))
    })

  for (const line of candidates) {
    const values = moneyValues(line)
    const last = values.at(-1)
    if (last != null) {
      return { value: last, source: line }
    }
  }

  return null
}

function moneyValues(line: string) {
  return [...line.matchAll(MONEY_PATTERN)]
    .map((match) => parseMoney(match[0]))
    .filter((value): value is number => value != null)
}

function extractTaxIds(text: string) {
  const taxIds = new Set<string>()
  for (const match of text.matchAll(EU_VAT_PATTERN)) {
    const value = normalizeTaxId(match[1] ?? match[2] ?? match[0])
    if (value) taxIds.add(value)
  }

  for (const match of text.matchAll(TAX_ID_PATTERN)) {
    const value = normalizeTaxId(match[0])
    if (value) taxIds.add(value)
  }

  return [...taxIds]
}

function decimalSeparatorForMoney(raw: string, lastComma: number, lastDot: number) {
  if (lastComma > -1 && lastDot > -1) {
    return lastComma > lastDot ? "," : "."
  }

  const separator = lastComma > -1 ? "," : lastDot > -1 ? "." : ""
  if (!separator) {
    return ""
  }

  const parts = raw.split(separator)
  const fraction = parts.at(-1) ?? ""
  if (parts.length > 2) {
    return ""
  }

  return fraction.length === 3 && raw.replace(/^-/, "").split(separator)[0].length <= 3 ? "" : separator
}

function addFieldSource(target: Record<string, string>, field: string, match: ExtractMatch<unknown> | null) {
  if (match) {
    target[field] = match.source
  }
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function lineContaining(lines: string[], value: string) {
  const needle = normalizeSearchText(value)
  return lines.find((line) => normalizeSearchText(line).includes(needle)) ?? null
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
