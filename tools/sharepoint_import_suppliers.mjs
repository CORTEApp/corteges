#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const DEFAULT_LIST_ID = 'fcbbfb7b-8b37-4101-a56f-8462a21f6639'

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
  node tools/sharepoint_import_suppliers.mjs --export-dir .sharepoint-export

Options:
  --export-dir <dir>       SharePoint export directory. Defaults to .sharepoint-export
  --list-id <guid>         SharePoint Proveedores list id. Defaults to ${DEFAULT_LIST_ID}
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
    throw new Error(`Missing required Proveedores field: ${label}`)
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

function parseBoolean(value, fallback = true) {
  if (typeof value === 'boolean') {
    return value
  }

  const normalized = normalizeKey(cleanText(value))
  if (!normalized) {
    return fallback
  }
  if (['si', 's', 'yes', 'y', 'true', '1', 'activo', 'activa', 'vigente', 'actual'].includes(normalized)) {
    return true
  }
  if (['no', 'n', 'false', '0', 'inactivo', 'inactiva', 'baja', 'historico', 'historial'].includes(normalized)) {
    return false
  }
  return fallback
}

function normalizePaymentMethod(value) {
  const normalized = normalizeKey(cleanText(value))
  if (!normalized) {
    return 'unknown'
  }
  if (normalized.includes('stripe') || normalized.includes('tarjeta')) {
    return 'stripe'
  }
  if (normalized.includes('sepa') || normalized.includes('domicili')) {
    return 'sepa'
  }
  if (normalized.includes('transfer')) {
    return 'transfer'
  }
  return 'other'
}

function chunks(items, size) {
  const result = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

function sourceModifiedTime(row) {
  const rawValue = row.source_raw?.Modified ?? row.source_raw?.Values?.Modified
  if (!rawValue) {
    return 0
  }

  const parsed = Date.parse(rawValue)
  return Number.isFinite(parsed) ? parsed : 0
}

function supplierRowCompleteness(row) {
  const filledFields = [
    row.name,
    row.contact_name,
    row.contact_phone,
    row.contact_email,
    row.start_date,
    row.sepa_reference,
    row.stripe_reference,
    row.comments,
  ].filter((value) => value != null && value !== '').length
  const paymentScore = row.payment_method && row.payment_method !== 'unknown' ? 1 : 0
  return filledFields + paymentScore
}

function compareSupplierRows(left, right) {
  if (left.active !== right.active) {
    return left.active ? 1 : -1
  }

  const modifiedDiff = sourceModifiedTime(left) - sourceModifiedTime(right)
  if (modifiedDiff !== 0) {
    return modifiedDiff
  }

  const completenessDiff = supplierRowCompleteness(left) - supplierRowCompleteness(right)
  if (completenessDiff !== 0) {
    return completenessDiff
  }

  return (left.sharepoint_item_id ?? 0) - (right.sharepoint_item_id ?? 0)
}

function pickBestSupplierRows(rows) {
  const byTaxId = new Map()
  for (const row of rows) {
    const current = byTaxId.get(row.tax_id)
    if (!current || compareSupplierRows(row, current) >= 0) {
      byTaxId.set(row.tax_id, row)
    }
  }
  return [...byTaxId.values()]
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

function mapSupplierItem(item, { listId, siteId }) {
  const values = item.Values ?? {}
  const taxId = requiredText(values.Title ?? values.LinkTitle, 'Title')

  return {
    tax_id: taxId,
    name: requiredText(values.Nombre, 'Nombre'),
    contact_name: cleanText(values.Nombrecontacto),
    contact_phone: cleanText(values.Telefonocontacto),
    contact_email: cleanText(values.Correocontacto),
    start_date: parseDate(values.Fechainicio),
    active: parseBoolean(values.Lineavigente, true),
    payment_method: normalizePaymentMethod(values.Metodopago),
    sepa_reference: cleanText(values.SEPA),
    stripe_reference: cleanText(values.PayPal ?? values.Stripe),
    comments: cleanText(values.Comentarios),
    sharepoint_site_id: siteId,
    sharepoint_list_id: listId,
    sharepoint_item_id: Number.parseInt(item.Id ?? values.id ?? values.ID ?? '0', 10) || null,
    sharepoint_unique_id: cleanText(item.UniqueId ?? values.GUID),
    sharepoint_etag: cleanText(item.ETag ?? values['@odata.etag']),
    source_raw: item,
    imported_at: new Date().toISOString(),
  }
}

async function upsertSuppliers(supabase, rows, batchSize) {
  const saved = []
  for (const batch of chunks(rows, batchSize)) {
    const { data, error } = await supabase
      .from('suppliers')
      .upsert(batch, { onConflict: 'tax_id' })
      .select('id, tax_id, name')

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

  const site = readJson(path.join(exportDir, 'site.json'), {})
  const items = asArray(readJson(path.join(exportDir, 'items', `${listId}.json`), []))
  const siteId = cleanGuid(site.Id) || env.SHAREPOINT_SITE_URL || 'sharepoint-site'
  const rows = items.map((item) => mapSupplierItem(item, { listId, siteId }))
  const uniqueRows = pickBestSupplierRows(rows)
  const activeCount = rows.filter((row) => row.active).length
  const inactiveCount = rows.length - activeCount
  const uniqueActiveCount = uniqueRows.filter((row) => row.active).length
  const uniqueInactiveCount = uniqueRows.length - uniqueActiveCount

  console.log(`Proveedores source list: ${listId}`)
  console.log(`SharePoint items: ${items.length}`)
  console.log(`Mapped suppliers: ${rows.length}`)
  console.log(`Active suppliers: ${activeCount}`)
  console.log(`Inactive suppliers: ${inactiveCount}`)
  console.log(`Unique suppliers: ${uniqueRows.length}`)
  console.log(`Unique active suppliers: ${uniqueActiveCount}`)
  console.log(`Unique inactive suppliers: ${uniqueInactiveCount}`)
  if (rows.length !== 23) {
    console.log(`Warning: expected 23 suppliers, mapped ${rows.length}.`)
  }

  if (args['dry-run']) {
    if (uniqueRows[0]) {
      console.log(`First mapped supplier: ${JSON.stringify(uniqueRows[0], null, 2)}`)
    }
    return
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL.')
  }

  const supabase = createClient(supabaseUrl, resolveServiceKey(env), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const saved = await upsertSuppliers(supabase, uniqueRows, batchSize)
  console.log(`Upserted suppliers: ${saved.length}`)
}

main().catch((error) => {
  console.error(error?.message ?? error)
  process.exit(1)
})
