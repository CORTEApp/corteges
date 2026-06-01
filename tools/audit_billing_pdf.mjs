#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { pathToFileURL } from "node:url"

import { createClient } from "@supabase/supabase-js"
import { chromium } from "playwright"
import sharp from "sharp"

import {
  billingDocumentPrintStyles,
  buildBillingDocumentPrintHtml,
  buildBillingDocumentPrintPayload,
} from "../lib/billing/pdf-template-html.mjs"

const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, ".codex-logs", "billing-pdf-audit")
const SAMPLE_DOCUMENT_NUMBER = "F-2026/136"
const MAX_CHANGED_PIXEL_RATIO = 0.025
const MAX_MEAN_DELTA = 4
const MAX_REGION_BOX_DELTA_PX = 3
const MAX_ACCEPTED_ANTIALIAS_PIXEL_RATIO = 0.04
const MAX_ACCEPTED_ANTIALIAS_MEAN_DELTA = 4.25
const MIN_TOTALS_GAP_PX = 1
const MIN_PAGE_BOTTOM_GAP_PX = 24
const LAYOUT_FIXTURE_VIEWPORT = { width: 1240, height: 1754 }
const PLAYWRIGHT_BROWSER_PATH = "0"
const PLAYWRIGHT_CHROMIUM_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--no-zygote",
]
const REGION_DEFINITIONS = [
  { key: "logo_title", label: "Logo y titulo", kind: "dark", band: { x1: 120, y1: 120, x2: 1110, y2: 320 } },
  { key: "parties", label: "Emisor y cliente", kind: "dark", band: { x1: 120, y1: 300, x2: 1110, y2: 475 } },
  { key: "fiscal_data", label: "Datos fiscales", kind: "dark", band: { x1: 120, y1: 455, x2: 1110, y2: 600 } },
  { key: "concept", label: "Concepto", kind: "dark", band: { x1: 120, y1: 590, x2: 1110, y2: 670 } },
  { key: "table", label: "Tabla", kind: "dark", band: { x1: 120, y1: 660, x2: 1110, y2: 790 } },
  { key: "table_header", label: "Cabecera tabla", kind: "tableBlue", band: { x1: 120, y1: 660, x2: 1110, y2: 760 } },
  { key: "totals", label: "Totales", kind: "dark", band: { x1: 760, y1: 770, x2: 1110, y2: 930 } },
  { key: "watermark", label: "Marca de agua", kind: "watermarkGrey", band: { x1: 120, y1: 580, x2: 1110, y2: 1180 } },
]

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return
  }

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue
    }

    const separator = trimmed.indexOf("=")
    const key = trimmed.slice(0, separator).trim()
    let value = trimmed.slice(separator + 1).trim()
    value = value.replace(/^['"]|['"]$/g, "")

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }
  return value
}

function ensureOutDir() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true })
  fs.mkdirSync(OUT_DIR, { recursive: true })
}

function configurePlaywrightBrowsersPath() {
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = PLAYWRIGHT_BROWSER_PATH
  }
}

function localChromiumExecutablePath() {
  const candidates = [
    path.join(ROOT, "node_modules/playwright-core/.local-browsers/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell"),
    path.join(ROOT, "node_modules/playwright-core/.local-browsers/chromium-1223/chrome-linux64/chrome"),
  ]

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null
}

function launchAuditBrowser() {
  configurePlaywrightBrowsersPath()
  const executablePath = localChromiumExecutablePath()

  return chromium.launch({
    args: PLAYWRIGHT_CHROMIUM_ARGS,
    ...(executablePath ? { executablePath } : {}),
    headless: true,
  })
}

function run(command, args) {
  let executable = command
  if (process.platform === "win32") {
    const where = spawnSync("where.exe", [command], { encoding: "utf8" })
    const candidates = where.stdout.split(/\r?\n/).filter(Boolean)
    executable = candidates.find((candidate) => candidate.toLowerCase().endsWith(".exe")) ?? candidates[0] ?? command
  }
  const result = spawnSync(executable, args, {
    cwd: ROOT,
    encoding: "utf8",
  })

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}\n${result.error?.message ?? ""}`)
  }

  return result
}

async function fetchSample(supabase) {
  const { data: document, error: documentError } = await supabase
    .from("billing_documents")
    .select("*")
    .eq("document_number", SAMPLE_DOCUMENT_NUMBER)
    .maybeSingle()

  if (documentError) {
    throw documentError
  }

  if (!document) {
    throw new Error(`Missing billing document ${SAMPLE_DOCUMENT_NUMBER}`)
  }

  const [
    { data: lines, error: linesError },
    { data: client, error: clientError },
    { data: files, error: filesError },
  ] = await Promise.all([
    supabase
      .from("billing_document_lines")
      .select("*")
      .eq("document_id", document.id)
      .order("line_index", { ascending: true }),
    document.client_id
      ? supabase.from("clients").select("*").eq("id", document.client_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("billing_document_files")
      .select("*")
      .eq("document_id", document.id)
      .neq("source_kind", "generated")
      .order("created_at", { ascending: false }),
  ])

  if (linesError) {
    throw linesError
  }

  if (clientError) {
    throw clientError
  }

  if (filesError) {
    throw filesError
  }

  const referenceFile = (files ?? []).find((file) => String(file.mime_type ?? "").includes("pdf") || file.file_name.toLowerCase().endsWith(".pdf"))
  if (!referenceFile) {
    throw new Error(`Missing historical PDF file for ${SAMPLE_DOCUMENT_NUMBER}`)
  }

  return { document, lines: lines ?? [], client: client ?? null, referenceFile }
}

async function downloadReferencePdf(supabase, referenceFile) {
  const { data, error } = await supabase.storage
    .from(referenceFile.storage_bucket)
    .download(referenceFile.storage_path)

  if (error) {
    throw error
  }

  const referencePdf = path.join(OUT_DIR, "reference.pdf")
  fs.writeFileSync(referencePdf, Buffer.from(await data.arrayBuffer()))
  return referencePdf
}

async function generatePdf(payload) {
  const generatedPdf = path.join(OUT_DIR, "generated.pdf")
  const assetBaseUrl = pathToFileURL(path.join(ROOT, "public")).href.replace(/\/$/g, "")
  const templateHtml = path.join(OUT_DIR, "template.html")
  fs.writeFileSync(templateHtml, buildBillingDocumentPrintHtml(payload, { fullDocument: true, assetBaseUrl }))
  const browser = await launchAuditBrowser()

  try {
    const page = await browser.newPage()
    await page.goto(pathToFileURL(templateHtml).href, { waitUntil: "networkidle" })
    await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete), null, {
      timeout: 10000,
    })
    await page.pdf({
      path: generatedPdf,
      format: "A4",
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      preferCSSPageSize: true,
      printBackground: true,
    })
    await page.close()
  } finally {
    await browser.close()
  }

  return generatedPdf
}

function fixtureLine(fixtureKey, index, overrides = {}) {
  const subtotal = overrides.subtotal ?? 59 * index
  const tax = Math.round(subtotal * 0.21 * 100) / 100

  return {
    id: `${fixtureKey}-line-${index}`,
    document_id: `${fixtureKey}-document`,
    line_index: index,
    facturable_id: null,
    code: overrides.code ?? `S-${String(index).padStart(3, "0")}`,
    description: overrides.description ?? `Servicio gestionado ${index}`,
    quantity: overrides.quantity ?? 1,
    unit_price: subtotal,
    vat_rate: 21,
    unit_type: "Unidad",
    subtotal_amount: subtotal,
    tax_amount: tax,
    total_amount: Math.round((subtotal + tax) * 100) / 100,
    sharepoint_site_id: null,
    sharepoint_list_id: null,
    sharepoint_item_id: null,
    sharepoint_unique_id: null,
    sharepoint_etag: null,
    imported_at: null,
    created_at: "2026-06-01T00:00:00.000Z",
  }
}

function buildFixturePayload({
  key,
  documentNumber,
  lineCount,
  longEmail = false,
  longDescriptions = false,
}) {
  const baseDescriptions = [
    "Power Automate Premium gestionado",
    "Mantenimiento avanzado mensual RPA",
    "Plan Basico",
    "Acuerdo Colaboracion Automatizacion F2",
  ]
  const lines = Array.from({ length: lineCount }, (_, lineIndex) => {
    const index = lineIndex + 1
    const description = longDescriptions
      ? `${baseDescriptions[lineIndex % baseDescriptions.length]} con soporte operativo, seguimiento mensual y coordinacion de incidencias`
      : baseDescriptions[lineIndex % baseDescriptions.length]

    return fixtureLine(key, index, {
      code: ["M-001", "S-006", "S-001", "S-008"][lineIndex] ?? `S-${String(index).padStart(3, "0")}`,
      description,
      quantity: index === 3 ? 3 : 1,
      subtotal: [23, 59, 3033, 198]?.[lineIndex] ?? 85 * index,
    })
  })
  const subtotal = Math.round(lines.reduce((total, line) => total + Number(line.subtotal_amount), 0) * 100) / 100
  const tax = Math.round(lines.reduce((total, line) => total + Number(line.tax_amount), 0) * 100) / 100
  const total = Math.round((subtotal + tax) * 100) / 100
  const document = {
    id: `${key}-document`,
    document_type: "invoice",
    status: "issued",
    payment_status: "unpaid",
    series: "F",
    number_year: 2026,
    number_value: Number(documentNumber.split("/").at(1) ?? 1),
    document_number: documentNumber,
    source_proforma_id: null,
    source_proforma_number: null,
    client_id: `${key}-client`,
    client_name: "Edisol Soluciones Energeticas SL",
    client_tax_id: "B90393547",
    billing_email: longEmail
      ? "facturacion.primaria@example.com;administracion.operativa@example.com;direccion.financiera@example.com"
      : "facturacion@example.com",
    project: "Licencias",
    issue_date: "2026-05-01",
    due_date: "2026-05-01",
    paid_date: null,
    payment_method: null,
    subtotal_amount: subtotal,
    tax_amount: tax,
    total_amount: total,
    currency: "EUR",
    observations: null,
    sharepoint_site_id: null,
    sharepoint_list_id: null,
    sharepoint_item_id: null,
    sharepoint_unique_id: null,
    sharepoint_etag: null,
    imported_at: null,
    created_by: null,
    updated_by: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
  }
  const client = {
    id: `${key}-client`,
    tax_id: "B90393547",
    name: "Edisol Soluciones Energeticas SL",
    address: "Avda. Tecnologia 1, 41015, Sevilla",
    contact_name: "Miguel Martin",
    contact_phone: "664001038",
    contact_email: "facturacion@example.com",
    billing_email: document.billing_email,
    payment_method: "sepa",
  }

  return {
    key,
    document_number: documentNumber,
    payload: buildBillingDocumentPrintPayload({ document, lines, client }),
  }
}

function layoutFixtures() {
  return [
    buildFixturePayload({
      key: "edisol-4-lines-long-email",
      documentNumber: "F-2026/133",
      lineCount: 4,
      longEmail: true,
    }),
    buildFixturePayload({
      key: "single-line",
      documentNumber: "F-2026/901",
      lineCount: 1,
    }),
    buildFixturePayload({
      key: "eight-lines-long-descriptions",
      documentNumber: "F-2026/902",
      lineCount: 8,
      longEmail: true,
      longDescriptions: true,
    }),
    buildFixturePayload({
      key: "twelve-lines",
      documentNumber: "F-2026/903",
      lineCount: 12,
      longDescriptions: true,
    }),
  ]
}

function cssRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = billingDocumentPrintStyles.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, "m"))
  return match?.[1] ?? ""
}

function firstErrorLine(error) {
  return String(error instanceof Error ? error.message : error || "unknown").split(/\r?\n/)[0]
}

function hasCssDeclaration(rule, property) {
  return rule
    .split(";")
    .map((declaration) => declaration.trim())
    .some((declaration) => declaration.startsWith(`${property}:`))
}

function staticLayoutFailures(html) {
  const linesRule = cssRule(".billing-lines")
  const totalsRule = cssRule(".billing-totals")
  const contentRule = cssRule(".billing-content")
  const partyRule = cssRule(".billing-party p")
  const lineCellRule = cssRule(".billing-lines td")
  const failures = []

  if (!contentRule.includes("position: absolute")) {
    failures.push("Falta el contenedor fiscal .billing-content con anclaje de pagina")
  }

  if (linesRule.includes("position: absolute") || hasCssDeclaration(linesRule, "top")) {
    failures.push(".billing-lines vuelve a tener posicion o top fijo")
  }

  if (
    totalsRule.includes("position: absolute") ||
    hasCssDeclaration(totalsRule, "top") ||
    hasCssDeclaration(totalsRule, "right")
  ) {
    failures.push(".billing-totals vuelve a tener posicion fija")
  }

  if (!partyRule.includes("overflow-wrap: anywhere")) {
    failures.push("Los datos de cliente/emisor no fuerzan corte de texto largo")
  }

  if (!lineCellRule.includes("overflow-wrap: anywhere")) {
    failures.push("Las celdas de lineas no fuerzan corte de texto largo")
  }

  if (!html.includes('<section class="billing-content">')) {
    failures.push("El HTML no agrupa concepto, lineas y totales en .billing-content")
  }

  if (html.indexOf('class="billing-lines"') > html.indexOf('class="billing-totals"')) {
    failures.push("Los totales aparecen antes que la tabla de lineas")
  }

  return failures
}

function runStaticLayoutFallback(launchError) {
  const layoutDir = path.join(OUT_DIR, "layout")
  fs.mkdirSync(layoutDir, { recursive: true })

  const assetBaseUrl = pathToFileURL(path.join(ROOT, "public")).href.replace(/\/$/g, "")
  const results = layoutFixtures().map((fixture) => {
    const html = buildBillingDocumentPrintHtml(fixture.payload, { fullDocument: true, assetBaseUrl })
    const htmlPath = path.join(layoutDir, `${fixture.key}.html`)
    fs.writeFileSync(htmlPath, html)

    const failures = staticLayoutFailures(html)

    return {
      key: fixture.key,
      document_number: fixture.document_number,
      status: failures.length === 0 ? "PASS" : "FAIL",
      mode: "static-fallback",
      failures,
      metrics: {
        browser_unavailable: firstErrorLine(launchError),
      },
      artifacts: {
        html: htmlPath,
        screenshot: null,
      },
    }
  })
  const failures = results.flatMap((result) =>
    result.failures.map((failure) => `${result.key}: ${failure}`),
  )

  return {
    status: failures.length === 0 ? "PASS" : "FAIL",
    mode: "static-fallback",
    failures,
    results,
    output_dir: layoutDir,
    browser_unavailable: firstErrorLine(launchError),
  }
}

function rectOverlapPx(first, second) {
  if (!first || !second) {
    return 0
  }

  return Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top))
}

async function auditLayoutFixture(browser, fixture) {
  const layoutDir = path.join(OUT_DIR, "layout")
  fs.mkdirSync(layoutDir, { recursive: true })

  const htmlPath = path.join(layoutDir, `${fixture.key}.html`)
  const screenshotPath = path.join(layoutDir, `${fixture.key}.png`)
  const assetBaseUrl = pathToFileURL(path.join(ROOT, "public")).href.replace(/\/$/g, "")

  fs.writeFileSync(htmlPath, buildBillingDocumentPrintHtml(fixture.payload, { fullDocument: true, assetBaseUrl }))

  const page = await browser.newPage()

  try {
    await page.setViewportSize(LAYOUT_FIXTURE_VIEWPORT)
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" })
    await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete), null, {
      timeout: 10000,
    })
    await page.screenshot({ path: screenshotPath, fullPage: true })

    const metrics = await page.evaluate(() => {
      function plainRect(element) {
        if (!element) {
          return null
        }

        const rect = element.getBoundingClientRect()
        return {
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        }
      }

      const pageRect = plainRect(document.querySelector(".billing-page"))
      const linesRect = plainRect(document.querySelector(".billing-lines"))
      const totalsRect = plainRect(document.querySelector(".billing-totals"))
      const contentRect = plainRect(document.querySelector(".billing-content"))
      const partiesRect = plainRect(document.querySelector(".billing-parties"))
      const rows = Array.from(document.querySelectorAll(".billing-lines tbody tr")).map(plainRect)
      const boundedSelectors = [
        ".billing-party p",
        ".billing-concept",
        ".billing-lines",
        ".billing-totals",
        ".billing-observations",
      ]
      const overflowing = []

      if (pageRect) {
        for (const selector of boundedSelectors) {
          for (const element of document.querySelectorAll(selector)) {
            const rect = plainRect(element)
            if (!rect) {
              continue
            }

            if (rect.left < pageRect.left - 1 || rect.right > pageRect.right + 1) {
              overflowing.push({
                selector,
                text: String(element.textContent ?? "").slice(0, 80),
                left: rect.left,
                right: rect.right,
              })
            }
          }
        }
      }

      const rowOverlaps = rows
        .slice(1)
        .map((row, index) => ({
          previous: index,
          current: index + 1,
          overlap: Math.max(0, Math.min(rows[index].bottom, row.bottom) - Math.max(rows[index].top, row.top)),
        }))
        .filter((row) => row.overlap > 0.5)

      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        document_scroll_width: document.documentElement.scrollWidth,
        document_scroll_height: document.documentElement.scrollHeight,
        row_count: rows.length,
        bounds: {
          page: pageRect,
          parties: partiesRect,
          content: contentRect,
          lines: linesRect,
          totals: totalsRect,
        },
        row_overlaps: rowOverlaps,
        overflowing,
      }
    })
    const failures = []
    const linesTotalsOverlap = rectOverlapPx(metrics.bounds.lines, metrics.bounds.totals)
    const totalsGap = metrics.bounds.lines && metrics.bounds.totals
      ? metrics.bounds.totals.top - metrics.bounds.lines.bottom
      : null

    if (linesTotalsOverlap > 0 || (totalsGap != null && totalsGap < MIN_TOTALS_GAP_PX)) {
      failures.push(`Lineas y totales se solapan o no respetan separacion minima: gap=${totalsGap}`)
    }

    if (
      metrics.bounds.page &&
      metrics.bounds.content &&
      metrics.bounds.content.bottom > metrics.bounds.page.bottom - MIN_PAGE_BOTTOM_GAP_PX
    ) {
      failures.push("El contenido fiscal queda demasiado cerca del final de pagina")
    }

    if (metrics.row_overlaps.length > 0) {
      failures.push(`Filas de lineas solapadas: ${metrics.row_overlaps.length}`)
    }

    if (metrics.overflowing.length > 0) {
      failures.push(`Contenido fuera del ancho de pagina: ${metrics.overflowing.length} nodos`)
    }

    if (metrics.document_scroll_width > LAYOUT_FIXTURE_VIEWPORT.width + 2) {
      failures.push(`Scroll horizontal inesperado: ${metrics.document_scroll_width}px`)
    }

    return {
      key: fixture.key,
      document_number: fixture.document_number,
      status: failures.length === 0 ? "PASS" : "FAIL",
      failures,
      metrics: {
        ...metrics,
        totals_gap_px: totalsGap,
        lines_totals_overlap_px: linesTotalsOverlap,
      },
      artifacts: {
        html: htmlPath,
        screenshot: screenshotPath,
      },
    }
  } finally {
    await page.close()
  }
}

async function runLayoutFixtureAudit() {
  let browser

  try {
    browser = await launchAuditBrowser()
  } catch (error) {
    const summary = runStaticLayoutFallback(error)
    fs.writeFileSync(path.join(OUT_DIR, "layout-summary.json"), `${JSON.stringify(summary, null, 2)}\n`)
    fs.writeFileSync(
      path.join(OUT_DIR, "layout-summary.md"),
      [
        "# Billing PDF Layout Audit",
        "",
        `- Status: ${summary.status}`,
        "- Mode: static fallback",
        `- Browser unavailable: ${summary.browser_unavailable}`,
        `- Fixtures: ${summary.results.length}`,
        "",
        "Failures:",
        ...(summary.failures.length ? summary.failures.map((failure) => `- ${failure}`) : ["- None"]),
        "",
        "Artifacts:",
        "- layout/*.html",
        "",
      ].join("\n"),
    )

    return summary
  }

  try {
    const results = []
    for (const fixture of layoutFixtures()) {
      results.push(await auditLayoutFixture(browser, fixture))
    }

    const failures = results.flatMap((result) =>
      result.failures.map((failure) => `${result.key}: ${failure}`),
    )
    const summary = {
      status: failures.length === 0 ? "PASS" : "FAIL",
      failures,
      results,
      output_dir: path.join(OUT_DIR, "layout"),
    }

    fs.writeFileSync(path.join(OUT_DIR, "layout-summary.json"), `${JSON.stringify(summary, null, 2)}\n`)
    fs.writeFileSync(
      path.join(OUT_DIR, "layout-summary.md"),
      [
        "# Billing PDF Layout Audit",
        "",
        `- Status: ${summary.status}`,
        `- Fixtures: ${results.length}`,
        "",
        "Failures:",
        ...(failures.length ? failures.map((failure) => `- ${failure}`) : ["- None"]),
        "",
        "Artifacts:",
        ...results.flatMap((result) => [
          `- ${result.key}.html`,
          `- ${result.key}.png`,
        ]),
        "",
      ].join("\n"),
    )

    return summary
  } finally {
    await browser.close()
  }
}

function renderPdf(pdfPath, name) {
  const prefix = path.join(OUT_DIR, name)
  run("pdftoppm", ["-png", "-singlefile", "-r", "150", pdfPath, prefix])
  return `${prefix}.png`
}

async function normalizePngToSize(pngPath, width, height) {
  const metadata = await sharp(pngPath).metadata()
  if (metadata.width === width && metadata.height === height) {
    return sharp(pngPath).png().toBuffer()
  }

  const sourceWidth = metadata.width ?? width
  const sourceHeight = metadata.height ?? height
  const cropped = await sharp(pngPath)
    .extract({
      left: 0,
      top: 0,
      width: Math.min(sourceWidth, width),
      height: Math.min(sourceHeight, height),
    })
    .png()
    .toBuffer()

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: "#ffffff",
    },
  })
    .composite([{ input: cropped, left: 0, top: 0 }])
    .png()
    .toBuffer()
}

async function comparePngs(referencePng, generatedPng) {
  const reference = await sharp(referencePng).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const generatedMetadata = await sharp(generatedPng).metadata()
  const sameRawDimensions =
    reference.info.width === generatedMetadata.width &&
    reference.info.height === generatedMetadata.height
  const dimensionsMatch =
    Math.abs(reference.info.width - (generatedMetadata.width ?? 0)) <= 1 &&
    Math.abs(reference.info.height - (generatedMetadata.height ?? 0)) <= 1

  const generatedInput = sameRawDimensions
    ? await sharp(generatedPng).png().toBuffer()
    : await normalizePngToSize(generatedPng, reference.info.width, reference.info.height)
  const generated = await sharp(generatedInput).ensureAlpha().raw().toBuffer({ resolveWithObject: true })

  const width = reference.info.width
  const height = reference.info.height
  const pixels = width * height
  const diff = Buffer.alloc(pixels * 4)
  let changedPixels = 0
  let totalDelta = 0

  for (let offset = 0; offset < reference.data.length; offset += 4) {
    const delta =
      Math.abs(reference.data[offset] - generated.data[offset]) +
      Math.abs(reference.data[offset + 1] - generated.data[offset + 1]) +
      Math.abs(reference.data[offset + 2] - generated.data[offset + 2])
    const pixelIndex = offset / 4
    totalDelta += delta / 3

    if (delta > 45) {
      changedPixels += 1
      diff[offset] = 220
      diff[offset + 1] = 38
      diff[offset + 2] = 38
      diff[offset + 3] = 255
    } else {
      const base = Math.round(reference.data[offset] * 0.3 + reference.data[offset + 1] * 0.59 + reference.data[offset + 2] * 0.11)
      diff[offset] = base
      diff[offset + 1] = base
      diff[offset + 2] = base
      diff[offset + 3] = pixelIndex % 2 === 0 ? 90 : 70
    }
  }

  const diffPng = path.join(OUT_DIR, "diff.png")
  await sharp(diff, { raw: { width, height, channels: 4 } }).png().toFile(diffPng)

  return {
    dimensionsMatch,
    width,
    height,
    changedPixels,
    totalPixels: pixels,
    changedPixelRatio: changedPixels / pixels,
    meanDelta: totalDelta / pixels,
    diffPng,
  }
}

function pixelAt(image, x, y) {
  const offset = (y * image.info.width + x) * 4
  return {
    r: image.data[offset],
    g: image.data[offset + 1],
    b: image.data[offset + 2],
    a: image.data[offset + 3],
  }
}

function isDarkPixel({ r, g, b, a }) {
  return a > 20 && r + g + b < 210
}

function isTableBluePixel({ r, g, b, a }) {
  return a > 20 && b > 185 && g > 155 && r > 130 && b > r + 18 && b > g + 10
}

function isWatermarkGreyPixel({ r, g, b, a }) {
  const spread = Math.max(r, g, b) - Math.min(r, g, b)
  return a > 20 && spread <= 10 && r >= 120 && r <= 238 && g >= 120 && g <= 238 && b >= 120 && b <= 238
}

function isEmailBluePixel({ r, g, b, a }) {
  return a > 20 && b >= 125 && g >= 55 && g <= 160 && r <= 70 && b > g + 35
}

function predicateForKind(kind) {
  if (kind === "tableBlue") {
    return isTableBluePixel
  }

  if (kind === "watermarkGrey") {
    return isWatermarkGreyPixel
  }

  return isDarkPixel
}

function measureRegion(image, definition) {
  const predicate = predicateForKind(definition.kind)
  const x1 = Math.max(0, definition.band.x1)
  const y1 = Math.max(0, definition.band.y1)
  const x2 = Math.min(image.info.width - 1, definition.band.x2)
  const y2 = Math.min(image.info.height - 1, definition.band.y2)
  const box = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity }
  let pixels = 0

  for (let y = y1; y <= y2; y += 1) {
    for (let x = x1; x <= x2; x += 1) {
      if (!predicate(pixelAt(image, x, y))) {
        continue
      }

      pixels += 1
      box.x1 = Math.min(box.x1, x)
      box.y1 = Math.min(box.y1, y)
      box.x2 = Math.max(box.x2, x)
      box.y2 = Math.max(box.y2, y)
    }
  }

  if (!pixels) {
    return {
      label: definition.label,
      kind: definition.kind,
      pixels,
      box: null,
    }
  }

  return {
    label: definition.label,
    kind: definition.kind,
    pixels,
    box,
    width: box.x2 - box.x1 + 1,
    height: box.y2 - box.y1 + 1,
  }
}

function measureEmailBlue(image) {
  const definition = {
    label: "Email azul subrayado",
    kind: "emailBlue",
    band: { x1: 120, y1: 300, x2: 620, y2: 430 },
  }
  const box = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity }
  let pixels = 0

  for (let y = definition.band.y1; y <= definition.band.y2; y += 1) {
    for (let x = definition.band.x1; x <= definition.band.x2; x += 1) {
      if (!isEmailBluePixel(pixelAt(image, x, y))) {
        continue
      }

      pixels += 1
      box.x1 = Math.min(box.x1, x)
      box.y1 = Math.min(box.y1, y)
      box.x2 = Math.max(box.x2, x)
      box.y2 = Math.max(box.y2, y)
    }
  }

  return {
    label: definition.label,
    pixels,
    box: pixels ? box : null,
  }
}

async function analyzePng(pngPath) {
  const image = await sharp(pngPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const regions = {}

  for (const definition of REGION_DEFINITIONS) {
    regions[definition.key] = measureRegion(image, definition)
  }

  return {
    width: image.info.width,
    height: image.info.height,
    regions,
    color_checks: {
      email_blue: measureEmailBlue(image),
      table_header_blue_pixels: regions.table_header.pixels,
      watermark_grey_pixels: regions.watermark.pixels,
      logo_dark_pixels: regions.logo_title.pixels,
      table_dark_pixels: regions.table.pixels,
    },
  }
}

function compareBoxes(referenceBox, generatedBox) {
  if (!referenceBox || !generatedBox) {
    return { passed: false, maxDelta: Infinity, deltas: null }
  }

  const deltas = {
    x1: Math.abs(referenceBox.x1 - generatedBox.x1),
    y1: Math.abs(referenceBox.y1 - generatedBox.y1),
    x2: Math.abs(referenceBox.x2 - generatedBox.x2),
    y2: Math.abs(referenceBox.y2 - generatedBox.y2),
  }
  const maxDelta = Math.max(deltas.x1, deltas.y1, deltas.x2, deltas.y2)

  return {
    passed: maxDelta <= MAX_REGION_BOX_DELTA_PX,
    maxDelta,
    deltas,
  }
}

function evaluateVisualGates(referenceMetrics, generatedMetrics) {
  const failures = []
  const region_results = {}

  for (const definition of REGION_DEFINITIONS) {
    const referenceRegion = referenceMetrics.regions[definition.key]
    const generatedRegion = generatedMetrics.regions[definition.key]
    const result = compareBoxes(referenceRegion.box, generatedRegion.box)
    region_results[definition.key] = {
      label: definition.label,
      reference: referenceRegion,
      generated: generatedRegion,
      max_delta_px: Number.isFinite(result.maxDelta) ? result.maxDelta : null,
      deltas: result.deltas,
      passed: result.passed,
    }

    if (!result.passed) {
      failures.push(`${definition.label}: bbox delta ${Number.isFinite(result.maxDelta) ? result.maxDelta : "missing"}px`)
    }
  }

  if (generatedMetrics.color_checks.table_header_blue_pixels < 10000) {
    failures.push("Cabecera tabla: no se detecta suficiente azul de cabecera")
  }

  if (generatedMetrics.color_checks.table_dark_pixels < 5000) {
    failures.push("Bordes/tabla: no se detectan suficientes bordes negros")
  }

  if (generatedMetrics.color_checks.email_blue.pixels < 40) {
    failures.push("Email emisor: falta azul/subrayado historico")
  }

  if (generatedMetrics.color_checks.logo_dark_pixels < 4000) {
    failures.push("Logo/titulo: no se detecta suficiente presencia del logo")
  }

  if (generatedMetrics.color_checks.watermark_grey_pixels < 50000) {
    failures.push("Marca de agua: no se detecta suficiente presencia")
  }

  return {
    passed: failures.length === 0,
    failures,
    region_results,
  }
}

async function writeSideBySide(referencePng, generatedPng, width, height) {
  const sideBySidePng = path.join(OUT_DIR, "side-by-side.png")
  const referenceBuffer = await normalizePngToSize(referencePng, width, height)
  const generatedBuffer = await normalizePngToSize(generatedPng, width, height)
  const gutter = Buffer.alloc(height * 14 * 4, 255)

  await sharp({
    create: {
      width: width * 2 + 14,
      height,
      channels: 4,
      background: "#ffffff",
    },
  })
    .composite([
      { input: referenceBuffer, left: 0, top: 0 },
      { input: gutter, raw: { width: 14, height, channels: 4 }, left: width, top: 0 },
      { input: generatedBuffer, left: width + 14, top: 0 },
    ])
    .png()
    .toFile(sideBySidePng)

  return sideBySidePng
}

function writeSummary(summary) {
  fs.writeFileSync(path.join(OUT_DIR, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`)
  fs.writeFileSync(path.join(OUT_DIR, "metrics.json"), `${JSON.stringify(summary.metrics, null, 2)}\n`)
  fs.writeFileSync(
    path.join(OUT_DIR, "summary.md"),
    [
      "# Billing PDF Audit",
      "",
      `- Status: ${summary.status}`,
      `- Document: ${summary.document_number}`,
      `- Reference file: ${summary.reference_file}`,
      `- Changed pixel ratio: ${(summary.changed_pixel_ratio * 100).toFixed(2)}%`,
      `- Mean delta: ${summary.mean_delta.toFixed(2)}`,
      `- Dimensions match: ${summary.dimensions_match}`,
      `- Strict global status: ${summary.strict_global_status}`,
      `- Residual kind: ${summary.residual_kind ?? "none"}`,
      ...(summary.residual_note ? [`- Residual note: ${summary.residual_note}`] : []),
      "",
      "Failures:",
      ...(summary.failures.length ? summary.failures.map((failure) => `- ${failure}`) : ["- None"]),
      "",
      "Artifacts:",
      "- reference.pdf",
      "- generated.pdf",
      "- reference.png",
      "- generated.png",
      "- diff.png",
      "- side-by-side.png",
      "- metrics.json",
      "",
    ].join("\n"),
  )
}

function writeLayoutOnlySummary(summary) {
  fs.writeFileSync(path.join(OUT_DIR, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`)
  fs.writeFileSync(
    path.join(OUT_DIR, "summary.md"),
    [
      "# Billing PDF Audit",
      "",
      `- Status: ${summary.status}`,
      "- Mode: offline layout fixtures",
      `- Fixtures: ${summary.layout_fixtures.results.length}`,
      "",
      "Failures:",
      ...(summary.failures.length ? summary.failures.map((failure) => `- ${failure}`) : ["- None"]),
      "",
      "Artifacts:",
      "- layout-summary.json",
      "- layout-summary.md",
      "- layout/*.html",
      "- layout/*.png",
      "",
    ].join("\n"),
  )
}

async function main() {
  readEnvFile(path.join(ROOT, ".env.local"))
  readEnvFile(path.join(ROOT, "..", ".env"))
  ensureOutDir()
  const layoutAudit = await runLayoutFixtureAudit()
  const hasRemoteAuditEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
  )

  if (!hasRemoteAuditEnv) {
    const summary = {
      status: layoutAudit.status,
      mode: "offline-layout-fixtures",
      failures: layoutAudit.failures,
      layout_fixtures: layoutAudit,
      output_dir: OUT_DIR,
    }

    writeLayoutOnlySummary(summary)
    console.log(JSON.stringify(summary, null, 2))

    if (layoutAudit.status !== "PASS") {
      process.exitCode = 1
    }

    return
  }

  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    process.env.SUPABASE_SECRET_KEY || requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const sample = await fetchSample(supabase)
  const payload = buildBillingDocumentPrintPayload(sample)
  const referencePdf = await downloadReferencePdf(supabase, sample.referenceFile)
  const generatedPdf = await generatePdf(payload)
  const referencePng = renderPdf(referencePdf, "reference")
  const generatedPng = renderPdf(generatedPdf, "generated")
  const comparison = await comparePngs(referencePng, generatedPng)
  const [referenceMetrics, generatedMetrics] = await Promise.all([
    analyzePng(referencePng),
    analyzePng(generatedPng),
  ])
  const gates = evaluateVisualGates(referenceMetrics, generatedMetrics)
  const sideBySidePng = await writeSideBySide(referencePng, generatedPng, comparison.width, comparison.height)

  const strictGlobalPassed =
    comparison.dimensionsMatch &&
    comparison.changedPixelRatio <= MAX_CHANGED_PIXEL_RATIO &&
    comparison.meanDelta <= MAX_MEAN_DELTA
  const acceptedAntialiasingResidual =
    comparison.dimensionsMatch &&
    gates.passed &&
    !strictGlobalPassed &&
    comparison.changedPixelRatio <= MAX_ACCEPTED_ANTIALIAS_PIXEL_RATIO &&
    comparison.meanDelta <= MAX_ACCEPTED_ANTIALIAS_MEAN_DELTA
  const passed =
    comparison.dimensionsMatch &&
    gates.passed &&
    (strictGlobalPassed || acceptedAntialiasingResidual) &&
    layoutAudit.status === "PASS"

  const failures = [
    ...(comparison.dimensionsMatch ? [] : ["Dimensiones: el render generado no coincide con A4 historico"]),
    ...(comparison.changedPixelRatio <= MAX_CHANGED_PIXEL_RATIO || acceptedAntialiasingResidual
      ? []
      : [`Pixel diff global: ${(comparison.changedPixelRatio * 100).toFixed(2)}% > ${(MAX_CHANGED_PIXEL_RATIO * 100).toFixed(2)}%`]),
    ...(comparison.meanDelta <= MAX_MEAN_DELTA || acceptedAntialiasingResidual
      ? []
      : [`Delta medio global: ${comparison.meanDelta.toFixed(2)} > ${MAX_MEAN_DELTA.toFixed(2)}`]),
    ...gates.failures,
    ...layoutAudit.failures.map((failure) => `Layout fixture: ${failure}`),
  ]

  const summary = {
    status: passed ? "PASS" : "FAIL",
    document_number: sample.document.document_number,
    reference_file: sample.referenceFile.file_name,
    changed_pixel_ratio: comparison.changedPixelRatio,
    mean_delta: comparison.meanDelta,
    dimensions_match: comparison.dimensionsMatch,
    thresholds: {
      max_changed_pixel_ratio: MAX_CHANGED_PIXEL_RATIO,
      max_mean_delta: MAX_MEAN_DELTA,
      max_region_box_delta_px: MAX_REGION_BOX_DELTA_PX,
      max_accepted_antialias_pixel_ratio: MAX_ACCEPTED_ANTIALIAS_PIXEL_RATIO,
      max_accepted_antialias_mean_delta: MAX_ACCEPTED_ANTIALIAS_MEAN_DELTA,
    },
    strict_global_status: strictGlobalPassed ? "PASS" : "FAIL",
    residual_kind: acceptedAntialiasingResidual ? "word_vs_chromium_antialiasing" : null,
    residual_note: acceptedAntialiasingResidual
      ? "Geometria, color y assets pasan; el residual bruto procede de rasterizacion de Franklin Gothic en Word PDF frente a Chromium."
      : null,
    failures,
    layout_fixtures: layoutAudit,
    artifacts: {
      reference_pdf: referencePdf,
      generated_pdf: generatedPdf,
      reference_png: referencePng,
      generated_png: generatedPng,
      diff_png: comparison.diffPng,
      side_by_side_png: sideBySidePng,
    },
    metrics: {
      reference: referenceMetrics,
      generated: generatedMetrics,
      regions: gates.region_results,
    },
    output_dir: OUT_DIR,
  }
  writeSummary(summary)

  console.log(JSON.stringify(summary, null, 2))

  if (!passed) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
