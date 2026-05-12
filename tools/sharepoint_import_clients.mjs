#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

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

async function upsertHistory(supabase, rows, batchSize) {
  const saved = []
  for (const batch of chunks(rows, batchSize)) {
    const { data, error } = await supabase
      .from('client_history_entries')
      .upsert(batch, { onConflict: 'sharepoint_site_id,sharepoint_list_id,sharepoint_item_id' })
      .select('id, client_id, source_key, is_current')

    if (error) {
      throw error
    }
    saved.push(...(data ?? []))
  }
  return saved
}

async function clearCurrentHistoryForClients(supabase, clientIds, batchSize) {
  const ids = [...new Set(clientIds.filter(Boolean))]
  for (const batch of chunks(ids, batchSize)) {
    const { error } = await supabase
      .from('client_history_entries')
      .update({ is_current: false })
      .in('client_id', batch)
      .eq('is_current', true)

    if (error) {
      throw error
    }
  }
}

async function updateClientCurrentHistoryPointers(supabase, historyRows) {
  const currentRows = historyRows.filter((row) => row.is_current && row.client_id)
  for (const row of currentRows) {
    const { error } = await supabase
      .from('clients')
      .update({ current_history_entry_id: row.id })
      .eq('id', row.client_id)

    if (error) {
      throw error
    }
  }
}

function printHelp() {
  console.log(`Usage:
  node tools/sharepoint_import_clients.mjs --export-dir .sharepoint-export

Options:
  --export-dir <dir>       SharePoint export directory. Defaults to .sharepoint-export
  --list-id <guid>         Force one SharePoint list id
  --list-title <title>     Force one SharePoint list title. Defaults to Clientes auto-detection
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
  const text = valueText(value)
  if (text == null) {
    return null
  }
  const trimmed = String(text).trim()
  return trimmed ? trimmed : null
}

function valueText(value) {
  if (value == null) {
    return null
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (Array.isArray(value)) {
    return value.map((item) => valueText(item)).filter(Boolean).join('; ')
  }
  if (typeof value === 'object') {
    return value.LookupValue ?? value.Label ?? value.Description ?? value.Url ?? value.Email ?? JSON.stringify(value)
  }
  return String(value)
}

function parseDate(value) {
  const text = cleanText(value)
  if (!text) {
    return null
  }

  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (dateOnly) {
    return `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`
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

function parseDateTime(value) {
  const text = cleanText(value)
  if (!text) {
    return null
  }
  const parsed = new Date(text)
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString()
}

function parseNumber(value) {
  const text = cleanText(value)
  if (!text) {
    return null
  }
  const parsed = Number.parseFloat(text.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function parseBoolean(value) {
  if (typeof value === 'boolean') {
    return value
  }

  const normalized = normalizeKey(cleanText(value))
  if (!normalized) {
    return true
  }
  if (['si', 's', 'yes', 'y', 'true', '1', 'activo', 'activa'].includes(normalized)) {
    return true
  }
  if (['no', 'n', 'false', '0', 'inactivo', 'inactiva', 'baja', 'pendiente'].includes(normalized)) {
    return false
  }
  return false
}

function isCurrentLine(value) {
  const normalized = normalizeKey(value)
  return ['si', 's', 'yes', 'y', 'true', '1', 'vigente', 'actual'].includes(normalized)
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

function buildValueIndex(fields, values) {
  const index = new Map()

  for (const field of fields) {
    const rawValue =
      values[field.InternalName] ??
      values[field.StaticName] ??
      values[field.Title] ??
      values[field.InternalName?.replace(/_/g, 'x005f')] ??
      null

    for (const key of [field.Title, field.InternalName, field.StaticName]) {
      const normalized = normalizeKey(key)
      if (normalized && !index.has(normalized)) {
        index.set(normalized, rawValue)
      }
    }
  }

  for (const [key, rawValue] of Object.entries(values)) {
    const normalized = normalizeKey(key)
    if (normalized && !index.has(normalized)) {
      index.set(normalized, rawValue)
    }
  }

  return index
}

function pick(index, keys) {
  for (const key of keys) {
    const normalized = normalizeKey(key)
    if (!normalized || !index.has(normalized)) {
      continue
    }
    const value = index.get(normalized)
    if (value != null && cleanText(value) !== '') {
      return value
    }
  }
  return null
}

function scoreClientList(fields, listTitle) {
  const fieldKeys = new Set()
  for (const field of fields) {
    fieldKeys.add(normalizeKey(field.Title))
    fieldKeys.add(normalizeKey(field.InternalName))
    fieldKeys.add(normalizeKey(field.StaticName))
  }

  let score = 0
  const normalizedTitle = normalizeKey(listTitle)
  if (['clientes', 'cliente', 'clients'].includes(normalizedTitle)) {
    score += 100
  }
  if (normalizedTitle.includes('client')) {
    score += 50
  }
  if (fieldKeys.has('cif') || fieldKeys.has('nif') || fieldKeys.has('cifnif')) {
    score += 25
  }
  if (fieldKeys.has('nombre') || fieldKeys.has('title') || fieldKeys.has('titulo')) {
    score += 20
  }
  if (fieldKeys.has('metododepago') || fieldKeys.has('formadepago')) {
    score += 10
  }
  if (fieldKeys.has('correodefacturacion') || fieldKeys.has('emailfacturacion')) {
    score += 10
  }
  return score
}

function findClientList(exportDir, lists, args) {
  if (args['list-id']) {
    const forcedId = cleanGuid(args['list-id'])
    const forced = lists.find((list) => cleanGuid(list.Id) === forcedId)
    if (!forced) {
      throw new Error(`No SharePoint list found for --list-id ${forcedId}`)
    }
    return forced
  }

  if (args['list-title']) {
    const forcedTitle = normalizeKey(args['list-title'])
    const forced = lists.find((list) => normalizeKey(list.Title) === forcedTitle)
    if (!forced) {
      throw new Error(`No SharePoint list found for --list-title ${args['list-title']}`)
    }
    return forced
  }

  const candidates = lists
    .map((list) => {
      const listId = cleanGuid(list.Id)
      const fields = readJson(path.join(exportDir, 'fields', `${listId}.json`), [])
      return {
        list,
        score: scoreClientList(fields, list.Title),
      }
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score)

  if (!candidates.length) {
    throw new Error('No Clientes list candidate found. Pass --list-title or --list-id.')
  }

  if (candidates.length > 1 && candidates[0].score === candidates[1].score) {
    const names = candidates.slice(0, 5).map((candidate) => `${candidate.list.Title} (${cleanGuid(candidate.list.Id)})`).join(', ')
    throw new Error(`Ambiguous Clientes list candidates: ${names}. Pass --list-title or --list-id.`)
  }

  return candidates[0].list
}

function mapClientItem(list, fields, item, siteId) {
  const values = item.Values ?? {}
  const index = buildValueIndex(fields, values)
  const sharepointListId = cleanGuid(list.Id)
  const sharepointItemId = Number.parseInt(item.Id, 10)
  const sourceKey = ['sharepoint', siteId, sharepointListId, sharepointItemId].join(':')

  const taxId = cleanText(pick(index, ['cif', 'nif', 'cif/nif', 'cif nif', 'tax id', 'taxid', 'vat', 'identificador fiscal']))
  const name =
    cleanText(pick(index, ['nombre', 'razon social', 'razonsocial', 'cliente', 'client', 'title', 'titulo'])) ??
    taxId

  const activeValue = pick(index, ['activo', 'active', 'estado'])
  const historyRow = {
    client_id: null,
    tax_id: taxId,
    name,
    address: cleanText(pick(index, ['direccion', 'address', 'domicilio'])),
    contact_name: cleanText(pick(index, ['nombre de contacto', 'nombredecontacto', 'nombrecontacto', 'contacto', 'contact name', 'contactname'])),
    contact_phone: cleanText(pick(index, ['telefono de contacto', 'telefonodecontacto', 'telefonocontacto', 'telefono', 'phone', 'movil', 'mobile'])),
    contact_email: cleanText(pick(index, ['correo de contacto', 'correodecontacto', 'correocontacto', 'email contacto', 'contact email', 'contactemail', 'correo', 'email'])),
    billing_email: cleanText(pick(index, ['correo de facturacion', 'correodefacturacion', 'correofacturacion', 'email facturacion', 'billing email', 'billingemail'])),
    start_date: parseDate(pick(index, ['fecha de inicio', 'fechadeinicio', 'fechainicio', 'fecha alta', 'fechaalta', 'start date', 'startdate'])),
    customer_rating: parseNumber(pick(index, ['calificacion de cliente', 'calificaciondecliente', 'calificacioncliente', 'rating', 'score', 'puntuacion'])),
    active: parseBoolean(activeValue),
    active_label: cleanText(activeValue),
    payment_method: normalizePaymentMethod(pick(index, ['metodo de pago', 'metododepago', 'metodopago', 'metodo pago', 'forma de pago', 'formadepago', 'payment method', 'paymentmethod'])),
    stripe_reference: cleanText(pick(index, ['stripe', 'referencia stripe', 'referenciastripe', 'stripe reference'])),
    sepa_reference: cleanText(pick(index, ['sepa', 'referencia sepa', 'referenciasepa', 'mandato sepa'])),
    payment_notes: null,
    comments: cleanText(pick(index, ['comentarios', 'comments', 'observaciones', 'notas'])),
    current_line: cleanText(pick(index, ['lineavigente', 'linea vigente', 'linea actual'])),
    source_kind: 'sharepoint',
    source_key: sourceKey,
    is_current: false,
    created_by: null,
    lead_id: cleanText(pick(index, ['lead_id', 'lead id', 'lead'])),
    source_created_at: parseDateTime(pick(index, ['created', 'creado'])),
    source_modified_at: parseDateTime(pick(index, ['modified', 'modificado'])),
    sharepoint_site_id: siteId,
    sharepoint_list_id: sharepointListId,
    sharepoint_item_id: sharepointItemId,
    sharepoint_unique_id: item.UniqueId ?? values.GUID ?? null,
    sharepoint_etag: item.ETag ?? values['@odata.etag'] ?? null,
    raw: item,
    imported_at: new Date().toISOString(),
  }

  const currentRow = taxId && name ? {
    tax_id: historyRow.tax_id,
    name: historyRow.name,
    address: historyRow.address,
    contact_name: historyRow.contact_name,
    contact_phone: historyRow.contact_phone,
    contact_email: historyRow.contact_email,
    billing_email: historyRow.billing_email,
    start_date: historyRow.start_date,
    customer_rating: historyRow.customer_rating,
    active: historyRow.active ?? true,
    payment_method: historyRow.payment_method,
    stripe_reference: historyRow.stripe_reference,
    sepa_reference: historyRow.sepa_reference,
    payment_notes: historyRow.payment_notes,
    comments: historyRow.comments,
    sharepoint_site_id: historyRow.sharepoint_site_id,
    sharepoint_list_id: historyRow.sharepoint_list_id,
    sharepoint_item_id: historyRow.sharepoint_item_id,
    sharepoint_unique_id: historyRow.sharepoint_unique_id,
    updated_at: new Date().toISOString(),
  } : null

  return { historyRow, currentRow }
}

function clientRowScore(mapped) {
  const row = mapped.currentRow
  const historyRow = mapped.historyRow
  const filledFields = [
    row.name,
    row.address,
    row.contact_name,
    row.contact_phone,
    row.contact_email,
    row.billing_email,
    row.start_date,
    row.customer_rating,
    row.stripe_reference,
    row.sepa_reference,
    row.comments,
  ].filter((value) => value != null && value !== '').length

  const paymentScore = row.payment_method && row.payment_method !== 'unknown' ? 5 : 0
  const activeScore = row.active ? 2 : 0
  const currentLineScore = isCurrentLine(historyRow.current_line) ? 100000 : 0
  const sourceTime = historyRow.source_modified_at ? Date.parse(historyRow.source_modified_at) || 0 : 0
  const modifiedScore = sourceTime / 1000000000
  const itemScore = (row.sharepoint_item_id ?? 0) / 100000
  return currentLineScore + filledFields * 10 + paymentScore + activeScore + modifiedScore + itemScore
}

function pickBestClientRows(mappedItems) {
  const byTaxId = new Map()
  for (const item of mappedItems) {
    const row = item.currentRow
    if (!row) {
      continue
    }
    const current = byTaxId.get(row.tax_id)
    if (!current || clientRowScore(item) >= clientRowScore(current)) {
      byTaxId.set(row.tax_id, item)
    }
  }
  return [...byTaxId.values()].map((item) => item.currentRow)
}

function sourceKeyFromClientRow(row) {
  return ['sharepoint', row.sharepoint_site_id, row.sharepoint_list_id, row.sharepoint_item_id].join(':')
}

function chunks(items, size) {
  const result = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

async function upsertClients(supabase, rows, batchSize) {
  const saved = []
  for (const batch of chunks(rows, batchSize)) {
    const { data, error } = await supabase
      .from('clients')
      .upsert(batch, { onConflict: 'tax_id' })
      .select('id, tax_id, name')

    if (error) {
      throw error
    }
    saved.push(...(data ?? []))
  }
  return saved
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

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help || args.h) {
    printHelp()
    return
  }

  const env = { ...readEnvFile(path.join(ROOT, '.env.local')), ...process.env }
  const exportDir = path.resolve(ROOT, args['export-dir'] || env.SHAREPOINT_EXPORT_DIR || '.sharepoint-export')
  const batchSize = Number.parseInt(args['batch-size'] || '250', 10)

  if (!fs.existsSync(exportDir)) {
    throw new Error(`Missing SharePoint export directory: ${exportDir}. Run npm run sharepoint:export first.`)
  }

  const site = readJson(path.join(exportDir, 'site.json'), {})
  const lists = asArray(readJson(path.join(exportDir, 'lists.json'), []))
  const list = findClientList(exportDir, lists, args)
  const listId = cleanGuid(list.Id)
  const fields = asArray(readJson(path.join(exportDir, 'fields', `${listId}.json`), []))
  const items = asArray(readJson(path.join(exportDir, 'items', `${listId}.json`), []))
  const siteId = cleanGuid(site.Id) || env.SHAREPOINT_SITE_URL || 'sharepoint-site'

  const mapped = items.map((item) => mapClientItem(list, fields, item, siteId))
  const missingTaxId = mapped.filter((item) => !item.historyRow.tax_id).length
  const missingCurrent = mapped.filter((item) => !item.currentRow).length

  const uniqueRows = pickBestClientRows(mapped)
  const currentSourceKeys = new Set(uniqueRows.map(sourceKeyFromClientRow))

  console.log(`Clientes source list: ${list.Title} (${listId})`)
  console.log(`SharePoint items: ${items.length}`)
  console.log(`Current clients: ${uniqueRows.length}`)
  console.log(`History entries: ${mapped.length}`)
  console.log(`History entries without tax_id: ${missingTaxId}`)
  console.log(`Entries not promoted to current clients: ${missingCurrent}`)

  if (args['dry-run']) {
    if (uniqueRows[0]) {
      console.log(`First mapped client: ${JSON.stringify(uniqueRows[0], null, 2)}`)
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

  const saved = await upsertClients(supabase, uniqueRows, batchSize)
  const clientIdByTaxId = new Map(saved.map((row) => [row.tax_id, row.id]))
  const clientIdByName = new Map(saved.map((row) => [normalizeKey(row.name), row.id]))
  const historyRows = mapped.map(({ historyRow }) => ({
    ...historyRow,
    client_id: historyRow.tax_id
      ? clientIdByTaxId.get(historyRow.tax_id) ?? null
      : clientIdByName.get(normalizeKey(historyRow.name)) ?? null,
    is_current: currentSourceKeys.has(historyRow.source_key),
  }))
  await clearCurrentHistoryForClients(supabase, saved.map((row) => row.id), batchSize)
  const savedHistory = await upsertHistory(supabase, historyRows, batchSize)
  await updateClientCurrentHistoryPointers(supabase, savedHistory)
  console.log(`Upserted clients: ${saved.length}`)
  console.log(`Upserted history entries: ${savedHistory.length}`)
}

main().catch((error) => {
  console.error(error?.message ?? error)
  process.exit(1)
})
