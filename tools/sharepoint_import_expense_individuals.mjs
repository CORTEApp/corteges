#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const DEFAULT_LIST_ID = '03c402ab-1b52-4606-ad9b-163fca7be013'

function parseArgs(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) {
      continue
    }

    const key = token.slice(2)
    const next = argv[index + 1]
    if (!next || next.startsWith('--')) {
      args[key] = true
    } else {
      args[key] = next
      index += 1
    }
  }
  return args
}

function printHelp() {
  console.log(`Usage:
  node tools/sharepoint_import_expense_individuals.mjs --export-dir .sharepoint-export

Options:
  --export-dir <dir>       SharePoint export directory. Defaults to .sharepoint-export
  --list-id <guid>         SharePoint Gastos list id. Defaults to ${DEFAULT_LIST_ID}
  --batch-size <number>    Upsert batch size. Defaults to 250
  --dry-run                Parse and map rows without writing to Supabase
`)
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {}
  }

  const env = {}
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue
    }
    const separator = trimmed.indexOf('=')
    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')
    env[key] = value
  }
  return env
}

function readJson(filePath, fallback = undefined) {
  if (!fs.existsSync(filePath)) {
    if (fallback !== undefined) {
      return fallback
    }
    throw new Error(`Missing file: ${filePath}`)
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function asArray(value) {
  if (value == null) {
    return []
  }
  return Array.isArray(value) ? value : [value]
}

function cleanGuid(value) {
  return String(value ?? '').trim().replace(/[{}]/g, '').toLowerCase()
}

function normalizeKey(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function normalizeTaxId(value) {
  return normalizeKey(value).toUpperCase()
}

function cleanText(value) {
  if (value == null) {
    return null
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? trimmed : null
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (typeof value === 'object') {
    return value.LookupValue ?? value.Label ?? value.Description ?? value.Url ?? value.Email ?? JSON.stringify(value)
  }
  return String(value)
}

function requiredText(value, label) {
  const text = cleanText(value)
  if (!text) {
    throw new Error(`Missing required Gastos field: ${label}`)
  }
  return text
}

function parseDate(value) {
  const text = cleanText(value)
  if (!text) {
    return null
  }

  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`
  }

  const spanishDate = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (spanishDate) {
    const day = spanishDate[1].padStart(2, '0')
    const month = spanishDate[2].padStart(2, '0')
    const year = spanishDate[3].length === 2 ? `20${spanishDate[3]}` : spanishDate[3]
    return `${year}-${month}-${day}`
  }

  const parsed = new Date(text)
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString().slice(0, 10)
}

function parseNumber(value) {
  if (value == null || value === '') {
    return null
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  const normalized = String(value).trim().replace(/\./g, '').replace(',', '.')
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizePaymentMethod(value) {
  const normalized = normalizeKey(cleanText(value))
  if (normalized === 'n26') {
    return 'n26'
  }
  if (normalized === 'caixa' || normalized.includes('caixabank')) {
    return 'caixa'
  }
  return 'other'
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function chunks(items, size) {
  const result = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

function normalizeInvoiceNumber(value) {
  return String(value ?? '').trim().toUpperCase()
}

function expenseInvoiceDedupKey(row) {
  const invoiceNumber = normalizeInvoiceNumber(row.invoice_number)
  return row.supplier_id && invoiceNumber ? `${row.supplier_id}::${invoiceNumber}` : null
}

function compareOptionalText(a, b) {
  const left = cleanText(a)
  const right = cleanText(b)
  if (left && right && left !== right) {
    return left.localeCompare(right)
  }
  if (left && !right) {
    return -1
  }
  if (!left && right) {
    return 1
  }
  return 0
}

function compareOptionalNumber(a, b) {
  const left = Number.isFinite(a) ? a : Number.MAX_SAFE_INTEGER
  const right = Number.isFinite(b) ? b : Number.MAX_SAFE_INTEGER
  return left - right
}

function compareCanonicalExpenseRows(a, b) {
  return (
    compareOptionalText(a.imported_at, b.imported_at) ||
    compareOptionalText(a.created_at, b.created_at) ||
    compareOptionalNumber(a.sharepoint_item_id, b.sharepoint_item_id) ||
    compareOptionalText(a.id, b.id)
  )
}

function deduplicateExpenseRows(rows) {
  const entries = []
  const entryByKey = new Map()
  const duplicateRows = []

  for (const row of rows) {
    const key = expenseInvoiceDedupKey(row)
    if (!key) {
      entries.push({ row })
      continue
    }

    const current = entryByKey.get(key)
    if (!current) {
      const entry = { key, row }
      entryByKey.set(key, entry)
      entries.push(entry)
      continue
    }

    if (compareCanonicalExpenseRows(row, current.row) < 0) {
      duplicateRows.push(current.row)
      current.row = row
    } else {
      duplicateRows.push(row)
    }
  }

  return {
    rows: entries.map((entry) => entry.row),
    duplicateRows,
  }
}

function resolveServiceKey(env) {
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error('Missing SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.')
  }
  if (key.startsWith('sb_publishable_') || key === env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Refusing to import with a publishable/anon Supabase key.')
  }
  return key
}

async function loadSupplierMap(supabase) {
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, tax_id, name')
    .order('name', { ascending: true })
    .limit(2000)

  if (error) {
    throw error
  }

  const byTaxId = new Map()
  for (const supplier of data ?? []) {
    byTaxId.set(normalizeTaxId(supplier.tax_id), supplier)
  }
  return byTaxId
}

function isHistoricalMismatch(row) {
  if (row.net_amount == null || row.total_amount == null) {
    return false
  }

  const expected = roundMoney(row.net_amount * (1 + row.vat_rate / 100))
  return Math.abs(expected - row.total_amount) > 0.02
}

function mapExpenseItem(item, { listId, siteId, supplierByTaxId, importedAt }) {
  const values = item.Values ?? {}
  const taxId = requiredText(values.CIF, 'CIF')
  const supplier = supplierByTaxId.get(normalizeTaxId(taxId))

  if (!supplier) {
    throw new Error(`Missing supplier for Gastos item ${item.Id ?? values.id ?? '?'} with CIF ${taxId}`)
  }

  const title = requiredText(values.Title ?? values.LinkTitle, 'Title')
  const invoiceNumber = requiredText(values.Factura, 'Factura')
  const expenseDate = parseDate(values.Fecha)
  if (!expenseDate) {
    throw new Error(`Missing Fecha for Gastos item ${item.Id ?? values.id ?? '?'}`)
  }

  const netAmount = parseNumber(values.Precio)
  const vatRate = parseNumber(values.TipoIVA) ?? parseNumber(values.IVA) ?? 0
  const totalAmount = parseNumber(values.Total) ?? 0
  const legacyHasAttachment = Boolean(
    values.Attachments === true ||
    values.Attachments === 'true' ||
    item.Attachments?.length ||
    item.Documents?.length,
  )

  return {
    supplier_id: supplier.id,
    supplier_tax_id: supplier.tax_id,
    supplier_name: supplier.name,
    title,
    invoice_number: invoiceNumber,
    expense_date: expenseDate,
    payment_method: normalizePaymentMethod(values.MetodoPago),
    net_amount: netAmount,
    vat_rate: vatRate,
    total_amount: totalAmount,
    currency: 'EUR',
    notes: cleanText(values.Observaciones),
    legacy_has_attachment: legacyHasAttachment,
    sharepoint_site_id: siteId,
    sharepoint_list_id: listId,
    sharepoint_item_id: Number.parseInt(item.Id ?? values.id ?? values.ID ?? '0', 10) || null,
    sharepoint_unique_id: cleanText(item.UniqueId ?? values.GUID),
    sharepoint_etag: cleanText(item.ETag ?? values['@odata.etag']),
    source_raw: item,
    imported_at: importedAt,
  }
}

async function upsertExpenses(supabase, rows, batchSize) {
  const saved = []
  for (const batch of chunks(rows, batchSize)) {
    const { data, error } = await supabase
      .from('expense_individuals')
      .upsert(batch, { onConflict: 'sharepoint_site_id,sharepoint_list_id,sharepoint_item_id' })
      .select('id, invoice_number, title')

    if (error) {
      throw error
    }
    saved.push(...(data ?? []))
  }
  return saved
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help || args.h) {
    printHelp()
    return
  }

  const env = { ...readEnvFile(path.join(ROOT, '.env.local')), ...process.env }
  const exportDir = path.resolve(ROOT, args['export-dir'] || env.SHAREPOINT_EXPORT_DIR || '.sharepoint-export')
  const listId = cleanGuid(args['list-id'] || DEFAULT_LIST_ID)
  const batchSize = Number.parseInt(args['batch-size'] || '250', 10)

  if (!fs.existsSync(exportDir)) {
    throw new Error(`Missing SharePoint export directory: ${exportDir}. Run npm run sharepoint:export first.`)
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL.')
  }

  const supabase = createClient(supabaseUrl, resolveServiceKey(env), {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const site = readJson(path.join(exportDir, 'site.json'), {})
  const items = asArray(readJson(path.join(exportDir, 'items', `${listId}.json`), []))
  const siteId = cleanGuid(site.Id) || env.SHAREPOINT_SITE_URL || 'sharepoint-site'
  const supplierByTaxId = await loadSupplierMap(supabase)
  const importedAt = new Date().toISOString()
  const rows = items.map((item) => mapExpenseItem(item, { listId, siteId, supplierByTaxId, importedAt }))
  const { rows: importRows, duplicateRows } = deduplicateExpenseRows(rows)
  const n26Count = importRows.filter((row) => row.payment_method === 'n26').length
  const caixaCount = importRows.filter((row) => row.payment_method === 'caixa').length
  const vat0Count = importRows.filter((row) => row.vat_rate === 0).length
  const vat21Count = importRows.filter((row) => row.vat_rate === 21).length
  const missingNetCount = importRows.filter((row) => row.net_amount == null).length
  const mismatchCount = importRows.filter(isHistoricalMismatch).length
  const linkedSupplierCount = importRows.filter((row) => row.supplier_id).length
  const legacyAttachmentCount = importRows.filter((row) => row.legacy_has_attachment).length

  console.log(`Gastos source list: ${listId}`)
  console.log(`SharePoint items: ${items.length}`)
  console.log(`Mapped expense individuals: ${rows.length}`)
  console.log(`Duplicate expense rows skipped: ${duplicateRows.length}`)
  console.log(`Expense individuals to upsert: ${importRows.length}`)
  console.log(`Supplier links: ${linkedSupplierCount}`)
  console.log(`N26 expenses: ${n26Count}`)
  console.log(`Caixa expenses: ${caixaCount}`)
  console.log(`VAT 0 expenses: ${vat0Count}`)
  console.log(`VAT 21 expenses: ${vat21Count}`)
  console.log(`Missing net amount: ${missingNetCount}`)
  console.log(`Historical total mismatches preserved: ${mismatchCount}`)
  console.log(`Legacy attachment flags: ${legacyAttachmentCount}`)

  if (items.length !== 171) {
    console.log(`Warning: expected 171 expense items, mapped ${items.length}.`)
  }

  if (args['dry-run']) {
    if (importRows[0]) {
      console.log(`First mapped expense: ${JSON.stringify(importRows[0], null, 2)}`)
    }
    return
  }

  const saved = await upsertExpenses(supabase, importRows, batchSize)
  console.log(`Upserted expense individuals: ${saved.length}`)
}

main().catch((error) => {
  console.error(error?.message ?? error)
  process.exit(1)
})
