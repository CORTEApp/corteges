#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

import { calculateSubscriptionRecurringAmounts } from '../lib/billing/subscription-amounts.mjs'

const ROOT = process.cwd()
const DEFAULT_LIST_ID = '0e2a61bb-f831-4b7a-a007-092e49a3c59d'
const DEFAULT_VAT_RATE = 21

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
  node tools/sharepoint_import_subscriptions.mjs --export-dir .sharepoint-export

Options:
  --export-dir <dir>       SharePoint export directory. Defaults to .sharepoint-export
  --list-id <guid>         SharePoint Suscripciones list id. Defaults to ${DEFAULT_LIST_ID}
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
  if (Array.isArray(value)) {
    return value.map((item) => cleanText(item)).filter(Boolean).join('; ')
  }
  if (typeof value === 'object') {
    return value.LookupValue ?? value.Label ?? value.Description ?? value.Url ?? value.Email ?? JSON.stringify(value)
  }
  return String(value)
}

function requiredText(value, label) {
  const text = cleanText(value)
  if (!text) {
    throw new Error(`Missing required Suscripciones field: ${label}`)
  }
  return text
}

function parseNumber(value, fallback = 0) {
  const text = cleanText(value)
  if (!text) {
    return fallback
  }
  const parsed = Number.parseFloat(text.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseDate(value) {
  const text = cleanText(value)
  if (!text) {
    return null
  }
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    const year = Number.parseInt(match[1], 10)
    return year >= 2100 ? null : `${match[1]}-${match[2]}-${match[3]}`
  }
  const parsed = new Date(text)
  if (Number.isNaN(parsed.valueOf())) {
    return null
  }
  const year = parsed.getUTCFullYear()
  return year >= 2100 ? null : parsed.toISOString().slice(0, 10)
}

function chunks(items, size) {
  const result = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
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

function mapSubscriptionItem(item, { listId, siteId, clientsByTaxId, facturablesByCode }) {
  const values = item.Values ?? {}
  const taxId = requiredText(values.Title, 'Title')
  const subscriptionCode = requiredText(values.Denominacion, 'Denominacion').toUpperCase()
  const client = clientsByTaxId.get(normalizeKey(taxId))
  const facturable = facturablesByCode.get(normalizeKey(subscriptionCode))
  const quantity = parseNumber(values.Cantidad, 1)
  const recurringAmounts = calculateSubscriptionRecurringAmounts({
    unitPrice: facturable?.unit_price,
    quantity,
    applyVat: true,
    vatRate: DEFAULT_VAT_RATE,
  })
  const fallbackTotalAmount = parseNumber(values.PrecioTotal, 0)

  return {
    client_id: client?.id ?? null,
    client_tax_id: taxId,
    client_name: cleanText(values.NombreEmpresa) ?? client?.name ?? 'Cliente historico',
    billing_email: cleanText(values.Correo) ?? client?.billing_email ?? null,
    facturable_id: facturable?.id ?? null,
    subscription_code: subscriptionCode,
    description: cleanText(values.Descripcion) ?? facturable?.description ?? subscriptionCode,
    start_date: parseDate(values.FechaInicio) ?? new Date().toISOString().slice(0, 10),
    end_date: parseDate(values.FechaFin),
    quantity,
    recurring_total_amount: facturable ? recurringAmounts.totalAmount : fallbackTotalAmount,
    apply_vat: true,
    vat_rate: DEFAULT_VAT_RATE,
    currency: 'EUR',
    sharepoint_site_id: siteId,
    sharepoint_list_id: listId,
    sharepoint_item_id: Number.parseInt(item.Id ?? values.id ?? values.ID ?? '0', 10) || null,
    sharepoint_unique_id: cleanText(item.UniqueId ?? values.GUID),
    sharepoint_etag: cleanText(item.ETag ?? values['@odata.etag']),
    source_raw: item,
    imported_at: new Date().toISOString(),
  }
}

async function fetchLookupMaps(supabase) {
  const [{ data: clients, error: clientsError }, { data: facturables, error: facturablesError }] =
    await Promise.all([
      supabase.from('clients').select('id, tax_id, name, billing_email').limit(2000),
      supabase.from('billing_facturables').select('id, code, description, unit_price').limit(2000),
    ])

  if (clientsError) {
    throw clientsError
  }
  if (facturablesError) {
    throw facturablesError
  }

  return {
    clientsByTaxId: new Map((clients ?? []).map((client) => [normalizeKey(client.tax_id), client])),
    facturablesByCode: new Map((facturables ?? []).map((facturable) => [normalizeKey(facturable.code), facturable])),
  }
}

async function upsertSubscriptions(supabase, rows, batchSize) {
  const saved = []
  for (const batch of chunks(rows, batchSize)) {
    const { data, error } = await supabase
      .from('billing_subscriptions')
      .upsert(batch, { onConflict: 'sharepoint_list_id,sharepoint_item_id' })
      .select('id, subscription_code, client_name')

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

  let lookupMaps = { clientsByTaxId: new Map(), facturablesByCode: new Map() }
  if (!args['dry-run']) {
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL.')
    }
    const supabase = createClient(supabaseUrl, resolveServiceKey(env), {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    lookupMaps = await fetchLookupMaps(supabase)
    const rows = items.map((item) => mapSubscriptionItem(item, { listId, siteId, ...lookupMaps }))
    const saved = await upsertSubscriptions(supabase, rows, batchSize)
    console.log(`Suscripciones source list: ${listId}`)
    console.log(`SharePoint items: ${items.length}`)
    console.log(`Mapped subscriptions: ${rows.length}`)
    console.log(`Upserted subscriptions: ${saved.length}`)
    return
  }

  const rows = items.map((item) => mapSubscriptionItem(item, { listId, siteId, ...lookupMaps }))
  console.log(`Suscripciones source list: ${listId}`)
  console.log(`SharePoint items: ${items.length}`)
  console.log(`Mapped subscriptions: ${rows.length}`)
  if (rows.length !== 10) {
    console.log(`Warning: expected 10 subscriptions, mapped ${rows.length}.`)
  }
  if (rows[0]) {
    console.log(`First mapped subscription: ${JSON.stringify(rows[0], null, 2)}`)
  }
}

main().catch((error) => {
  console.error(error?.message ?? error)
  process.exit(1)
})
