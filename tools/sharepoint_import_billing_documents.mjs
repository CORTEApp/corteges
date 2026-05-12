#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const FACTURAS_LIST_ID = '918d3f77-aa39-4e86-8b1a-831aef7ad68c'
const TRABAJOS_LIST_ID = '0ef1a866-f25e-47de-97ec-fce8785067d6'

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
  node tools/sharepoint_import_billing_documents.mjs --export-dir .sharepoint-export

Options:
  --export-dir <dir>       SharePoint export directory. Defaults to .sharepoint-export
  --batch-size <number>    Upsert batch size. Defaults to 150
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
    return `${match[1]}-${match[2]}-${match[3]}`
  }
  const parsed = new Date(text)
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString().slice(0, 10)
}

function parseDocumentNumber(value) {
  const text = cleanText(value)
  const match = text?.match(/^([A-Za-z]+)-(\d{4})\/(\d+)$/)
  if (!match) {
    return null
  }
  return {
    series: match[1].toUpperCase(),
    numberYear: Number.parseInt(match[2], 10),
    numberValue: Number.parseInt(match[3], 10),
    documentNumber: `${match[1].toUpperCase()}-${match[2]}/${Number.parseInt(match[3], 10)}`,
  }
}

function normalizePaymentStatus(value) {
  const normalized = normalizeKey(value)
  if (['si', 'yes', 'true', '1', 'pagado', 'cobrado'].includes(normalized)) {
    return 'paid'
  }
  if (normalized === '50' || normalized.includes('50')) {
    return 'legacy_partial'
  }
  return 'unpaid'
}

function normalizePaymentMethod(value) {
  const normalized = normalizeKey(value)
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

function documentTypeFromFactura(values) {
  return normalizeKey(values.TipoP).includes('presupuesto') ? 'proforma' : 'invoice'
}

function statusFromFactura(values, documentType, paymentStatus) {
  if (documentType === 'invoice') {
    return paymentStatus === 'paid' ? 'paid' : 'issued'
  }

  const estado = normalizeKey(values.EstadoPresupuesto)
  if (estado.includes('descart')) {
    return 'discarded'
  }
  if (estado.includes('factura')) {
    return 'invoiced'
  }
  return paymentStatus === 'paid' ? 'paid' : 'issued'
}

function mapFacturaItem(item, { listId, siteId }) {
  const values = item.Values ?? {}
  const documentType = documentTypeFromFactura(values)
  const number = parseDocumentNumber(values.Title ?? values.Presupuesto)
  if (!number) {
    return null
  }

  const paymentStatus = normalizePaymentStatus(values.Cobrado)
  const issueDate =
    documentType === 'proforma'
      ? parseDate(values.FechaPresupuesto ?? values.Fecha)
      : parseDate(values.Fecha ?? values.FechaPresupuesto)

  return {
    document_type: documentType,
    status: statusFromFactura(values, documentType, paymentStatus),
    payment_status: paymentStatus,
    series: number.series,
    number_year: number.numberYear,
    number_value: number.numberValue,
    document_number: number.documentNumber,
    source_proforma_number: documentType === 'invoice' ? cleanText(values.Presupuesto) : null,
    client_name: cleanText(values.Nombreempresa) ?? 'Cliente historico',
    client_tax_id: cleanText(values.CIF),
    billing_email: cleanText(values.Correo),
    project: cleanText(values.Proyecto),
    issue_date: issueDate ?? `${number.numberYear}-01-01`,
    due_date: parseDate(values.FechaVencimiento),
    paid_date: parseDate(values.FechaCobro),
    payment_method: paymentStatus === 'unpaid' ? null : normalizePaymentMethod(values.MetodoPago),
    subtotal_amount: parseNumber(values.Precio, 0),
    tax_amount: parseNumber(values.IVA, 0),
    total_amount: parseNumber(values.Total, 0),
    observations: cleanText(values.Observaciones),
    sharepoint_site_id: siteId,
    sharepoint_list_id: listId,
    sharepoint_item_id: Number.parseInt(item.Id ?? values.id ?? values.ID ?? '0', 10) || null,
    sharepoint_unique_id: cleanText(item.UniqueId ?? values.GUID),
    sharepoint_etag: cleanText(item.ETag ?? values['@odata.etag']),
    source_raw: item,
    imported_at: new Date().toISOString(),
  }
}

function lineDocumentNumber(values) {
  const tipo = normalizeKey(values.TipoFactura)
  if (tipo.includes('presupuesto')) {
    return cleanText(values.NPresupuesto)
  }
  return cleanText(values.NFactura) ?? cleanText(values.NPresupuesto)
}

function mapTrabajoItem(item, { listId, siteId }) {
  const values = item.Values ?? {}
  const documentNumber = lineDocumentNumber(values)
  if (!documentNumber) {
    return null
  }

  const quantity = parseNumber(values.Cantidad, 1)
  const unitPrice = parseNumber(values.Precio, 0)
  const vatRate = parseNumber(values.IVA, 21)
  const subtotal = Number((unitPrice * quantity).toFixed(2))
  const tax = Number((subtotal * (vatRate / 100)).toFixed(2))

  return {
    source_document_number: documentNumber,
    code: cleanText(values.Title),
    description: cleanText(values.Descripci_x00f3_n) ?? cleanText(values.Title) ?? 'Linea historica',
    quantity,
    unit_price: unitPrice,
    vat_rate: vatRate,
    unit_type: cleanText(values.TipoU) === 'Hora' ? 'Hora' : 'Unidad',
    subtotal_amount: subtotal,
    tax_amount: tax,
    total_amount: parseNumber(values.Total, Number((subtotal + tax).toFixed(2))),
    sharepoint_site_id: siteId,
    sharepoint_list_id: listId,
    sharepoint_item_id: Number.parseInt(item.Id ?? values.id ?? values.ID ?? '0', 10) || null,
    sharepoint_unique_id: cleanText(item.UniqueId ?? values.GUID),
    sharepoint_etag: cleanText(item.ETag ?? values['@odata.etag']),
    source_raw: item,
    imported_at: new Date().toISOString(),
  }
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

function sequenceRows(documents) {
  const grouped = new Map()
  for (const document of documents) {
    if (
      (document.document_type === 'invoice' && document.series !== 'F') ||
      (document.document_type === 'proforma' && document.series !== 'P')
    ) {
      continue
    }
    const key = `${document.document_type}|${document.series}|${document.number_year}`
    const current = grouped.get(key)
    if (!current || document.number_value > current.last_value) {
      grouped.set(key, {
        document_type: document.document_type,
        series: document.series,
        number_year: document.number_year,
        last_value: document.number_value,
      })
    }
  }
  return [...grouped.values()].sort((left, right) =>
    `${left.document_type}-${left.series}-${left.number_year}`.localeCompare(`${right.document_type}-${right.series}-${right.number_year}`),
  )
}

function proformaSequencesFromFacturaItems(items) {
  const grouped = new Map()
  for (const item of items) {
    const values = item.Values ?? {}
    const parsed = parseDocumentNumber(values.Presupuesto ?? values.Title)
    if (!parsed || parsed.series !== 'P') {
      continue
    }
    const key = `proforma|P|${parsed.numberYear}`
    const current = grouped.get(key)
    if (!current || parsed.numberValue > current.last_value) {
      grouped.set(key, {
        document_type: 'proforma',
        series: 'P',
        number_year: parsed.numberYear,
        last_value: parsed.numberValue,
      })
    }
  }
  return [...grouped.values()]
}

function mergeSequenceRows(...groups) {
  const merged = new Map()
  for (const group of groups) {
    for (const row of group) {
      const key = `${row.document_type}|${row.series}|${row.number_year}`
      const current = merged.get(key)
      if (!current || row.last_value > current.last_value) {
        merged.set(key, row)
      }
    }
  }
  return [...merged.values()].sort((left, right) =>
    `${left.document_type}-${left.series}-${left.number_year}`.localeCompare(`${right.document_type}-${right.series}-${right.number_year}`),
  )
}

async function fetchClientsByTaxId(supabase) {
  const { data, error } = await supabase.from('clients').select('id, tax_id').limit(2000)
  if (error) {
    throw error
  }
  return new Map((data ?? []).map((client) => [normalizeKey(client.tax_id), client.id]))
}

async function upsertDocuments(supabase, rows, batchSize) {
  const saved = []
  for (const batch of chunks(rows, batchSize)) {
    const { data, error } = await supabase
      .from('billing_documents')
      .upsert(batch, { onConflict: 'sharepoint_list_id,sharepoint_item_id' })
      .select('id, document_number')

    if (error) {
      throw error
    }
    saved.push(...(data ?? []))
  }
  return saved
}

async function upsertLines(supabase, rows, batchSize) {
  const saved = []
  for (const batch of chunks(rows, batchSize)) {
    const { data, error } = await supabase
      .from('billing_document_lines')
      .upsert(batch, { onConflict: 'sharepoint_list_id,sharepoint_item_id' })
      .select('id')

    if (error) {
      throw error
    }
    saved.push(...(data ?? []))
  }
  return saved
}

async function updateSequences(supabase, rows) {
  for (const row of rows) {
    const { data: existing, error: existingError } = await supabase
      .from('billing_number_sequences')
      .select('id, last_value')
      .eq('document_type', row.document_type)
      .eq('series', row.series)
      .eq('number_year', row.number_year)
      .maybeSingle()

    if (existingError) {
      throw existingError
    }

    if (!existing) {
      const { error } = await supabase.from('billing_number_sequences').insert(row)
      if (error) {
        throw error
      }
      continue
    }

    if ((existing.last_value ?? 0) < row.last_value) {
      const { error } = await supabase
        .from('billing_number_sequences')
        .update({ last_value: row.last_value })
        .eq('id', existing.id)

      if (error) {
        throw error
      }
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help || args.h) {
    printHelp()
    return
  }

  const env = { ...readEnvFile(path.join(ROOT, '.env.local')), ...process.env }
  const exportDir = path.resolve(ROOT, args['export-dir'] || env.SHAREPOINT_EXPORT_DIR || '.sharepoint-export')
  const batchSize = Number.parseInt(args['batch-size'] || '150', 10)
  const site = readJson(path.join(exportDir, 'site.json'), {})
  const siteId = cleanGuid(site.Id) || env.SHAREPOINT_SITE_URL || 'sharepoint-site'
  const facturaItems = asArray(readJson(path.join(exportDir, 'items', `${FACTURAS_LIST_ID}.json`), []))
  const trabajoItems = asArray(readJson(path.join(exportDir, 'items', `${TRABAJOS_LIST_ID}.json`), []))
  const documentRows = facturaItems
    .map((item) => mapFacturaItem(item, { listId: FACTURAS_LIST_ID, siteId }))
    .filter(Boolean)
  const rawLineRows = trabajoItems
    .map((item) => mapTrabajoItem(item, { listId: TRABAJOS_LIST_ID, siteId }))
    .filter(Boolean)
  const sequences = mergeSequenceRows(sequenceRows(documentRows), proformaSequencesFromFacturaItems(facturaItems))
  const documentNumbers = new Set(documentRows.map((document) => document.document_number))
  const matchedLineRows = rawLineRows.filter((line) => documentNumbers.has(line.source_document_number))

  console.log(`Facturas source list: ${FACTURAS_LIST_ID}`)
  console.log(`Trabajos source list: ${TRABAJOS_LIST_ID}`)
  console.log(`SharePoint Facturas items: ${facturaItems.length}`)
  console.log(`Mapped billing documents: ${documentRows.length}`)
  console.log(`SharePoint Trabajos items: ${trabajoItems.length}`)
  console.log(`Mapped billing lines: ${rawLineRows.length}`)
  console.log(`Lines matching imported documents: ${matchedLineRows.length}`)
  if (matchedLineRows.length !== rawLineRows.length) {
    const missing = rawLineRows
      .filter((line) => !documentNumbers.has(line.source_document_number))
      .map((line) => line.source_document_number)
    console.log(`Lines without imported document: ${[...new Set(missing)].join(', ')}`)
  }
  console.log(`Sequences: ${JSON.stringify(sequences)}`)

  if (documentRows.length !== 135) {
    console.log(`Warning: expected 135 Facturas rows, mapped ${documentRows.length}.`)
  }
  if (rawLineRows.length !== 264) {
    console.log(`Warning: expected 264 Trabajos rows, mapped ${rawLineRows.length}.`)
  }

  if (args['dry-run']) {
    if (documentRows[0]) {
      console.log(`First mapped document: ${JSON.stringify(documentRows[0], null, 2)}`)
    }
    if (rawLineRows[0]) {
      console.log(`First mapped line: ${JSON.stringify(rawLineRows[0], null, 2)}`)
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
  const clientsByTaxId = await fetchClientsByTaxId(supabase)
  const documentRowsWithClients = documentRows.map((document) => ({
    ...document,
    client_id: document.client_tax_id ? clientsByTaxId.get(normalizeKey(document.client_tax_id)) ?? null : null,
  }))
  const savedDocuments = await upsertDocuments(supabase, documentRowsWithClients, batchSize)
  const documentIdByNumber = new Map(savedDocuments.map((document) => [document.document_number, document.id]))

  const lineCounters = new Map()
  const lineRows = matchedLineRows.map((line) => {
    const documentId = documentIdByNumber.get(line.source_document_number)
    const nextIndex = (lineCounters.get(line.source_document_number) ?? 0) + 1
    lineCounters.set(line.source_document_number, nextIndex)
    const linePayload = { ...line }
    delete linePayload.source_document_number
    return {
      ...linePayload,
      document_id: documentId,
      line_index: nextIndex,
    }
  }).filter((line) => line.document_id)

  const savedLines = await upsertLines(supabase, lineRows, batchSize)

  for (const invoice of documentRowsWithClients.filter((document) => document.document_type === 'invoice' && document.source_proforma_number)) {
    const invoiceId = documentIdByNumber.get(invoice.document_number)
    const proformaId = documentIdByNumber.get(invoice.source_proforma_number)
    if (!invoiceId || !proformaId) {
      continue
    }
    const { error } = await supabase
      .from('billing_documents')
      .update({ source_proforma_id: proformaId })
      .eq('id', invoiceId)
    if (error) {
      throw error
    }
  }

  await updateSequences(supabase, sequences)

  console.log(`Upserted billing documents: ${savedDocuments.length}`)
  console.log(`Upserted billing lines: ${savedLines.length}`)
  console.log(`Updated sequence rows: ${sequences.length}`)
}

main().catch((error) => {
  console.error(error?.message ?? error)
  process.exit(1)
})
