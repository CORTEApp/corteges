#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const EXPENSE_DOCUMENTS_BUCKET = 'expense-documents'
const MAX_PDF_BYTES = 20 * 1024 * 1024
const PDF_SIGNATURE = Buffer.from('%PDF-')
const TOKEN_PREFIX = 'v1'
const MICROSOFT_SHAREPOINT_FILE_SCOPE = 'AllSites.Read'
const MICROSOFT_FILES_CONNECT_PATH = '/integraciones/microsoft/connect?purpose=files&next=%2Fperfil%23integraciones'

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
  npm run expenses:recover-pdfs:sharepoint -- --dry-run
  npm run expenses:recover-pdfs:sharepoint -- --apply --limit 25

Options:
  --dry-run              Preview only. This is the default.
  --apply                Download matched PDFs, upload them and create expense document rows.
  --limit <number>       Process only the first N missing-document expenses.
  --expense-id <uuid>    Process one expense.
  --auth-mode <mode>     delegated, app or auto. Default: delegated.
  --connection-user-id   Use one connected Microsoft user row when several exist.
  --continue-on-error    Continue after an expense-level recovery error.

The script never prints secret values or SharePoint file URLs.
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

function envValue(env, ...names) {
  for (const name of names) {
    const value = env[name]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return ''
}

function sanitizeError(value) {
  return String(value ?? '')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/client_secret=[^&\s]+/gi, 'client_secret=[redacted]')
    .replace(/refresh_token=[^&\s]+/gi, 'refresh_token=[redacted]')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/sharepoint\/[^\s]+/gi, '[storage-key-redacted]')
    .slice(0, 700)
}

function resolveSupabaseUrl(env) {
  const url = envValue(env, 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL')
  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL.')
  }
  return url
}

function resolveServiceKey(env) {
  const key = envValue(env, 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY')
  if (!key) {
    throw new Error('Missing SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.')
  }
  if (key.startsWith('sb_publishable_') || key === env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Refusing to use a publishable/anon Supabase key.')
  }
  return key
}

function resolveMicrosoftConfig(env) {
  const siteUrl = envValue(env, 'SHAREPOINT_SITE_URL')
  const tenantId = envValue(env, 'M365_TENANT_ID', 'MICROSOFT_GRAPH_TENANT_ID', 'ENTRAID_TENANT_ID', 'ENTRAID_TENANT')
  const clientId = envValue(env, 'M365_CLIENT_ID', 'MICROSOFT_GRAPH_CLIENT_ID', 'ENTRAID_CLIENT_ID')
  const clientSecret = envValue(env, 'M365_CLIENT_SECRET', 'MICROSOFT_GRAPH_CLIENT_SECRET')
  const tokenSecret = envValue(env, 'MICROSOFT_GRAPH_TOKEN_ENCRYPTION_KEY', 'MICROSOFT_GRAPH_TOKEN_KEY')

  if (!siteUrl) {
    throw new Error('Missing SHAREPOINT_SITE_URL.')
  }
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Missing Microsoft app credentials for SharePoint recovery.')
  }

  return { siteUrl: siteUrl.replace(/\/$/, ''), tenantId, clientId, clientSecret, tokenSecret }
}

function sharePointFileScope(config) {
  return `${new URL(config.siteUrl).origin}/${MICROSOFT_SHAREPOINT_FILE_SCOPE}`
}

function encryptionKey(config) {
  if (!config.tokenSecret) {
    throw new Error('Missing MICROSOFT_GRAPH_TOKEN_ENCRYPTION_KEY for delegated Microsoft connection.')
  }
  return createHash('sha256').update(config.tokenSecret).digest()
}

function encryptRefreshToken(config, value) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(config), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [TOKEN_PREFIX, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join(':')
}

function decryptRefreshToken(config, value) {
  const [version, ivText, tagText, encryptedText] = String(value ?? '').split(':')
  if (version !== TOKEN_PREFIX || !ivText || !tagText || !encryptedText) {
    throw new Error('Microsoft refresh token guardado con formato no soportado.')
  }
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(config), Buffer.from(ivText, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

function mergeScopes(...scopeGroups) {
  const result = []
  const seen = new Set()
  for (const scope of scopeGroups.flatMap((group) => String(group ?? '').split(/\s+/))) {
    const trimmed = scope.trim()
    if (!trimmed) {
      continue
    }
    const normalized = trimmed.toLowerCase()
    if (!seen.has(normalized)) {
      seen.add(normalized)
      result.push(trimmed)
    }
  }
  return result
}

function hasSharePointFileScope(scopes, expectedScope) {
  const granted = (scopes ?? []).map((scope) => String(scope).toLowerCase())
  const expected = expectedScope.toLowerCase()
  return granted.some((scope) => (
    scope === expected
    || scope === MICROSOFT_SHAREPOINT_FILE_SCOPE.toLowerCase()
    || scope.endsWith(`/${MICROSOFT_SHAREPOINT_FILE_SCOPE.toLowerCase()}`)
  ))
}

function normalizeAuthMode(args) {
  const raw = String(args['auth-mode'] ?? args.authMode ?? 'delegated').trim().toLowerCase()
  if (['delegated', 'app', 'auto'].includes(raw)) {
    return raw
  }
  throw new Error('Invalid --auth-mode. Use delegated, app or auto.')
}

function normalizeGuid(value) {
  return String(value ?? '').trim().replace(/[{}]/g, '').toLowerCase()
}

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.min(Math.max(parsed, min), max)
}

function safeFileName(value) {
  const parsed = path.parse(String(value ?? 'factura.pdf'))
  const base = String(parsed.name || 'factura')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 120)
  const extension = String(parsed.ext || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9.]/g, '')
    .toLowerCase()
    .slice(0, 12)

  return `${base || 'factura'}${extension}`
}

function pdfFileName(value) {
  const fileName = safeFileName(value)
  return fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`
}

function isPdfAttachment(file) {
  const name = String(file?.FileName ?? file?.fileName ?? '')
  const url = String(file?.ServerRelativeUrl ?? file?.serverRelativeUrl ?? '')
  return name.toLowerCase().endsWith('.pdf') || url.toLowerCase().endsWith('.pdf')
}

function hasPdfSignature(buffer) {
  return Buffer.isBuffer(buffer) && buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)
}

function odataString(value) {
  return String(value ?? '').replace(/'/g, "''")
}

async function requestMicrosoftToken(config, body) {
  const response = await fetch(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    throw new Error(`Microsoft token request failed ${response.status}: ${sanitizeError(await response.text())}`)
  }

  return response.json()
}

async function getAppOnlySharePointToken(config) {
  const resource = new URL(config.siteUrl).origin
  const payload = await requestMicrosoftToken(
    config,
    new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: `${resource}/.default`,
      grant_type: 'client_credentials',
    }),
  )
  return payload.access_token
}

async function loadDelegatedConnection(supabase, config, args) {
  const expectedScope = sharePointFileScope(config)
  let query = supabase
    .from('microsoft_user_connections')
    .select('user_id, scopes, status, refresh_token_encrypted')
    .eq('status', 'connected')

  const userId = args['connection-user-id'] || args.connectionUserId || args['user-id'] || args.userId
  if (userId) {
    query = query.eq('user_id', String(userId).trim())
  }

  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }

  const rows = data ?? []
  if (rows.length === 0) {
    throw new Error(`No hay conexion Microsoft delegada para archivos. Abre ${MICROSOFT_FILES_CONNECT_PATH} y vuelve a ejecutar.`)
  }

  const scopedRows = rows.filter((row) => hasSharePointFileScope(row.scopes, expectedScope))
  if (scopedRows.length === 0) {
    throw new Error(`La conexion Microsoft actual no tiene permiso de archivos SharePoint (${MICROSOFT_SHAREPOINT_FILE_SCOPE}). Abre ${MICROSOFT_FILES_CONNECT_PATH} y vuelve a ejecutar.`)
  }
  if (scopedRows.length > 1) {
    throw new Error('Hay varias conexiones Microsoft delegadas con permiso de archivos. Ejecuta con --connection-user-id.')
  }

  return scopedRows[0]
}

async function getDelegatedSharePointToken(supabase, config, args) {
  const connection = await loadDelegatedConnection(supabase, config, args)
  const scope = sharePointFileScope(config)
  const token = await requestMicrosoftToken(
    config,
    new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: decryptRefreshToken(config, connection.refresh_token_encrypted),
      scope,
    }),
  )

  const { error } = await supabase
    .from('microsoft_user_connections')
    .update({
      ...(token.refresh_token ? { refresh_token_encrypted: encryptRefreshToken(config, token.refresh_token) } : {}),
      scopes: mergeScopes((connection.scopes ?? []).join(' '), token.scope ?? scope),
      status: 'connected',
      last_error: null,
      last_refreshed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', connection.user_id)

  if (error) {
    throw new Error(error.message)
  }

  return token.access_token
}

async function getSharePointToken(supabase, config, args) {
  const authMode = normalizeAuthMode(args)
  if (authMode === 'app') {
    return { accessToken: await getAppOnlySharePointToken(config), authMode: 'app' }
  }

  try {
    return { accessToken: await getDelegatedSharePointToken(supabase, config, args), authMode: 'delegated' }
  } catch (error) {
    if (authMode !== 'auto') {
      throw error
    }
    console.warn(`Delegated SharePoint auth unavailable; trying app-only auth: ${sanitizeError(error?.message ?? error)}`)
    return { accessToken: await getAppOnlySharePointToken(config), authMode: 'app' }
  }
}

async function sharePointFetchJson(config, accessToken, relativePath) {
  const response = await fetch(`${config.siteUrl}/_api/${relativePath.replace(/^\//, '')}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json;odata=nometadata',
    },
  })

  if (!response.ok) {
    throw new Error(`SharePoint request failed ${response.status}: ${sanitizeError(await response.text())}`)
  }

  return response.json()
}

async function assertSharePointAccess(config, accessToken, authMode) {
  try {
    await sharePointFetchJson(config, accessToken, 'web?$select=Id')
  } catch (error) {
    throw new Error(
      `SharePoint site is not readable with ${authMode} Microsoft auth. If using delegated auth, open ${MICROSOFT_FILES_CONNECT_PATH}; if using app auth, grant SharePoint/Sites read permissions: ${sanitizeError(error.message)}`,
    )
  }
}

async function listAttachmentFiles(config, accessToken, expense) {
  const listId = normalizeGuid(expense.sharepoint_list_id)
  const itemId = Number(expense.sharepoint_item_id)
  if (!listId || !Number.isFinite(itemId)) {
    return []
  }

  const payload = await sharePointFetchJson(
    config,
    accessToken,
    `web/lists(guid'${listId}')/items(${itemId})/AttachmentFiles?$select=FileName,ServerRelativeUrl`,
  )
  return payload.value ?? payload.d?.results ?? []
}

async function downloadAttachment(config, accessToken, serverRelativeUrl) {
  const encodedPath = encodeURIComponent(`'${odataString(serverRelativeUrl)}'`)
  const url = `${config.siteUrl}/_api/web/GetFileByServerRelativePath(decodedurl=@p)/$value?@p=${encodedPath}`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/pdf,application/octet-stream',
    },
  })

  if (!response.ok) {
    throw new Error(`SharePoint download failed ${response.status}: ${sanitizeError(await response.text())}`)
  }

  return Buffer.from(await response.arrayBuffer())
}

async function loadMissingExpenseCandidates(supabase, args) {
  let query = supabase
    .from('expense_individuals')
    .select('id, sharepoint_site_id, sharepoint_list_id, sharepoint_item_id, sharepoint_unique_id, sharepoint_etag, legacy_has_attachment')
    .eq('legacy_has_attachment', true)
    .order('expense_date', { ascending: false })
    .order('invoice_number', { ascending: false })
    .limit(5000)

  const expenseId = args['expense-id'] || args.expenseId
  if (expenseId) {
    query = query.eq('id', String(expenseId).trim())
  }

  const { data: expenses, error } = await query
  if (error) {
    throw new Error(error.message)
  }

  const ids = (expenses ?? []).map((expense) => expense.id)
  if (ids.length === 0) {
    return []
  }

  const documentExpenseIds = new Set()
  for (let index = 0; index < ids.length; index += 500) {
    const slice = ids.slice(index, index + 500)
    const { data: documents, error: documentsError } = await supabase
      .from('expense_individual_documents')
      .select('expense_id, file_name, mime_type')
      .in('expense_id', slice)

    if (documentsError) {
      throw new Error(documentsError.message)
    }

    for (const document of documents ?? []) {
      const fileName = String(document.file_name ?? '').toLowerCase()
      const mimeType = String(document.mime_type ?? '').toLowerCase()
      if (fileName.endsWith('.pdf') || mimeType.includes('pdf')) {
        documentExpenseIds.add(document.expense_id)
      }
    }
  }

  const missing = (expenses ?? []).filter((expense) => !documentExpenseIds.has(expense.id))
  const limit = args.limit ? clampInt(args.limit, missing.length, 1, 5000) : missing.length
  return missing.slice(0, limit)
}

async function existingDocumentByHash(supabase, expenseId, sha256) {
  const { data, error } = await supabase
    .from('expense_individual_documents')
    .select('id')
    .eq('expense_id', expenseId)
    .eq('source_sha256', sha256)
    .limit(1)

  if (error) {
    throw new Error(error.message)
  }
  return (data ?? []).length > 0
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

async function recoverAttachment({ supabase, config, accessToken, expense, attachment }) {
  const serverRelativeUrl = attachment.ServerRelativeUrl ?? attachment.serverRelativeUrl
  const rawFileName = attachment.FileName ?? attachment.fileName ?? 'factura.pdf'
  if (!serverRelativeUrl) {
    return { status: 'invalid_attachment' }
  }

  const buffer = await downloadAttachment(config, accessToken, serverRelativeUrl)
  if (!buffer || buffer.byteLength === 0 || buffer.byteLength > MAX_PDF_BYTES || !hasPdfSignature(buffer)) {
    return { status: 'invalid_pdf' }
  }

  const sha256 = createHash('sha256').update(buffer).digest('hex')
  if (await existingDocumentByHash(supabase, expense.id, sha256)) {
    return { status: 'duplicate' }
  }

  const fileName = pdfFileName(rawFileName)
  const storagePath = `${expense.id}/sharepoint/${expense.sharepoint_item_id}-${sha256}-${randomUUID()}-${fileName}`
  const { error: uploadError } = await supabase.storage.from(EXPENSE_DOCUMENTS_BUCKET).upload(storagePath, buffer, {
    cacheControl: '3600',
    contentType: 'application/pdf',
    upsert: false,
  })
  if (uploadError) {
    throw new Error(uploadError.message)
  }

  let binaryFileId = null
  try {
    binaryFileId = await upsertBinaryInventory(supabase, {
      source_kind: 'list_attachment',
      sharepoint_site_id: expense.sharepoint_site_id || null,
      sharepoint_list_id: normalizeGuid(expense.sharepoint_list_id),
      sharepoint_list_title: null,
      sharepoint_item_id: Number(expense.sharepoint_item_id),
      sharepoint_unique_id: expense.sharepoint_unique_id || null,
      sharepoint_etag: expense.sharepoint_etag || null,
      file_name: fileName,
      server_relative_url: serverRelativeUrl,
      web_url: null,
      content_type: 'application/pdf',
      file_size: buffer.byteLength,
      sha256,
      local_path: null,
      storage_bucket: EXPENSE_DOCUMENTS_BUCKET,
      storage_path: storagePath,
      destination_table: 'expense_individual_documents',
      destination_record_id: expense.id,
      download_status: 'uploaded',
      error_message: null,
      raw: { source: 'recover_expense_pdfs_from_sharepoint' },
      downloaded_at: new Date().toISOString(),
      uploaded_at: new Date().toISOString(),
    })
  } catch (error) {
    await supabase.storage.from(EXPENSE_DOCUMENTS_BUCKET).remove([storagePath])
    throw new Error(`binary_files inventory failed: ${error.message}`)
  }

  const { error: insertError } = await supabase.from('expense_individual_documents').insert({
    expense_id: expense.id,
    file_name: fileName,
    mime_type: 'application/pdf',
    file_size: buffer.byteLength,
    storage_bucket: EXPENSE_DOCUMENTS_BUCKET,
    storage_path: storagePath,
    source_kind: 'sharepoint',
    source_sha256: sha256,
    source_url: serverRelativeUrl,
    source_downloaded_at: new Date().toISOString(),
    sharepoint_site_id: expense.sharepoint_site_id || null,
    sharepoint_list_id: normalizeGuid(expense.sharepoint_list_id),
    sharepoint_item_id: Number(expense.sharepoint_item_id),
    sharepoint_unique_id: expense.sharepoint_unique_id || null,
    binary_file_id: binaryFileId,
    uploaded_by: null,
  })

  if (insertError) {
    await supabase.storage.from(EXPENSE_DOCUMENTS_BUCKET).remove([storagePath])
    throw new Error(insertError.message)
  }

  return { status: 'recovered' }
}

async function recoverExpensePdfsFromSharePoint(args = {}, envInput = process.env) {
  const env = { ...envInput }
  const dryRun = args.dryRun == null ? !args.apply && !args['apply'] : Boolean(args.dryRun)
  const config = resolveMicrosoftConfig(env)
  const supabase = createClient(resolveSupabaseUrl(env), resolveServiceKey(env), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { accessToken, authMode } = await getSharePointToken(supabase, config, args)
  await assertSharePointAccess(config, accessToken, authMode)
  const candidates = await loadMissingExpenseCandidates(supabase, args)

  const summary = {
    mode: dryRun ? 'dry-run' : 'apply',
    auth_mode: authMode,
    missing_expense_candidates: candidates.length,
    sharepoint_items_checked: 0,
    pdf_attachments_seen: 0,
    matched_expenses: 0,
    would_recover: 0,
    recovered: 0,
    duplicate_hash: 0,
    invalid_pdf: 0,
    invalid_attachment: 0,
    no_sharepoint_source: 0,
    no_pdf_attachment: 0,
    errors: 0,
  }

  for (const expense of candidates) {
    try {
      if (!expense.sharepoint_list_id || !expense.sharepoint_item_id) {
        summary.no_sharepoint_source += 1
        continue
      }

      summary.sharepoint_items_checked += 1
      const attachments = (await listAttachmentFiles(config, accessToken, expense)).filter(isPdfAttachment)
      if (attachments.length === 0) {
        summary.no_pdf_attachment += 1
        continue
      }

      summary.pdf_attachments_seen += attachments.length
      summary.matched_expenses += 1
      if (dryRun) {
        summary.would_recover += attachments.length
        continue
      }

      for (const attachment of attachments) {
        const result = await recoverAttachment({ supabase, config, accessToken, expense, attachment })
        if (result.status === 'recovered') {
          summary.recovered += 1
        } else if (result.status === 'duplicate') {
          summary.duplicate_hash += 1
        } else if (result.status === 'invalid_pdf') {
          summary.invalid_pdf += 1
        } else if (result.status === 'invalid_attachment') {
          summary.invalid_attachment += 1
        }
      }
    } catch (error) {
      summary.errors += 1
      console.error(`SharePoint recovery failed for expense ${expense.id}: ${sanitizeError(error?.message ?? error)}`)
      if (!args['continue-on-error'] && !args.continueOnError) {
        throw error
      }
    }
  }

  return summary
}

function printSummary(summary) {
  console.log(`Mode: ${summary.mode}`)
  console.log(`Auth mode: ${summary.auth_mode}`)
  console.log(`Missing expense candidates: ${summary.missing_expense_candidates}`)
  console.log(`SharePoint items checked: ${summary.sharepoint_items_checked}`)
  console.log(`PDF attachments seen: ${summary.pdf_attachments_seen}`)
  console.log(`Matched expenses: ${summary.matched_expenses}`)
  console.log(`Would recover: ${summary.would_recover}`)
  console.log(`Recovered: ${summary.recovered}`)
  console.log(`Duplicate hashes skipped: ${summary.duplicate_hash}`)
  console.log(`Invalid PDFs skipped: ${summary.invalid_pdf}`)
  console.log(`Invalid attachments skipped: ${summary.invalid_attachment}`)
  console.log(`No SharePoint source: ${summary.no_sharepoint_source}`)
  console.log(`No PDF attachment: ${summary.no_pdf_attachment}`)
  console.log(`Errors: ${summary.errors}`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help || args.h) {
    printHelp()
    return
  }

  const env = {
    ...readEnvFile(path.resolve(ROOT, '.env.local')),
    ...readEnvFile(path.resolve(ROOT, '../m365.env')),
    ...process.env,
  }
  const summary = await recoverExpensePdfsFromSharePoint(args, env)
  printSummary(summary)
}

main().catch((error) => {
  console.error(sanitizeError(error?.message ?? error))
  process.exit(1)
})
