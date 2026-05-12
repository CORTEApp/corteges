#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const LIST_IDS = {
  expenses: '03c402ab-1b52-4606-ad9b-163fca7be013',
  clients: '1384b90c-9aa8-47ea-9d4c-3ea4deed7328',
  billing: '918d3f77-aa39-4e86-8b1a-831aef7ad68c',
}

const MIME_TYPES = new Map([
  ['.csv', 'text/csv'],
  ['.doc', 'application/msword'],
  ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['.gif', 'image/gif'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.mov', 'video/quicktime'],
  ['.mp4', 'video/mp4'],
  ['.pdf', 'application/pdf'],
  ['.png', 'image/png'],
  ['.txt', 'text/plain'],
  ['.xls', 'application/vnd.ms-excel'],
  ['.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['.zip', 'application/zip'],
])

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
  node tools/sharepoint_upload_binaries.mjs --export-dir .sharepoint-export
  node tools/sharepoint_upload_binaries.mjs --local-dir ./binary-drop --export-dir .sharepoint-export

Options:
  --export-dir <dir>    SharePoint export directory. Defaults to .sharepoint-export
  --local-dir <dir>     Local fallback using <listId>/<itemId>/<fileName>
  --list-id <guid>      Process only files from one SharePoint list. Can be repeated with comma-separated values
  --extensions <list>   Process only file extensions, for example ".pdf" or ".pdf,.docx"
  --dry-run             Resolve mappings without uploading or writing metadata
  --limit <number>      Process only the first N binary files
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

function resolveSupabaseUrl(env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL
  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL.')
  }
  return url
}

function resolveServiceKey(env) {
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error('Missing SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.')
  }
  return key
}

function normalizeGuid(value) {
  return String(value ?? '').trim().replace(/[{}]/g, '').toLowerCase()
}

function safeFileName(value) {
  const cleaned = String(value ?? 'sharepoint-file')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || 'sharepoint-file'
}

function parseListIdFilter(value) {
  const entries = String(value ?? '')
    .split(',')
    .map((entry) => normalizeGuid(entry))
    .filter(Boolean)
  return new Set(entries)
}

function parseExtensionFilter(value) {
  const entries = String(value ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .map((entry) => (entry.startsWith('.') ? entry : `.${entry}`))
  return new Set(entries)
}

function matchesFilters(entry, { listIds, extensions }) {
  if (listIds.size > 0 && !listIds.has(normalizeGuid(entry.sharepoint_list_id))) {
    return false
  }

  if (extensions.size > 0 && !extensions.has(path.extname(String(entry.file_name ?? '')).toLowerCase())) {
    return false
  }

  return true
}

function contentTypeFor(fileName, fallback) {
  if (fallback && fallback !== 'null') {
    return fallback
  }
  return MIME_TYPES.get(path.extname(fileName).toLowerCase()) || 'application/octet-stream'
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256')
  hash.update(fs.readFileSync(filePath))
  return hash.digest('hex')
}

function walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath))
    } else if (entry.isFile()) {
      files.push(fullPath)
    }
  }
  return files
}

function readExportContext(exportDir) {
  const site = readJson(path.join(exportDir, 'site.json'), {})
  const lists = readJson(path.join(exportDir, 'lists.json'), [])
  const listById = new Map(lists.map((list) => [normalizeGuid(list.Id), list]))
  return { site, listById }
}

function buildLocalManifest(localDir, exportDir) {
  const { site, listById } = readExportContext(exportDir)
  const files = []
  for (const filePath of walkFiles(localDir)) {
    const relative = path.relative(localDir, filePath)
    const parts = relative.split(path.sep)
    if (parts.length < 3) {
      continue
    }

    const listId = normalizeGuid(parts[0])
    const itemId = Number.parseInt(parts[1], 10)
    if (!listId || !Number.isFinite(itemId)) {
      continue
    }

    const list = listById.get(listId)
    files.push({
      source_kind: 'local_file',
      sharepoint_site_id: site.Id ?? '',
      sharepoint_list_id: listId,
      sharepoint_list_title: list?.Title ?? parts[0],
      sharepoint_item_id: itemId,
      sharepoint_unique_id: null,
      sharepoint_etag: null,
      file_name: path.basename(filePath),
      server_relative_url: null,
      web_url: null,
      content_type: null,
      local_path: filePath,
      downloaded_at: null,
      raw: { local_relative_path: relative.replaceAll(path.sep, '/') },
    })
  }

  return {
    generated_at: new Date().toISOString(),
    site,
    source: 'local-dir',
    files,
    errors: [],
  }
}

function loadManifest(args, exportDir) {
  if (args['local-dir']) {
    return buildLocalManifest(path.resolve(ROOT, String(args['local-dir'])), exportDir)
  }

  const manifestPath = path.join(exportDir, 'binaries', 'manifest.json')
  return readJson(manifestPath)
}

function resolveLocalFile(entry, exportDir) {
  const localPath = String(entry.local_path ?? '')
  if (!localPath) {
    return null
  }
  return path.isAbsolute(localPath) ? localPath : path.join(exportDir, localPath)
}

async function maybeSingleId(query, label) {
  const { data, error } = await query.maybeSingle()
  if (error) {
    throw new Error(`${label}: ${error.message}`)
  }
  return data?.id ?? null
}

async function resolveDestination(supabase, entry) {
  const listId = normalizeGuid(entry.sharepoint_list_id)
  const itemId = Number(entry.sharepoint_item_id)

  if (listId === LIST_IDS.expenses) {
    const id = await maybeSingleId(
      supabase
        .from('expense_individuals')
        .select('id')
        .eq('sharepoint_list_id', listId)
        .eq('sharepoint_item_id', itemId),
      `expense_individuals ${listId}/${itemId}`,
    )
    if (id) {
      return { kind: 'expense', table: 'expense_individual_documents', recordId: id, bucket: 'expense-documents' }
    }
  }

  if (listId === LIST_IDS.clients) {
    const id = await maybeSingleId(
      supabase
        .from('clients')
        .select('id')
        .eq('sharepoint_list_id', listId)
        .eq('sharepoint_item_id', itemId),
      `clients ${listId}/${itemId}`,
    )
    if (id) {
      return { kind: 'client', table: 'client_documents', recordId: id, bucket: 'client-documents' }
    }
  }

  if (listId === LIST_IDS.billing) {
    const id = await maybeSingleId(
      supabase
        .from('billing_documents')
        .select('id')
        .eq('sharepoint_list_id', listId)
        .eq('sharepoint_item_id', itemId),
      `billing_documents ${listId}/${itemId}`,
    )
    if (id) {
      return { kind: 'billing', table: 'billing_document_files', recordId: id, bucket: 'billing-documents' }
    }
  }

  return { kind: 'archive', table: null, recordId: null, bucket: 'sharepoint-binaries' }
}

function storagePathFor(entry, destination, sha256) {
  const listId = normalizeGuid(entry.sharepoint_list_id)
  const itemId = Number(entry.sharepoint_item_id)
  const fileName = safeFileName(entry.file_name)

  if (destination.kind === 'archive') {
    return `${listId}/${itemId}/${sha256}-${fileName}`
  }

  return `${destination.recordId}/sharepoint/${itemId}-${sha256}-${fileName}`
}

async function uploadObject(supabase, bucket, storagePath, filePath, contentType) {
  const body = fs.readFileSync(filePath)
  const { error } = await supabase.storage.from(bucket).upload(storagePath, body, {
    contentType,
    cacheControl: '3600',
    upsert: true,
  })

  if (error) {
    throw new Error(`Storage upload failed for ${bucket}/${storagePath}: ${error.message}`)
  }
}

async function upsertBinaryInventory(supabase, row) {
  const table = supabase.schema('sharepoint_import').from('binary_files')
  const { data: existing, error: existingError } = await table
    .select('id')
    .eq('storage_bucket', row.storage_bucket)
    .eq('storage_path', row.storage_path)
    .maybeSingle()

  if (existingError) {
    throw existingError
  }

  if (existing?.id) {
    const { data, error } = await table
      .update(row)
      .eq('id', existing.id)
      .select('id')
      .single()
    if (error) {
      throw error
    }
    return data.id
  }

  const { data, error } = await table
    .insert(row)
    .select('id')
    .single()
  if (error) {
    throw error
  }
  return data.id
}

async function upsertFunctionalDocument(supabase, destination, row) {
  const tableName = destination.table
  if (!tableName) {
    return
  }

  const { error } = await supabase
    .from(tableName)
    .upsert(row, { onConflict: 'storage_path' })

  if (error) {
    throw error
  }
}

function publicDocumentRow(destination, entry, storagePath, sha256, fileSize, contentType, binaryFileId) {
  const common = {
    file_name: entry.file_name,
    mime_type: contentType,
    file_size: fileSize,
    storage_bucket: destination.bucket,
    storage_path: storagePath,
    source_kind: 'sharepoint',
    source_sha256: sha256,
    source_url: entry.web_url || entry.server_relative_url || null,
    source_downloaded_at: entry.downloaded_at || null,
    sharepoint_site_id: entry.sharepoint_site_id || null,
    sharepoint_list_id: normalizeGuid(entry.sharepoint_list_id),
    sharepoint_item_id: Number(entry.sharepoint_item_id),
    sharepoint_unique_id: entry.sharepoint_unique_id || null,
    binary_file_id: binaryFileId,
    uploaded_by: null,
  }

  if (destination.kind === 'expense') {
    return { ...common, expense_id: destination.recordId }
  }

  if (destination.kind === 'client') {
    return { ...common, client_id: destination.recordId }
  }

  if (destination.kind === 'billing') {
    return { ...common, document_id: destination.recordId }
  }

  return null
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help || args.h) {
    printHelp()
    return
  }

  const exportDir = path.resolve(ROOT, String(args['export-dir'] || '.sharepoint-export'))
  const env = {
    ...readEnvFile(path.resolve(ROOT, '.env.local')),
    ...readEnvFile(path.resolve(ROOT, '../m365.env')),
    ...process.env,
  }
  const supabase = createClient(resolveSupabaseUrl(env), resolveServiceKey(env), {
    auth: { persistSession: false },
  })

  const manifest = loadManifest(args, exportDir)
  const limit = args.limit ? Number.parseInt(String(args.limit), 10) : null
  const allFiles = manifest.files ?? []
  const filters = {
    listIds: parseListIdFilter(args['list-id'] || args['list-ids']),
    extensions: parseExtensionFilter(args.extensions || args.extension),
  }
  const filteredFiles = allFiles.filter((entry) => matchesFilters(entry, filters))
  const files = filteredFiles.slice(0, Number.isFinite(limit) ? limit : undefined)
  const dryRun = Boolean(args['dry-run'])
  const summary = {
    candidates: files.length,
    filtered_out: allFiles.length - filteredFiles.length,
    missing_local_file: 0,
    expense: 0,
    client: 0,
    billing: 0,
    archive: 0,
    uploaded: 0,
    metadata_rows: 0,
    inventory_skipped: 0,
    errors: 0,
  }
  let inventoryAvailable = !Boolean(args['skip-inventory'])

  for (const entry of files) {
    try {
      const filePath = resolveLocalFile(entry, exportDir)
      if (!filePath || !fs.existsSync(filePath)) {
        summary.missing_local_file += 1
        console.warn(`Missing local file for ${entry.sharepoint_list_id}/${entry.sharepoint_item_id}: ${entry.local_path}`)
        continue
      }

      const sha256 = entry.sha256 || sha256File(filePath)
      const fileSize = entry.file_size ?? fs.statSync(filePath).size
      const contentType = contentTypeFor(entry.file_name, entry.content_type)
      const destination = await resolveDestination(supabase, entry)
      const storagePath = storagePathFor(entry, destination, sha256)
      summary[destination.kind] += 1

      if (dryRun) {
        continue
      }

      await uploadObject(supabase, destination.bucket, storagePath, filePath, contentType)
      summary.uploaded += 1

      const inventoryRow = {
        source_kind: entry.source_kind === 'document_library' ? 'document_library' : entry.source_kind === 'local_file' ? 'local_file' : 'list_attachment',
        sharepoint_site_id: entry.sharepoint_site_id || manifest.site?.Id || null,
        sharepoint_list_id: normalizeGuid(entry.sharepoint_list_id),
        sharepoint_list_title: entry.sharepoint_list_title || null,
        sharepoint_item_id: Number(entry.sharepoint_item_id),
        sharepoint_unique_id: entry.sharepoint_unique_id || null,
        sharepoint_etag: entry.sharepoint_etag || null,
        file_name: entry.file_name,
        server_relative_url: entry.server_relative_url || null,
        web_url: entry.web_url || null,
        content_type: contentType,
        file_size: fileSize,
        sha256,
        local_path: entry.local_path || null,
        storage_bucket: destination.bucket,
        storage_path: storagePath,
        destination_table: destination.table,
        destination_record_id: destination.recordId,
        download_status: 'uploaded',
        error_message: null,
        raw: entry.raw ?? entry,
        downloaded_at: entry.downloaded_at || null,
        uploaded_at: new Date().toISOString(),
      }

      let binaryFileId = null
      if (inventoryAvailable) {
        try {
          binaryFileId = await upsertBinaryInventory(supabase, inventoryRow)
          summary.metadata_rows += 1
        } catch (error) {
          if (String(error.message ?? error).includes('Invalid schema: sharepoint_import')) {
            inventoryAvailable = false
            summary.inventory_skipped += 1
            console.warn('Skipping sharepoint_import.binary_files inventory: schema is not exposed through PostgREST.')
          } else {
            throw error
          }
        }
      } else {
        summary.inventory_skipped += 1
      }

      const row = publicDocumentRow(destination, entry, storagePath, sha256, fileSize, contentType, binaryFileId)
      if (row) {
        await upsertFunctionalDocument(supabase, destination, row)
      }
    } catch (error) {
      summary.errors += 1
      console.error(`Binary upload failed for ${entry.sharepoint_list_id}/${entry.sharepoint_item_id}/${entry.file_name}: ${error.message}`)
      if (!args['continue-on-error']) {
        throw error
      }
    }
  }

  console.log(`Binary candidates: ${summary.candidates}`)
  console.log(`Filtered out: ${summary.filtered_out}`)
  console.log(`Mapped to gastos: ${summary.expense}`)
  console.log(`Mapped to clientes: ${summary.client}`)
  console.log(`Mapped to facturas: ${summary.billing}`)
  console.log(`Archived only: ${summary.archive}`)
  console.log(`Missing local files: ${summary.missing_local_file}`)
  console.log(`Uploaded objects: ${summary.uploaded}`)
  console.log(`Inventory rows: ${summary.metadata_rows}`)
  console.log(`Inventory skipped: ${summary.inventory_skipped}`)
  console.log(`Errors: ${summary.errors}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
