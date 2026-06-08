#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = process.cwd()
const DEFAULT_GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0'
const DEFAULT_REDIRECT_PATH = '/integraciones/microsoft/callback'
const DEFAULT_MODULE = 'expense_invoice_intake'
const EXPENSE_DOCUMENTS_BUCKET = 'expense-documents'
const MAX_PDF_BYTES = 20 * 1024 * 1024
const TOKEN_PREFIX = 'v1'
const PDF_SIGNATURE = Buffer.from('%PDF-')
const MICROSOFT_GRAPH_MAIL_SCOPE_REQUIREMENTS = [
  { scope: 'Mail.Read', grants: ['Mail.Read', 'Mail.ReadWrite'] },
  { scope: 'Mail.Read.Shared', grants: ['Mail.Read.Shared', 'Mail.ReadWrite.Shared'] },
]
const STOP_WORDS = new Set([
  'factura',
  'facturas',
  'invoice',
  'recibo',
  'ticket',
  'empresa',
  'servicios',
  'service',
  'services',
  'sociedad',
  'limitada',
  'limited',
  'the',
  'and',
  'para',
  'con',
  'del',
  'las',
  'los',
  'una',
  'de',
  'la',
  'el',
  'sl',
  'sll',
  'slu',
  'sa',
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
  npm run expenses:recover-pdfs:mail -- --dry-run
  npm run expenses:recover-pdfs:mail -- --apply --limit 25

Options:
  --dry-run                    Preview only. This is the default.
  --apply                      Upload matched PDFs and create expense document rows.
  --limit <number>             Process only the first N missing-document expenses.
  --expense-id <uuid>          Process one expense.
  --outbox-id <uuid>           Use a specific active Microsoft outbox.
  --connection-user-id <uuid>  Use a Microsoft connection directly.
  --mailbox-email <email>      Search this mailbox. Defaults to the selected outbox email or /me.
  --module <name>              Module outbox to use. Defaults to ${DEFAULT_MODULE}.
  --folder-id <id>             Mail folder to scan. Defaults to inbox.
  --days-before <number>       Search window before expense date. Defaults to 45.
  --days-after <number>        Search window after expense date. Defaults to 120.
  --max-messages <number>      Max messages to scan per expense. Defaults to 150.
  --match-mode <mode>          invoice or balanced. Defaults to invoice.
  --continue-on-error          Continue after an expense-level recovery error.

The script never prints secret values or email contents. Dry-run does not upload files or write rows.
`)
}

function optionValue(args, key, alias = key) {
  return args[key] ?? args[alias]
}

function optionFlag(args, key, alias = key) {
  return Boolean(optionValue(args, key, alias))
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

function envValue(env, ...keys) {
  for (const key of keys) {
    const value = env[key]
    if (value?.trim()) {
      return value.trim()
    }
  }
  return ''
}

function getMicrosoftGraphConfig(env) {
  return {
    tenantId: envValue(env, 'MICROSOFT_GRAPH_TENANT_ID', 'M365_TENANT_ID', 'ENTRAID_TENANT_ID') || 'organizations',
    clientId: envValue(env, 'MICROSOFT_GRAPH_CLIENT_ID', 'M365_CLIENT_ID', 'ENTRAID_CLIENT_ID'),
    clientSecret: envValue(env, 'MICROSOFT_GRAPH_CLIENT_SECRET', 'M365_CLIENT_SECRET'),
    graphBaseUrl: envValue(env, 'MICROSOFT_GRAPH_BASE_URL') || DEFAULT_GRAPH_BASE_URL,
    redirectPath: envValue(env, 'MICROSOFT_GRAPH_REDIRECT_PATH') || DEFAULT_REDIRECT_PATH,
    tokenSecret: envValue(env, 'MICROSOFT_GRAPH_TOKEN_ENCRYPTION_KEY', 'MICROSOFT_GRAPH_TOKEN_KEY'),
  }
}

function assertMicrosoftConfigured(env) {
  const config = getMicrosoftGraphConfig(env)
  const missing = [
    ['MICROSOFT_GRAPH_CLIENT_ID', config.clientId],
    ['MICROSOFT_GRAPH_CLIENT_SECRET', config.clientSecret],
    ['MICROSOFT_GRAPH_TOKEN_ENCRYPTION_KEY', config.tokenSecret],
  ].filter(([, value]) => !value)

  if (missing.length > 0) {
    throw new Error(`Microsoft Graph no esta configurado: falta ${missing.map(([key]) => key).join(', ')}.`)
  }

  return config
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

function encryptionKey(env) {
  const secret = getMicrosoftGraphConfig(env).tokenSecret
  if (!secret) {
    throw new Error('Missing MICROSOFT_GRAPH_TOKEN_ENCRYPTION_KEY.')
  }
  return createHash('sha256').update(secret).digest()
}

function encryptRefreshToken(env, value) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(env), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [TOKEN_PREFIX, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join(':')
}

function decryptRefreshToken(env, value) {
  const [version, ivText, tagText, encryptedText] = String(value ?? '').split(':')
  if (version !== TOKEN_PREFIX || !ivText || !tagText || !encryptedText) {
    throw new Error('Microsoft refresh token guardado con formato no soportado.')
  }
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(env), Buffer.from(ivText, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

function sanitizeProviderError(value) {
  return String(value ?? '')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/refresh_token=[^&\s]+/gi, 'refresh_token=[redacted]')
    .slice(0, 700)
}

async function requestToken(env, body) {
  const config = assertMicrosoftConfigured(env)
  const response = await fetch(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    throw new Error(`Microsoft token request failed ${response.status}: ${sanitizeProviderError(await response.text())}`)
  }

  return response.json()
}

function graphErrorMessage(status, text) {
  let detail = String(text ?? '').trim()
  if (detail) {
    try {
      const parsed = JSON.parse(detail)
      detail = [parsed.error?.code, parsed.error?.message].filter(Boolean).join(': ') || detail
    } catch {
      // Keep sanitized raw text when Graph does not return JSON.
    }
  }

  detail = sanitizeProviderError(detail).slice(0, 500)
  return detail ? `Microsoft Graph request failed ${status}: ${detail}` : `Microsoft Graph request failed ${status}`
}

async function graphFetch(env, accessToken, pathOrUrl, init = {}) {
  const config = getMicrosoftGraphConfig(env)
  const endpoint = String(pathOrUrl).startsWith('https://')
    ? String(pathOrUrl)
    : `${config.graphBaseUrl.replace(/\/$/, '')}/${String(pathOrUrl).replace(/^\//, '')}`
  const response = await fetch(endpoint, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
  })

  if (!response.ok) {
    throw new Error(graphErrorMessage(response.status, await response.text()))
  }

  const text = await response.text()
  return text ? JSON.parse(text) : undefined
}

async function getMicrosoftConnection(supabase, userId) {
  const { data, error } = await supabase
    .from('microsoft_user_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  if (!data || data.status !== 'connected') {
    throw new Error('La conexion Microsoft seleccionada no esta conectada.')
  }
  const missing = missingMailScopes(data.scopes)
  if (missing.length > 0) {
    throw new Error(`Reconecta Microsoft para conceder permisos de lectura de correo: ${missing.join(', ')}.`)
  }
  return data
}

function missingMailScopes(scopes) {
  const granted = new Set((scopes ?? []).map((scope) => String(scope).toLowerCase()))
  return MICROSOFT_GRAPH_MAIL_SCOPE_REQUIREMENTS
    .filter((requirement) => !requirement.grants.some((scope) => granted.has(scope.toLowerCase())))
    .map((requirement) => requirement.scope)
}

async function getAccessTokenForUser(env, supabase, userId, { persistRefresh } = { persistRefresh: true }) {
  const connection = await getMicrosoftConnection(supabase, userId)
  const token = await requestToken(
    env,
    new URLSearchParams({
      client_id: getMicrosoftGraphConfig(env).clientId,
      client_secret: getMicrosoftGraphConfig(env).clientSecret,
      grant_type: 'refresh_token',
      refresh_token: decryptRefreshToken(env, connection.refresh_token_encrypted),
    }),
  )

  if (persistRefresh) {
    const { error } = await supabase
      .from('microsoft_user_connections')
      .update({
        ...(token.refresh_token ? { refresh_token_encrypted: encryptRefreshToken(env, token.refresh_token) } : {}),
        scopes: String(token.scope ?? (connection.scopes ?? []).join(' '))
          .split(/\s+/)
          .filter(Boolean),
        status: 'connected',
        last_error: null,
        last_refreshed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    if (error) {
      throw new Error(error.message)
    }
  }

  return token.access_token
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function normalizeKey(value) {
  return normalizeText(value).replace(/[^a-z0-9]/g, '')
}

function normalizeInvoice(value) {
  return normalizeKey(value)
}

function normalizeAmount(value) {
  if (value == null || value === '') {
    return ''
  }
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return ''
  }
  return number.toFixed(2).replace(/[^0-9]/g, '')
}

function supplierTokens(value) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !STOP_WORDS.has(token))
    .slice(0, 8)
}

function safeFileName(value) {
  const cleaned = String(value ?? 'factura.pdf')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || 'factura.pdf'
}

function pdfFileName(value) {
  const fileName = safeFileName(value)
  return fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`
}

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.min(Math.max(parsed, min), max)
}

function addDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00.000Z`)
  if (Number.isNaN(date.valueOf())) {
    throw new Error(`Fecha de gasto no valida: ${dateText}`)
  }
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}

function mailboxBasePath(mailboxEmail) {
  const mailbox = mailboxEmail?.trim()
  return mailbox ? `/users/${encodeURIComponent(mailbox)}` : '/me'
}

function isPdfAttachment(attachment) {
  const name = String(attachment.name ?? '').toLowerCase()
  const contentType = String(attachment.contentType ?? '').toLowerCase()
  return !attachment.isInline && (name.endsWith('.pdf') || contentType.includes('pdf'))
}

function hasPdfSignature(buffer) {
  return buffer.byteLength >= PDF_SIGNATURE.byteLength && buffer.subarray(0, PDF_SIGNATURE.byteLength).equals(PDF_SIGNATURE)
}

function scoreAttachment(expense, message, attachment, matchMode) {
  const invoice = normalizeInvoice(expense.invoice_number)
  const taxId = normalizeKey(expense.supplier_tax_id)
  const tokens = supplierTokens(expense.supplier_name)
  const amount = normalizeAmount(expense.total_amount)
  const haystackText = [
    message.subject,
    message.from?.emailAddress?.address,
    message.from?.emailAddress?.name,
    attachment.name,
  ].join(' ')
  const haystack = normalizeKey(haystackText)
  const readable = normalizeText(haystackText)

  let score = 0
  let invoiceMatched = false
  let taxMatched = false
  let amountMatched = false
  let tokenMatches = 0

  if (invoice && invoice.length >= 3 && haystack.includes(invoice)) {
    score += 12
    invoiceMatched = true
  }

  if (taxId && taxId.length >= 5 && haystack.includes(taxId)) {
    score += 6
    taxMatched = true
  }

  if (amount && amount.length >= 3 && haystack.includes(amount)) {
    score += 2
    amountMatched = true
  }

  for (const token of tokens) {
    if (readable.includes(token)) {
      tokenMatches += 1
      score += 2
    }
  }

  const accepted = matchMode === 'balanced'
    ? invoiceMatched || (taxMatched && tokenMatches > 0) || (tokenMatches >= 2 && amountMatched)
    : invoiceMatched

  return {
    accepted,
    score,
    invoiceMatched,
    taxMatched,
    amountMatched,
    tokenMatches,
  }
}

function messageParams(expense, options, filterAttachments) {
  const params = new URLSearchParams({
    '$top': String(Math.min(options.maxMessages, 50)),
    '$select': 'id,subject,from,receivedDateTime,hasAttachments',
    '$orderby': 'receivedDateTime desc',
  })

  const filters = [
    `receivedDateTime ge ${addDays(expense.expense_date, -options.daysBefore)}`,
    `receivedDateTime le ${addDays(expense.expense_date, options.daysAfter)}`,
  ]
  if (filterAttachments) {
    filters.push('hasAttachments eq true')
  }
  params.set('$filter', filters.join(' and '))
  return params
}

function isGraphInefficientFilterError(error) {
  return error instanceof Error && error.message.includes('InefficientFilter')
}

async function listCandidateMessages(env, accessToken, basePath, expense, options) {
  const folder = options.folderId || 'inbox'
  const buildPath = (filterAttachments) =>
    `${basePath}/mailFolders/${encodeURIComponent(folder)}/messages?${messageParams(expense, options, filterAttachments).toString()}`

  let nextLink = buildPath(true)
  let scanned = 0
  const messages = []

  try {
    while (nextLink && scanned < options.maxMessages) {
      const response = await graphFetch(env, accessToken, nextLink)
      const batch = response?.value ?? []
      for (const message of batch) {
        if (scanned >= options.maxMessages) {
          break
        }
        scanned += 1
        if (message.hasAttachments !== false) {
          messages.push(message)
        }
      }
      nextLink = response?.['@odata.nextLink'] ?? null
    }
    return { messages, scanned, usedFallback: false }
  } catch (error) {
    if (!isGraphInefficientFilterError(error)) {
      throw error
    }
  }

  nextLink = buildPath(false)
  scanned = 0
  messages.length = 0
  while (nextLink && scanned < options.maxMessages) {
    const response = await graphFetch(env, accessToken, nextLink)
    const batch = response?.value ?? []
    for (const message of batch) {
      if (scanned >= options.maxMessages) {
        break
      }
      scanned += 1
      if (message.hasAttachments !== false) {
        messages.push(message)
      }
    }
    nextLink = response?.['@odata.nextLink'] ?? null
  }
  return { messages, scanned, usedFallback: true }
}

async function listMessageAttachments(env, accessToken, basePath, messageId) {
  const params = new URLSearchParams({
    '$select': 'id,name,contentType,size,isInline',
  })
  const response = await graphFetch(
    env,
    accessToken,
    `${basePath}/messages/${encodeURIComponent(messageId)}/attachments?${params.toString()}`,
  )
  return response?.value ?? []
}

async function fetchAttachmentBytes(env, accessToken, basePath, messageId, attachmentId) {
  const attachment = await graphFetch(
    env,
    accessToken,
    `${basePath}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
  )
  if (!attachment?.contentBytes) {
    return null
  }
  return Buffer.from(attachment.contentBytes, 'base64')
}

async function resolveMailSource(supabase, args) {
  const connectionUserId = optionValue(args, 'connection-user-id', 'connectionUserId')
  const mailboxEmail = optionValue(args, 'mailbox-email', 'mailboxEmail')
  const outboxId = optionValue(args, 'outbox-id', 'outboxId')

  if (connectionUserId) {
    return {
      connectionUserId: String(connectionUserId).trim(),
      mailboxEmail: String(mailboxEmail ?? '').trim() || null,
    }
  }

  let query = supabase
    .from('mail_outboxes')
    .select('id, email_address, connection_user_id, active, provider')
    .eq('provider', 'microsoft_graph')
    .eq('active', true)

  if (outboxId) {
    query = query.eq('id', String(outboxId).trim())
  } else {
    const moduleName = String(optionValue(args, 'module', 'moduleName') || DEFAULT_MODULE).trim()
    const { data: setting, error: settingError } = await supabase
      .from('mail_outbox_module_settings')
      .select('outbox_id')
      .eq('module', moduleName)
      .maybeSingle()

    if (settingError) {
      throw new Error(settingError.message)
    }
    if (!setting?.outbox_id) {
      throw new Error(`No hay buzon activo asignado al modulo ${moduleName}. Usa --outbox-id o --connection-user-id.`)
    }
    query = query.eq('id', setting.outbox_id)
  }

  const { data, error } = await query.maybeSingle()
  if (error) {
    throw new Error(error.message)
  }
  if (!data) {
    throw new Error('No se encontro un buzon Microsoft activo para la recuperacion.')
  }

  return {
    connectionUserId: data.connection_user_id,
    mailboxEmail: String(mailboxEmail ?? data.email_address ?? '').trim() || null,
  }
}

async function loadMissingExpenseCandidates(supabase, args) {
  let query = supabase
    .from('expense_individuals')
    .select('id, supplier_tax_id, supplier_name, title, invoice_number, expense_date, total_amount, legacy_has_attachment')
    .eq('legacy_has_attachment', true)
    .order('expense_date', { ascending: false })
    .order('invoice_number', { ascending: false })
    .limit(5000)

  const expenseId = optionValue(args, 'expense-id', 'expenseId')
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
      .select('expense_id')
      .in('expense_id', slice)

    if (documentsError) {
      throw new Error(documentsError.message)
    }

    for (const document of documents ?? []) {
      documentExpenseIds.add(document.expense_id)
    }
  }

  const missing = (expenses ?? []).filter((expense) => !documentExpenseIds.has(expense.id))
  const limit = args.limit ? clampInt(args.limit, missing.length, 1, 5000) : missing.length
  return missing.slice(0, limit)
}

async function findBestAttachment(env, accessToken, basePath, expense, options, summary) {
  const { messages, scanned, usedFallback } = await listCandidateMessages(env, accessToken, basePath, expense, options)
  summary.messages_scanned += scanned
  if (usedFallback) {
    summary.graph_filter_fallbacks += 1
  }

  let best = null
  for (const message of messages) {
    if (!message.id) {
      continue
    }

    const attachments = await listMessageAttachments(env, accessToken, basePath, message.id)
    for (const attachment of attachments) {
      if (!attachment.id || !isPdfAttachment(attachment)) {
        continue
      }

      summary.pdf_attachments_seen += 1
      if (attachment.size != null && attachment.size > options.maxPdfBytes) {
        summary.oversized += 1
        continue
      }

      const score = scoreAttachment(expense, message, attachment, options.matchMode)
      if (!score.accepted) {
        continue
      }

      if (!best || score.score > best.score.score) {
        best = { message, attachment, score }
      }
    }
  }

  return best
}

async function recoverAttachment(env, supabase, accessToken, basePath, expense, match, options) {
  const buffer = await fetchAttachmentBytes(env, accessToken, basePath, match.message.id, match.attachment.id)
  if (!buffer || buffer.byteLength === 0) {
    return { status: 'invalid_pdf' }
  }
  if (buffer.byteLength > options.maxPdfBytes || !hasPdfSignature(buffer)) {
    return { status: 'invalid_pdf' }
  }

  const sourceSha256 = createHash('sha256').update(buffer).digest('hex')
  const { data: existing, error: existingError } = await supabase
    .from('expense_individual_documents')
    .select('id')
    .eq('expense_id', expense.id)
    .eq('source_sha256', sourceSha256)
    .limit(1)

  if (existingError) {
    throw new Error(existingError.message)
  }
  if ((existing ?? []).length > 0) {
    return { status: 'duplicate' }
  }

  const fileName = pdfFileName(match.attachment.name || `factura-${expense.invoice_number}.pdf`)
  const datePrefix = String(match.message.receivedDateTime ?? new Date().toISOString()).slice(0, 10)
  const storagePath = `${expense.id}/mail/${datePrefix}-${sourceSha256}-${randomUUID()}-${fileName}`

  const { error: uploadError } = await supabase.storage.from(EXPENSE_DOCUMENTS_BUCKET).upload(storagePath, buffer, {
    cacheControl: '3600',
    contentType: 'application/pdf',
    upsert: false,
  })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const { error: insertError } = await supabase.from('expense_individual_documents').insert({
    expense_id: expense.id,
    file_name: fileName,
    mime_type: 'application/pdf',
    file_size: buffer.byteLength,
    storage_bucket: EXPENSE_DOCUMENTS_BUCKET,
    storage_path: storagePath,
    source_kind: 'upload',
    source_sha256: sourceSha256,
    source_url: 'microsoft_graph:mail',
    source_downloaded_at: new Date().toISOString(),
    uploaded_by: null,
  })

  if (insertError) {
    await supabase.storage.from(EXPENSE_DOCUMENTS_BUCKET).remove([storagePath])
    throw new Error(insertError.message)
  }

  return { status: 'recovered' }
}

export async function recoverExpensePdfsFromMail(args = {}, envInput = process.env) {
  const env = { ...envInput }
  const dryRun = args.dryRun == null ? !args.apply || optionFlag(args, 'dry-run', 'dryRun') : Boolean(args.dryRun)
  const matchMode = String(optionValue(args, 'match-mode', 'matchMode') || 'invoice')
  if (!['invoice', 'balanced'].includes(matchMode)) {
    throw new Error('match-mode debe ser invoice o balanced.')
  }

  const options = {
    daysBefore: clampInt(optionValue(args, 'days-before', 'daysBefore'), 45, 0, 3650),
    daysAfter: clampInt(optionValue(args, 'days-after', 'daysAfter'), 120, 0, 3650),
    maxMessages: clampInt(optionValue(args, 'max-messages', 'maxMessages'), 150, 1, 1000),
    maxPdfBytes: MAX_PDF_BYTES,
    matchMode,
    folderId: String(optionValue(args, 'folder-id', 'folderId') || 'inbox').trim() || 'inbox',
  }

  const supabase = createClient(resolveSupabaseUrl(env), resolveServiceKey(env), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  assertMicrosoftConfigured(env)

  const source = await resolveMailSource(supabase, args)
  const accessToken = await getAccessTokenForUser(env, supabase, source.connectionUserId, { persistRefresh: !dryRun })
  const basePath = mailboxBasePath(source.mailboxEmail)
  const candidates = await loadMissingExpenseCandidates(supabase, args)
  const summary = {
    mode: dryRun ? 'dry-run' : 'apply',
    missing_expense_candidates: candidates.length,
    messages_scanned: 0,
    pdf_attachments_seen: 0,
    matched: 0,
    would_recover: 0,
    recovered: 0,
    duplicate_hash: 0,
    invalid_pdf: 0,
    oversized: 0,
    no_match: 0,
    graph_filter_fallbacks: 0,
    errors: 0,
  }

  for (const expense of candidates) {
    try {
      const match = await findBestAttachment(env, accessToken, basePath, expense, options, summary)
      if (!match) {
        summary.no_match += 1
        continue
      }

      summary.matched += 1
      if (dryRun) {
        summary.would_recover += 1
        continue
      }

      const result = await recoverAttachment(env, supabase, accessToken, basePath, expense, match, options)
      if (result.status === 'recovered') {
        summary.recovered += 1
      } else if (result.status === 'duplicate') {
        summary.duplicate_hash += 1
      } else if (result.status === 'invalid_pdf') {
        summary.invalid_pdf += 1
      }
    } catch (error) {
      summary.errors += 1
      console.error(`Recovery failed for expense ${expense.id}: ${sanitizeProviderError(error?.message ?? error)}`)
      if (!optionFlag(args, 'continue-on-error', 'continueOnError')) {
        throw error
      }
    }
  }

  return summary
}

function printSummary(summary) {
  console.log(`Mode: ${summary.mode}`)
  console.log(`Missing expense candidates: ${summary.missing_expense_candidates}`)
  console.log(`Messages scanned: ${summary.messages_scanned}`)
  console.log(`PDF attachments seen: ${summary.pdf_attachments_seen}`)
  console.log(`Matched expenses: ${summary.matched}`)
  console.log(`Would recover: ${summary.would_recover}`)
  console.log(`Recovered: ${summary.recovered}`)
  console.log(`Duplicate hashes skipped: ${summary.duplicate_hash}`)
  console.log(`Invalid PDFs skipped: ${summary.invalid_pdf}`)
  console.log(`Oversized PDFs skipped: ${summary.oversized}`)
  console.log(`No match: ${summary.no_match}`)
  console.log(`Graph filter fallbacks: ${summary.graph_filter_fallbacks}`)
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
    ...process.env,
  }
  const summary = await recoverExpensePdfsFromMail(args, env)
  printSummary(summary)
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isCli) {
  main().catch((error) => {
    console.error(sanitizeProviderError(error?.message ?? error))
    process.exit(1)
  })
}
