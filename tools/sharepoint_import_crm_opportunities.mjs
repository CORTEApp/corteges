#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const DEFAULT_OPPORTUNITIES_LIST_ID = 'f35a3f0d-8bf9-4830-a9a1-fd02caefd808'
const DEFAULT_ACTIVITIES_LIST_ID = 'afd1a7a2-fb54-40a7-9c4a-3615bf0d584f'

const CANONICAL_STATUSES = new Set([
  'new',
  'contacted',
  'qualified',
  'diagnosis_booked',
  'diagnosis_attended',
  'proposal_sent',
  'closed_won',
  'closed_lost',
  'disqualified',
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
  node tools/sharepoint_import_crm_opportunities.mjs --export-dir .sharepoint-export

Options:
  --export-dir <dir>               SharePoint export directory. Defaults to .sharepoint-export
  --opportunities-list-id <guid>   SharePoint Potenciales list id. Defaults to ${DEFAULT_OPPORTUNITIES_LIST_ID}
  --activities-list-id <guid>      SharePoint Prospectos list id. Defaults to ${DEFAULT_ACTIVITIES_LIST_ID}
  --batch-size <number>            Upsert batch size. Defaults to 250
  --dry-run                        Parse and map rows without writing to Supabase
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

function parseTemperature(value) {
  const parsed = parseNumber(value)
  if (parsed == null || parsed < 0 || parsed > 10) {
    return null
  }
  return parsed
}

function parseDateTime(value) {
  const text = cleanText(value)
  if (!text) {
    return null
  }

  const spanishDateTime = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?$/)
  if (spanishDateTime) {
    const day = spanishDateTime[1].padStart(2, '0')
    const month = spanishDateTime[2].padStart(2, '0')
    const year = spanishDateTime[3].length === 2 ? `20${spanishDateTime[3]}` : spanishDateTime[3]
    const hour = (spanishDateTime[4] ?? '00').padStart(2, '0')
    const minute = spanishDateTime[5] ?? '00'
    return `${year}-${month}-${day}T${hour}:${minute}:00.000Z`
  }

  const parsed = new Date(text)
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString()
}

function parseStringArray(value) {
  if (Array.isArray(value)) {
    return value.map(cleanText).filter(Boolean)
  }

  const text = cleanText(value)
  if (!text) {
    return []
  }

  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text)
      return asArray(parsed).map(cleanText).filter(Boolean)
    } catch {
      return [text]
    }
  }

  return text
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter(Boolean)
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

function chunks(items, size) {
  const result = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

function sourceItemId(item) {
  const values = item.Values ?? {}
  return Number.parseInt(item.Id ?? values.ID ?? values.Id ?? '0', 10) || null
}

function normalizeStatus(rawStatus, values, activityCount) {
  const normalized = normalizeKey(cleanText(rawStatus)).replace(/^closedwon$/, 'closed_won')
  const map = {
    nuevo: 'new',
    nueva: 'new',
    new: 'new',
    contacted: 'contacted',
    contactado: 'contacted',
    contactada: 'contacted',
    qualified: 'qualified',
    cualificado: 'qualified',
    cualificada: 'qualified',
    diagnosticcandidate: 'qualified',
    diagnosisbooked: 'diagnosis_booked',
    diagnosisattended: 'diagnosis_attended',
    proposalsent: 'proposal_sent',
    closedwon: 'closed_won',
    closedlost: 'closed_lost',
    disqualified: 'disqualified',
    descartado: 'disqualified',
    descartada: 'disqualified',
  }
  const mapped = map[normalized] ?? cleanText(rawStatus)
  if (CANONICAL_STATUSES.has(mapped)) {
    return mapped
  }

  const closedOutcome = normalizeKey(values.closed_outcome)
  if (closedOutcome === 'won' || closedOutcome === 'ganada' || closedOutcome === 'ganado') {
    return 'closed_won'
  }
  if (closedOutcome === 'lost' || closedOutcome === 'perdida' || closedOutcome === 'perdido') {
    return 'closed_lost'
  }
  if (values.closed_at && closedOutcome) {
    return closedOutcome === 'won' ? 'closed_won' : 'closed_lost'
  }
  if (values.disqualified_at || cleanText(values.disqualification_reason)) {
    return 'disqualified'
  }
  if (values.proposal_sent_at) {
    return 'proposal_sent'
  }
  if (values.diagnosis_attended_at) {
    return 'diagnosis_attended'
  }
  if (values.diagnosis_booked_at) {
    return 'diagnosis_booked'
  }

  const continuar = normalizeKey(values.Continuar)
  if (continuar === 'contrato') {
    return 'closed_won'
  }
  if (continuar === 'no') {
    return 'disqualified'
  }
  if (continuar === 'si') {
    return 'qualified'
  }
  if (continuar === 'nuevo') {
    return 'new'
  }
  if (values.FechaPrinerContacto || activityCount > 0) {
    return 'contacted'
  }
  return 'new'
}

function normalizeActivityType(value) {
  const normalized = normalizeKey(value)
  if (normalized.includes('whatsapp')) {
    return 'whatsapp'
  }
  if (normalized.includes('telegram')) {
    return 'telegram'
  }
  if (normalized.includes('linkedin')) {
    return 'linkedin'
  }
  if (normalized.includes('correo') || normalized.includes('email')) {
    return 'email'
  }
  if (normalized.includes('llamada') || normalized.includes('telefono')) {
    return 'call'
  }
  if (normalized.includes('presencial')) {
    return 'meeting_in_person'
  }
  if (normalized.includes('reunion') || normalized.includes('linea') || normalized.includes('online')) {
    return 'meeting_online'
  }
  return 'other'
}

function buildLeadId(values, item, prefix) {
  return cleanText(values.lead_id) ?? `${prefix}-${sourceItemId(item) ?? cleanText(item.UniqueId) ?? 'unknown'}`
}

function minFutureDate(values) {
  const dates = values.map(parseDateTime).filter(Boolean)
  if (!dates.length) {
    return null
  }
  return dates.sort()[0]
}

function mapOpportunityItem(item, context) {
  const values = item.Values ?? {}
  const leadId = buildLeadId(values, item, 'pot')
  const activitiesForLead = context.activitiesByLeadId.get(leadId) ?? []
  const status = normalizeStatus(values.lead_status, values, activitiesForLead.length)
  const closedOutcome = cleanText(values.closed_outcome)

  return {
    lead_id: leadId,
    company_name: cleanText(values.Title ?? values.LinkTitle) ?? `Oportunidad ${sourceItemId(item) ?? leadId}`,
    contact_name: cleanText(values.Nombre),
    contact_phone: cleanText(values.Telefono),
    contact_email: cleanText(values.Correo),
    submitted_at: parseDateTime(values.FechaFormulario),
    first_contact_at: parseDateTime(values.FechaPrinerContacto),
    first_contact_method: cleanText(values.MetodoPrimerContacto),
    temperature: parseTemperature(values.TemperaturaPrimerContacto),
    status,
    legacy_status: cleanText(values.lead_status),
    request: cleanText(values.Peticion),
    comments: cleanText(values.Comentarios),
    url: cleanText(values.URL),
    continue_label: cleanText(values.Continuar),
    platform: cleanText(values.Plataforma),
    schedule: cleanText(values.Horario),
    company_size: cleanText(values.Tama_x00f1_oEmpresa),
    province: cleanText(values.Provincia),
    budget: cleanText(values.Presupuesto),
    has_crm: cleanText(values.Tiene_x0020_CRM),
    gamma: cleanText(values.gamma),
    chat_database: cleanText(values.chatbbdd),
    chat_screens: cleanText(values.chatPantallas),
    chat_automations: cleanText(values.ChatAutomatizaciones),
    gamma_url: cleanText(values.EnlaceGamma),
    initial_price: parseNumber(values.PrecioInicial),
    campaign: cleanText(values.Campana),
    ad: cleanText(values.Anuncio),
    owner: cleanText(values.owner),
    source: cleanText(values.source),
    utm_source: cleanText(values.utm_source),
    utm_medium: cleanText(values.utm_medium),
    utm_campaign: cleanText(values.utm_campaign),
    utm_content: cleanText(values.utm_content),
    utm_term: cleanText(values.utm_term),
    cta_id: cleanText(values.cta_id),
    narrative: parseStringArray(values.narrative),
    landing_slug: cleanText(values.landing_slug),
    main_problem: cleanText(values.main_problem),
    urgency: cleanText(values.urgency),
    decision_role: cleanText(values.decision_role),
    qualification_status: cleanText(values.qualification_status),
    qualified_at: parseDateTime(values.qualified_at),
    disqualified_at: parseDateTime(values.disqualified_at),
    disqualification_reason: cleanText(values.disqualification_reason),
    diagnosis_booked_at: parseDateTime(values.diagnosis_booked_at),
    diagnosis_attended_at: parseDateTime(values.diagnosis_attended_at),
    proposal_sent_at: parseDateTime(values.proposal_sent_at),
    closed_at: parseDateTime(values.closed_at),
    closed_outcome: closedOutcome === 'won' || closedOutcome === 'lost' ? closedOutcome : null,
    closed_lost_reason: cleanText(values.closed_lost_reason),
    closed_lost_note: cleanText(values.closed_lost_note),
    closed_lost_stage: cleanText(values.closed_lost_stage),
    next_contact_at: minFutureDate(activitiesForLead.map((activity) => activity.Values?.FechaProximoContacto)),
    sharepoint_site_id: context.siteId,
    sharepoint_list_id: context.opportunitiesListId,
    sharepoint_item_id: sourceItemId(item),
    sharepoint_unique_id: cleanText(item.UniqueId ?? values.GUID),
    sharepoint_etag: cleanText(item.ETag ?? values['@odata.etag']),
    source_raw: item,
    imported_at: new Date().toISOString(),
  }
}

function mapActivityItem(item, context) {
  const values = item.Values ?? {}
  const leadId = cleanText(values.lead_id)
  const opportunityId = leadId ? context.opportunityIdByLeadId.get(leadId) : null

  return {
    row: {
      opportunity_id: opportunityId,
      activity_type: normalizeActivityType(values.TipoContacto),
      contact_at: parseDateTime(values.FechaContacto) ?? parseDateTime(item.Modified) ?? new Date().toISOString(),
      next_contact_at: parseDateTime(values.FechaProximoContacto),
      temperature: parseTemperature(values.Temperatura),
      notes: cleanText(values.Comentarios),
      contact_person: cleanText(values.Personadecontacto),
      contact_role: cleanText(values.Puestodelapersonadecontacto),
      contact_value: cleanText(values.Contacto),
      owner: cleanText(values.owner),
      diagnosis_booked_at: parseDateTime(values.diagnosis_booked_at),
      diagnosis_attended_at: parseDateTime(values.diagnosis_attended_at),
      closed_outcome: ['won', 'lost'].includes(cleanText(values.closed_outcome)) ? cleanText(values.closed_outcome) : null,
      closed_lost_reason: cleanText(values.closed_lost_reason),
      closed_lost_note: cleanText(values.closed_lost_note),
      closed_lost_stage: cleanText(values.closed_lost_stage),
      source_kind: 'sharepoint',
      sharepoint_site_id: context.siteId,
      sharepoint_list_id: context.activitiesListId,
      sharepoint_item_id: sourceItemId(item),
      sharepoint_unique_id: cleanText(item.UniqueId ?? values.GUID),
      sharepoint_etag: cleanText(item.ETag ?? values['@odata.etag']),
      source_raw: item,
      imported_at: new Date().toISOString(),
    },
    leadId,
  }
}

async function upsertOpportunities(supabase, rows, batchSize) {
  const saved = []
  for (const batch of chunks(rows, batchSize)) {
    const { data, error } = await supabase
      .from('crm_opportunities')
      .upsert(batch, { onConflict: 'sharepoint_site_id,sharepoint_list_id,sharepoint_item_id' })
      .select('id, lead_id, status')

    if (error) {
      throw error
    }
    saved.push(...(data ?? []))
  }
  return saved
}

async function fetchOpportunityIds(supabase, leadIds) {
  const byLeadId = new Map()
  for (const batch of chunks([...new Set(leadIds.filter(Boolean))], 250)) {
    const { data, error } = await supabase
      .from('crm_opportunities')
      .select('id, lead_id')
      .in('lead_id', batch)

    if (error) {
      throw error
    }
    for (const row of data ?? []) {
      if (row.lead_id) {
        byLeadId.set(row.lead_id, row.id)
      }
    }
  }
  return byLeadId
}

async function upsertActivities(supabase, rows, batchSize) {
  const saved = []
  for (const batch of chunks(rows, batchSize)) {
    const { data, error } = await supabase
      .from('crm_opportunity_activities')
      .upsert(batch, { onConflict: 'sharepoint_site_id,sharepoint_list_id,sharepoint_item_id' })
      .select('id, opportunity_id')

    if (error) {
      throw error
    }
    saved.push(...(data ?? []))
  }
  return saved
}

function countBy(items, selector) {
  const counts = new Map()
  for (const item of items) {
    const key = selector(item) ?? '(empty)'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right))
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help || args.h) {
    printHelp()
    return
  }

  const env = { ...readEnvFile(path.join(ROOT, '.env.local')), ...process.env }
  const exportDir = path.resolve(ROOT, args['export-dir'] || env.SHAREPOINT_EXPORT_DIR || '.sharepoint-export')
  const opportunitiesListId = cleanGuid(args['opportunities-list-id'] || DEFAULT_OPPORTUNITIES_LIST_ID)
  const activitiesListId = cleanGuid(args['activities-list-id'] || DEFAULT_ACTIVITIES_LIST_ID)
  const batchSize = Number.parseInt(args['batch-size'] || '250', 10)

  if (!fs.existsSync(exportDir)) {
    throw new Error(`Missing SharePoint export directory: ${exportDir}. Run npm run sharepoint:export first.`)
  }

  const site = readJson(path.join(exportDir, 'site.json'), {})
  const siteId = cleanGuid(site.Id) || env.SHAREPOINT_SITE_URL || 'sharepoint-site'
  const opportunityItems = asArray(readJson(path.join(exportDir, 'items', `${opportunitiesListId}.json`), []))
  const activityItems = asArray(readJson(path.join(exportDir, 'items', `${activitiesListId}.json`), []))

  const activitiesByLeadId = new Map()
  for (const item of activityItems) {
    const leadId = cleanText(item.Values?.lead_id)
    if (!leadId) {
      continue
    }
    const items = activitiesByLeadId.get(leadId) ?? []
    items.push(item)
    activitiesByLeadId.set(leadId, items)
  }

  const opportunityRows = opportunityItems.map((item) =>
    mapOpportunityItem(item, { activitiesByLeadId, opportunitiesListId, siteId }),
  )
  const leadIds = opportunityRows.map((row) => row.lead_id).filter(Boolean)
  const dryRunOpportunityIdByLeadId = new Map(leadIds.map((leadId) => [leadId, `dry-run-${leadId}`]))
  const dryRunActivityMappings = activityItems.map((item) =>
    mapActivityItem(item, {
      activitiesListId,
      opportunityIdByLeadId: dryRunOpportunityIdByLeadId,
      siteId,
    }),
  )
  const linkedDryRunActivities = dryRunActivityMappings.filter((mapped) => mapped.row.opportunity_id)
  const unlinkedDryRunActivities = dryRunActivityMappings.filter((mapped) => !mapped.row.opportunity_id)

  console.log(`Potenciales source list: ${opportunitiesListId}`)
  console.log(`Prospectos source list: ${activitiesListId}`)
  console.log(`SharePoint opportunities: ${opportunityItems.length}`)
  console.log(`Mapped opportunities: ${opportunityRows.length}`)
  console.log(`SharePoint activities: ${activityItems.length}`)
  console.log(`Activities linked by lead_id: ${linkedDryRunActivities.length}`)
  console.log(`Activities without opportunity: ${unlinkedDryRunActivities.length}`)
  console.log('Opportunity status distribution:')
  for (const [status, count] of countBy(opportunityRows, (row) => row.status)) {
    console.log(`  ${status}: ${count}`)
  }

  if (opportunityItems.length !== 330) {
    console.log(`Warning: expected 330 opportunity items, mapped ${opportunityItems.length}.`)
  }
  if (activityItems.length !== 173) {
    console.log(`Warning: expected 173 activity items, mapped ${activityItems.length}.`)
  }

  if (args['dry-run']) {
    if (opportunityRows[0]) {
      console.log(`First mapped opportunity: ${JSON.stringify(opportunityRows[0], null, 2)}`)
    }
    if (unlinkedDryRunActivities[0]) {
      console.log(`First unlinked activity lead_id: ${unlinkedDryRunActivities[0].leadId ?? '(empty)'}`)
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

  const savedOpportunities = await upsertOpportunities(supabase, opportunityRows, batchSize)
  const opportunityIdByLeadId = await fetchOpportunityIds(supabase, leadIds)
  const activityMappings = activityItems.map((item) =>
    mapActivityItem(item, {
      activitiesListId,
      opportunityIdByLeadId,
      siteId,
    }),
  )
  const activityRows = activityMappings.filter((mapped) => mapped.row.opportunity_id).map((mapped) => mapped.row)
  const unlinkedActivities = activityMappings.filter((mapped) => !mapped.row.opportunity_id)
  const savedActivities = await upsertActivities(supabase, activityRows, batchSize)

  console.log(`Upserted opportunities: ${savedOpportunities.length}`)
  console.log(`Upserted activities: ${savedActivities.length}`)
  console.log(`Skipped activities without opportunity: ${unlinkedActivities.length}`)
  if (unlinkedActivities[0]) {
    console.log(`First skipped lead_id: ${unlinkedActivities[0].leadId ?? '(empty)'}`)
  }
}

main().catch((error) => {
  console.error(error?.message ?? error)
  process.exit(1)
})
