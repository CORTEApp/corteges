#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const DEFAULT_GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0'
const DEFAULT_M365_ENV_FILE = 'C:/GitHub/edisolv2/m365.env'

const SYSTEM_LIST_TITLES = new Set([
  'appdata',
  'appfiles',
  'composed looks',
  'content type publishing error log',
  'converted forms',
  'extensiones de plantillas web',
  'form templates',
  'list template gallery',
  'master page gallery',
  'microfeed',
  'relationships list',
  'sharing links',
  'site assets',
  'site collection documents',
  'site collection images',
  'site pages',
  'solution gallery',
  'style library',
  'styles',
  'theme gallery',
  'user information list',
  'vinculos de uso compartido',
  'vínculos de uso compartido',
  'web part gallery',
  'wfpub',
  'workflow history',
  'workflow tasks',
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
  node tools/sharepoint_graph_export.mjs --env-file C:/GitHub/edisolv2/m365.env

Options:
  --env-file <path>      Env file with M365_TENANT_ID, M365_CLIENT_ID and M365_CLIENT_SECRET.
                         Defaults to M365_ENV_FILE or C:/GitHub/edisolv2/m365.env when present.
  --site-url <url>       SharePoint site URL. Defaults to SHAREPOINT_SITE_URL.
  --out-dir <dir>        Export directory. Defaults to SHAREPOINT_EXPORT_DIR or .sharepoint-export.
  --include-hidden       Include hidden/system lists.
  --skip-items           Export only site/list/field metadata.
  --force                Overwrite existing export directory.
`)
}

function readEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
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

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function ensureCleanDir(dirPath, force) {
  if (fs.existsSync(dirPath) && !force) {
    throw new Error(`Export directory already exists: ${dirPath}. Use --force to overwrite.`)
  }
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true })
  }
  fs.mkdirSync(path.join(dirPath, 'fields'), { recursive: true })
  fs.mkdirSync(path.join(dirPath, 'items'), { recursive: true })
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function cleanGuid(value) {
  return String(value ?? '').trim().replace(/[{}]/g, '').toLowerCase()
}

function siteParts(siteUrl) {
  const url = new URL(siteUrl)
  return {
    hostname: url.hostname,
    sitePath: url.pathname.replace(/\/$/, ''),
  }
}

function graphUrl(baseUrl, pathName, params = {}) {
  const url = new URL(`${baseUrl.replace(/\/$/, '')}/${pathName.replace(/^\//, '')}`)
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') {
      url.searchParams.set(key, value)
    }
  }
  return url.toString()
}

async function fetchJson(url, accessToken) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Graph request failed ${response.status} ${response.statusText}: ${body}`)
  }

  return response.json()
}

async function fetchAll(url, accessToken) {
  const output = []
  let nextUrl = url
  while (nextUrl) {
    const payload = await fetchJson(nextUrl, accessToken)
    output.push(...(payload.value ?? []))
    nextUrl = payload['@odata.nextLink'] ?? null
  }
  return output
}

async function getToken(env) {
  const tenantId = env.M365_TENANT_ID
  const clientId = env.M365_CLIENT_ID
  const clientSecret = env.M365_CLIENT_SECRET
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Missing M365_TENANT_ID, M365_CLIENT_ID or M365_CLIENT_SECRET.')
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  })

  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    body,
  })

  if (!response.ok) {
    throw new Error(`Microsoft token request failed ${response.status}: ${await response.text()}`)
  }

  const payload = await response.json()
  return payload.access_token
}

function graphColumnType(column) {
  if (column.lookup) {
    return column.lookup.allowMultipleValues ? 'LookupMulti' : 'Lookup'
  }
  if (column.personOrGroup) {
    return column.personOrGroup.allowMultipleSelection ? 'UserMulti' : 'User'
  }
  if (column.choice) {
    return column.choice.allowMultipleValues ? 'MultiChoice' : 'Choice'
  }
  if (column.boolean) {
    return 'Boolean'
  }
  if (column.currency) {
    return 'Currency'
  }
  if (column.number) {
    return 'Number'
  }
  if (column.dateTime) {
    return 'DateTime'
  }
  if (column.calculated) {
    return 'Calculated'
  }
  if (column.hyperlinkOrPicture) {
    return 'URL'
  }
  if (column.text?.allowMultipleLines) {
    return 'Note'
  }
  return 'Text'
}

function convertColumn(column) {
  const type = graphColumnType(column)
  const choices = column.choice?.choices ?? []
  const lookupListId = column.lookup?.listId ? cleanGuid(column.lookup.listId) : null

  return {
    Id: cleanGuid(column.id),
    InternalName: column.name,
    StaticName: column.name,
    Title: column.displayName || column.name,
    TypeAsString: type,
    TypeDisplayName: type,
    Required: Boolean(column.required),
    Hidden: Boolean(column.hidden),
    ReadOnlyField: Boolean(column.readOnly),
    Indexed: Boolean(column.indexed),
    EnforceUniqueValues: Boolean(column.enforceUniqueValues),
    AllowMultipleValues: Boolean(
      column.lookup?.allowMultipleValues ||
        column.personOrGroup?.allowMultipleSelection ||
        column.choice?.allowMultipleValues
    ),
    LookupList: lookupListId,
    LookupField: column.lookup?.columnName ?? null,
    DefaultValue: column.defaultValue?.value ?? null,
    Description: column.description ?? '',
    Group: column.columnGroup ?? '',
    Choices: choices,
    SchemaXml: '',
    Raw: column,
  }
}

function isDocumentLibrary(list) {
  return list.list?.template === 'documentLibrary'
}

function shouldIncludeList(list, includeHidden) {
  if (includeHidden) {
    return true
  }

  if (list.system || list.list?.hidden) {
    return false
  }

  if (SYSTEM_LIST_TITLES.has(normalizeText(list.displayName || list.name))) {
    return false
  }

  return list.list?.template === 'genericList' || list.list?.template === 'documentLibrary'
}

function convertList(list) {
  const documentLibrary = isDocumentLibrary(list)
  return {
    Id: cleanGuid(list.id),
    Title: list.displayName || list.name,
    EntityTypeName: list.name ?? '',
    Hidden: Boolean(list.list?.hidden || list.system),
    BaseTemplate: documentLibrary ? 101 : 100,
    BaseType: documentLibrary ? 'DocumentLibrary' : 'GenericList',
    ItemCount: Number.isFinite(list.list?.items?.count) ? list.list.items.count : 0,
    EnableAttachments: !documentLibrary,
    Created: list.createdDateTime ?? null,
    LastItemModifiedDate: list.lastModifiedDateTime ?? null,
    DefaultViewUrl: list.webUrl ?? '',
    RootFolderServerRelativeUrl: '',
    Raw: list,
  }
}

function convertItem(item, listInfo) {
  const values = item.fields ?? {}
  const documents = []
  if (listInfo.BaseType === 'DocumentLibrary') {
    documents.push({
      FileRef: values.FileRef ?? values.LinkFilename ?? item.webUrl ?? '',
      FileLeafRef: values.FileLeafRef ?? values.LinkFilename ?? values.FileLeafRefNoMenu ?? '',
      FileDirRef: values.FileDirRef ?? '',
      FileSizeDisplay: values.File_x0020_Size ?? values.FileSizeDisplay ?? null,
      ContentType: values.ContentType ?? values.ContentTypeId ?? null,
      FSObjType: values.FSObjType ?? null,
    })
  }

  return {
    Id: Number.parseInt(item.id, 10),
    UniqueId: values.GUID ?? item.sharepointIds?.listItemUniqueId ?? item.id,
    ETag: item.eTag ?? null,
    Modified: item.lastModifiedDateTime ?? values.Modified ?? null,
    Values: values,
    Attachments: [],
    Documents: documents,
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help || args.h) {
    printHelp()
    return
  }

  const envFile =
    args['env-file'] ||
    process.env.M365_ENV_FILE ||
    (fs.existsSync(DEFAULT_M365_ENV_FILE) ? DEFAULT_M365_ENV_FILE : null)
  const env = {
    ...readEnvFile(path.join(ROOT, '.env.local')),
    ...readEnvFile(envFile),
    ...process.env,
  }
  const siteUrl = args['site-url'] || env.SHAREPOINT_SITE_URL
  if (!siteUrl) {
    throw new Error('Missing SHAREPOINT_SITE_URL or --site-url.')
  }

  const exportDir = path.resolve(ROOT, args['out-dir'] || env.SHAREPOINT_EXPORT_DIR || '.sharepoint-export')
  const force = Boolean(args.force)
  const includeHidden = Boolean(args['include-hidden'])
  const skipItems = Boolean(args['skip-items'])
  const graphBaseUrl = env.M365_GRAPH_BASE_URL || DEFAULT_GRAPH_BASE_URL
  const token = await getToken(env)
  const { hostname, sitePath } = siteParts(siteUrl)

  ensureCleanDir(exportDir, force)

  const site = await fetchJson(
    graphUrl(graphBaseUrl, `/sites/${hostname}:${sitePath}`, {
      $select: 'id,name,displayName,webUrl',
    }),
    token
  )

  const siteInfo = {
    Id: cleanGuid(site.id),
    Title: site.displayName || site.name,
    Url: site.webUrl,
    ExportedAt: new Date().toISOString(),
    GraphId: site.id,
  }
  writeJson(path.join(exportDir, 'site.json'), siteInfo)

  const rawLists = await fetchAll(
    graphUrl(graphBaseUrl, `/sites/${encodeURIComponent(site.id)}/lists`, {
      $select: 'id,displayName,name,webUrl,createdDateTime,lastModifiedDateTime,list,system',
    }),
    token
  )

  const exportedLists = []
  const summary = []
  for (const rawList of rawLists) {
    if (!shouldIncludeList(rawList, includeHidden)) {
      continue
    }

    const listInfo = convertList(rawList)
    const listId = listInfo.Id
    console.log(`Exporting ${listInfo.Title} [${listId}]`)

    const rawColumns = await fetchAll(
      graphUrl(graphBaseUrl, `/sites/${encodeURIComponent(site.id)}/lists/${encodeURIComponent(rawList.id)}/columns`, {
        $select:
          'id,name,displayName,description,columnGroup,hidden,indexed,readOnly,required,enforceUniqueValues,text,number,currency,boolean,dateTime,choice,lookup,personOrGroup,calculated,hyperlinkOrPicture,defaultValue',
      }),
      token
    )
    const fields = rawColumns.map(convertColumn)
    writeJson(path.join(exportDir, 'fields', `${listId}.json`), fields)

    let items = []
    if (!skipItems) {
      const rawItems = await fetchAll(
        graphUrl(graphBaseUrl, `/sites/${encodeURIComponent(site.id)}/lists/${encodeURIComponent(rawList.id)}/items`, {
          $expand: 'fields',
          $top: '999',
        }),
        token
      )
      items = rawItems.map((item) => convertItem(item, listInfo)).filter((item) => Number.isFinite(item.Id))
      writeJson(path.join(exportDir, 'items', `${listId}.json`), items)
    }

    exportedLists.push(listInfo)
    summary.push({
      ListId: listId,
      Title: listInfo.Title,
      BaseType: listInfo.BaseType,
      FieldCount: fields.length,
      ExportedItemCount: items.length,
    })
  }

  writeJson(path.join(exportDir, 'lists.json'), exportedLists)
  writeJson(path.join(exportDir, 'export-summary.json'), {
    Site: siteInfo,
    IncludeHidden: includeHidden,
    SkipItems: skipItems,
    Lists: summary,
  })

  console.log(`SharePoint Graph export complete: ${exportDir}`)
}

main().catch((error) => {
  console.error(error?.message ?? error)
  process.exit(1)
})
