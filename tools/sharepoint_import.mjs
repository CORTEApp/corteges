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
    const [key, ...rest] = trimmed.split('=')
    let value = rest.join('=').trim()
    value = value.replace(/^['"]|['"]$/g, '')
    env[key.trim()] = value
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
  if (Array.isArray(value)) {
    return value.map((item) => valueText(item)).filter(Boolean).join('; ')
  }
  if (typeof value === 'object') {
    return value.LookupValue ?? value.Label ?? value.Description ?? value.Url ?? value.Email ?? JSON.stringify(value)
  }
  return String(value)
}

function lookupItemId(value) {
  if (value == null) {
    return null
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (typeof value === 'object') {
    const raw = value.LookupId ?? value.lookupId ?? value.ID ?? value.Id ?? value.id
    if (raw == null) {
      return null
    }
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function lookupValues(value) {
  if (value == null) {
    return []
  }
  if (Array.isArray(value)) {
    return value
  }
  if (Array.isArray(value.results)) {
    return value.results
  }
  return [value]
}

function coerceValue(value, pgType) {
  if (value == null || value === '') {
    return null
  }

  switch (pgType) {
    case 'bigint': {
      const parsed = Number.parseInt(typeof value === 'object' ? lookupItemId(value) : value, 10)
      return Number.isFinite(parsed) ? parsed : null
    }
    case 'numeric': {
      const parsed = Number.parseFloat(typeof value === 'object' ? valueText(value) : value)
      return Number.isFinite(parsed) ? parsed : null
    }
    case 'boolean': {
      if (typeof value === 'boolean') {
        return value
      }
      const text = String(value).toLowerCase()
      if (['true', '1', 'yes', 'si'].includes(text)) {
        return true
      }
      if (['false', '0', 'no'].includes(text)) {
        return false
      }
      return null
    }
    case 'timestamptz': {
      const parsed = new Date(value)
      return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString()
    }
    case 'text[]':
      return asArray(value).map((item) => valueText(item)).filter((item) => item != null && item !== '')
    case 'jsonb':
      return value
    case 'text':
    default:
      return valueText(value)
  }
}

function itemModifiedAt(item) {
  const raw = item.Modified ?? item.Values?.Modified
  if (!raw) {
    return null
  }
  const parsed = new Date(raw)
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString()
}

function chunks(items, size) {
  const result = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

async function upsertBatch(queryBuilder, rows, options = {}, batchSize = 500) {
  if (!rows.length) {
    return []
  }

  const output = []
  for (const batch of chunks(rows, batchSize)) {
    const { select, ...upsertOptions } = options
    const query = queryBuilder().upsert(batch, upsertOptions)
    const finalQuery = select ? query.select(select) : query
    const { data, error } = await finalQuery
    if (error) {
      throw error
    }
    if (data) {
      output.push(...data)
    }
  }
  return output
}

async function selectAll(queryFactory, pageSize = 1000) {
  const rows = []
  let from = 0
  while (true) {
    const to = from + pageSize - 1
    const { data, error } = await queryFactory().range(from, to)
    if (error) {
      throw error
    }
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) {
      break
    }
    from += pageSize
  }
  return rows
}

function stagingRow(entry, item, siteId) {
  const values = item.Values ?? {}
  const row = {
    sharepoint_site_id: siteId,
    sharepoint_list_id: entry.list_id,
    sharepoint_item_id: item.Id,
    sharepoint_unique_id: item.UniqueId ?? values.GUID ?? null,
    sharepoint_etag: item.ETag ?? null,
    sharepoint_modified_at: itemModifiedAt(item),
    raw: values,
    attachments: item.Attachments ?? [],
    documents: item.Documents ?? [],
    imported_at: new Date().toISOString(),
  }

  for (const field of entry.fields) {
    row[field.staging_column] = coerceValue(values[field.internal_name], field.pg_type)
  }

  return row
}

function publicRow(entry, item, siteId, sourceRawId) {
  const values = item.Values ?? {}
  const row = {
    source_raw_id: sourceRawId,
    sharepoint_site_id: siteId,
    sharepoint_list_id: entry.list_id,
    sharepoint_item_id: item.Id,
    sharepoint_unique_id: item.UniqueId ?? values.GUID ?? null,
    sharepoint_etag: item.ETag ?? null,
    sharepoint_modified_at: itemModifiedAt(item),
    imported_at: new Date().toISOString(),
  }

  for (const field of entry.fields) {
    const value = values[field.internal_name]
    if (field.category === 'lookup_single') {
      row[field.raw_column] = value ?? null
      row[field.lookup_item_id_column] = lookupItemId(value)
      row[field.fk_column] = null
    } else if (field.category === 'lookup_multi') {
      row[field.raw_column] = value ?? null
    } else {
      row[field.public_column] = coerceValue(value, field.pg_type)
    }
  }

  return row
}

function attachmentRows(entry, item, siteId) {
  return asArray(item.Attachments).map((attachment) => ({
    sharepoint_site_id: siteId,
    sharepoint_list_id: entry.list_id,
    sharepoint_item_id: item.Id,
    file_name: attachment.FileName ?? attachment.fileName ?? '',
    server_relative_url: attachment.ServerRelativeUrl ?? attachment.serverRelativeUrl ?? '',
    raw: attachment,
    imported_at: new Date().toISOString(),
  })).filter((row) => row.file_name || row.server_relative_url)
}

function documentRows(entry, item, siteId) {
  return asArray(item.Documents).map((document) => ({
    sharepoint_site_id: siteId,
    sharepoint_list_id: entry.list_id,
    sharepoint_item_id: item.Id,
    file_ref: document.FileRef ?? '',
    file_leaf_ref: document.FileLeafRef ?? '',
    file_dir_ref: document.FileDirRef ?? '',
    file_size: Number.parseInt(document.FileSizeDisplay, 10) || null,
    content_type: valueText(document.ContentType),
    raw: document,
    imported_at: new Date().toISOString(),
  })).filter((row) => row.file_ref || row.file_leaf_ref)
}

async function writeMetadata(supabase, manifest, exportDir, siteId, batchSize) {
  const rawLists = asArray(readJson(path.join(exportDir, 'lists.json'), []))
  const rawListsById = new Map(rawLists.map((item) => [String(item.Id).toLowerCase(), item]))

  const listRows = manifest.lists.map((entry) => ({
    site_id: siteId,
    list_id: entry.list_id,
    title: entry.title,
    slug: entry.public_table,
    kind: entry.kind,
    base_type: entry.base_type,
    raw: rawListsById.get(entry.list_id) ?? entry,
    imported_at: new Date().toISOString(),
  }))

  await upsertBatch(
    () => supabase.schema('sharepoint_import').from('lists'),
    listRows,
    { onConflict: 'site_id,list_id' },
    batchSize
  )

  const fieldRows = []
  for (const entry of manifest.lists) {
    const rawFields = asArray(readJson(path.join(exportDir, 'fields', `${entry.list_id}.json`), []))
    const rawByName = new Map(rawFields.map((field) => [field.InternalName, field]))
    for (const field of entry.fields) {
      fieldRows.push({
        site_id: siteId,
        list_id: entry.list_id,
        internal_name: field.internal_name,
        title: field.title ?? field.internal_name,
        type_as_string: field.type ?? null,
        pg_type: field.pg_type,
        staging_column: field.staging_column,
        public_column: field.public_column,
        category: field.category,
        lookup_list_id: field.lookup_list_id ?? null,
        raw: rawByName.get(field.internal_name) ?? field,
        imported_at: new Date().toISOString(),
      })
    }
  }

  await upsertBatch(
    () => supabase.schema('sharepoint_import').from('fields'),
    fieldRows,
    { onConflict: 'site_id,list_id,internal_name' },
    batchSize
  )
}

async function loadPublicMaps(supabase, manifest, siteId) {
  const maps = new Map()
  for (const entry of manifest.lists) {
    const rows = await selectAll(
      () => supabase
        .from(entry.public_table)
        .select('id, sharepoint_item_id')
        .eq('sharepoint_site_id', siteId)
        .eq('sharepoint_list_id', entry.list_id)
        .order('sharepoint_item_id', { ascending: true })
    )
    maps.set(entry.list_id, new Map(rows.map((row) => [Number(row.sharepoint_item_id), row.id])))
  }
  return maps
}

async function resolveRelations(supabase, manifest, exportDir, siteId, batchSize) {
  const publicMaps = await loadPublicMaps(supabase, manifest, siteId)
  const entryByListId = new Map(manifest.lists.map((entry) => [entry.list_id, entry]))

  for (const entry of manifest.lists) {
    const items = asArray(readJson(path.join(exportDir, 'items', `${entry.list_id}.json`), []))
    const sourceMap = publicMaps.get(entry.list_id) ?? new Map()

    for (const field of entry.fields) {
      if (field.category === 'lookup_single' && field.target_list_id && field.fk_column) {
        const targetMap = publicMaps.get(field.target_list_id) ?? new Map()
        for (const item of items) {
          const sourceId = sourceMap.get(Number(item.Id))
          const targetSharePointId = lookupItemId(item.Values?.[field.internal_name])
          const targetId = targetSharePointId ? targetMap.get(targetSharePointId) : null
          if (!sourceId || !targetId) {
            continue
          }
          const { error } = await supabase
            .from(entry.public_table)
            .update({ [field.fk_column]: targetId })
            .eq('id', sourceId)
          if (error) {
            throw error
          }
        }
      }

      if (field.category === 'lookup_multi' && field.target_list_id && field.bridge_table) {
        const targetEntry = entryByListId.get(field.target_list_id)
        const targetMap = publicMaps.get(field.target_list_id) ?? new Map()
        if (!targetEntry) {
          continue
        }

        const bridgeRows = []
        for (const item of items) {
          const sourceId = sourceMap.get(Number(item.Id))
          if (!sourceId) {
            continue
          }
          for (const value of lookupValues(item.Values?.[field.internal_name])) {
            const targetSharePointId = lookupItemId(value)
            if (!targetSharePointId) {
              continue
            }
            bridgeRows.push({
              source_id: sourceId,
              target_id: targetMap.get(targetSharePointId) ?? null,
              target_sharepoint_item_id: targetSharePointId,
              raw: value,
              imported_at: new Date().toISOString(),
            })
          }
        }

        await upsertBatch(
          () => supabase.from(field.bridge_table),
          bridgeRows,
          { onConflict: 'source_id,target_sharepoint_item_id' },
          batchSize
        )
      }
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const env = { ...readEnvFile(path.join(ROOT, '.env.local')), ...process.env }
  const exportDir = path.resolve(ROOT, args['export-dir'] || env.SHAREPOINT_EXPORT_DIR || '.sharepoint-export')
  const batchSize = Number.parseInt(args['batch-size'] || '500', 10)
  const manifestPath = path.join(exportDir, 'sql_manifest.json')

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseSecretKey = env.SUPABASE_SECRET_KEY

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL.')
  }
  if (!supabaseSecretKey) {
    throw new Error('Missing SUPABASE_SECRET_KEY. The importer never uses publishable keys.')
  }
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing ${manifestPath}. Run npm run sharepoint:sql after exporting SharePoint metadata.`)
  }

  const manifest = readJson(manifestPath)
  const siteId = manifest.site?.Id || manifest.site?.id || env.SHAREPOINT_SITE_URL || 'sharepoint-site'
  const siteUrl = manifest.site?.Url || env.SHAREPOINT_SITE_URL || ''
  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let runId = null
  const { data: run, error: runError } = await supabase
    .schema('sharepoint_import')
    .from('import_runs')
    .insert({
      site_url: siteUrl,
      site_id: siteId,
      export_dir: exportDir,
      status: 'running',
      summary: {},
    })
    .select('id')
    .single()

  if (runError) {
    throw runError
  }
  runId = run.id

  const summary = { lists: 0, staging_rows: 0, public_rows: 0, attachments: 0, documents: 0 }

  try {
    await writeMetadata(supabase, manifest, exportDir, siteId, batchSize)

    for (const entry of manifest.lists) {
      const items = asArray(readJson(path.join(exportDir, 'items', `${entry.list_id}.json`), []))
      const stagingRows = items.map((item) => stagingRow(entry, item, siteId))
      const staged = await upsertBatch(
        () => supabase.schema('sharepoint_import').from(entry.staging_table),
        stagingRows,
        {
          onConflict: 'sharepoint_site_id,sharepoint_list_id,sharepoint_item_id',
          select: 'id, sharepoint_item_id',
        },
        batchSize
      )
      const rawIdByItemId = new Map(staged.map((row) => [Number(row.sharepoint_item_id), row.id]))
      const publicRows = items.map((item) => publicRow(entry, item, siteId, rawIdByItemId.get(Number(item.Id)) ?? null))

      await upsertBatch(
        () => supabase.from(entry.public_table),
        publicRows,
        {
          onConflict: 'sharepoint_site_id,sharepoint_list_id,sharepoint_item_id',
        },
        batchSize
      )

      const attachments = items.flatMap((item) => attachmentRows(entry, item, siteId))
      const documents = items.flatMap((item) => documentRows(entry, item, siteId))

      await upsertBatch(
        () => supabase.schema('sharepoint_import').from('attachments_inventory'),
        attachments,
        { onConflict: 'sharepoint_site_id,sharepoint_list_id,sharepoint_item_id,file_name,server_relative_url' },
        batchSize
      )
      await upsertBatch(
        () => supabase.schema('sharepoint_import').from('documents_inventory'),
        documents,
        { onConflict: 'sharepoint_site_id,sharepoint_list_id,sharepoint_item_id,file_ref' },
        batchSize
      )

      summary.lists += 1
      summary.staging_rows += stagingRows.length
      summary.public_rows += publicRows.length
      summary.attachments += attachments.length
      summary.documents += documents.length
      console.log(`Imported ${entry.title}: ${items.length} item(s)`)
    }

    await resolveRelations(supabase, manifest, exportDir, siteId, batchSize)

    const { error: completeError } = await supabase
      .schema('sharepoint_import')
      .from('import_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        summary,
      })
      .eq('id', runId)
    if (completeError) {
      throw completeError
    }

    console.log(`SharePoint import complete: ${JSON.stringify(summary)}`)
  } catch (error) {
    if (runId) {
      await supabase
        .schema('sharepoint_import')
        .from('import_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          summary: { ...summary, error: error.message },
        })
        .eq('id', runId)
    }
    throw error
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
