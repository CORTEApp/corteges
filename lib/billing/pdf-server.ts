import { createHash } from "node:crypto"

import { createAdminClient } from "@/lib/supabase/admin"
import {
  loadBillingDocumentPrintPayloadAdmin,
  requireBillingDocumentPrintPayload,
} from "@/lib/billing/pdf-payload"
import type { BillingDocumentFile, BillingDocumentType } from "@/lib/billing/types"
import {
  buildBillingDocumentPrintHtml,
  type BillingDocumentPrintPayload,
} from "@/lib/billing/pdf-template-html.mjs"

const BILLING_DOCUMENTS_BUCKET = "billing-documents"
const PLAYWRIGHT_BROWSER_PATH = "0"
const PLAYWRIGHT_CHROMIUM_ARGS = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]

type BrowserInstance = {
  close: () => Promise<void>
  newContext: () => Promise<{
    addCookies: (cookies: Array<{ name: string; value: string; url: string }>) => Promise<void>
    close: () => Promise<void>
    newPage: () => Promise<{
      goto: (url: string, options: { waitUntil: "networkidle" }) => Promise<unknown>
      pdf: (options: {
        format: "A4"
        margin: { top: string; right: string; bottom: string; left: string }
        preferCSSPageSize: boolean
        printBackground: boolean
      }) => Promise<Buffer | Uint8Array>
      setContent: (html: string, options: { waitUntil: "networkidle" }) => Promise<void>
      url: () => string
    }>
  }>
}

function templateUrlForRequest(request: Request) {
  const url = new URL(request.url)
  url.pathname = url.pathname.replace(/\/pdf\/?$/, "/plantilla")
  url.searchParams.set("pdf", "1")
  return url
}

function cookiesForPlaywright(cookieHeader: string | null, url: string) {
  if (!cookieHeader) {
    return []
  }

  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separator = part.indexOf("=")
      if (separator === -1) {
        return null
      }

      return {
        name: part.slice(0, separator),
        value: part.slice(separator + 1),
        url,
      }
    })
    .filter((cookie): cookie is { name: string; value: string; url: string } => Boolean(cookie?.name))
}

function contentDisposition(filename: string) {
  const fallback = filename.replace(/[^\w.\- ]+/g, "_")
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

async function launchChromiumBrowser(): Promise<BrowserInstance> {
  if (process.env.VERCEL) {
    return launchBundledChromiumBrowser()
  }

  return launchLocalChromiumBrowser()
}

async function launchBundledChromiumBrowser(): Promise<BrowserInstance> {
  const chromiumModule = await import("@sparticuz/chromium")
  const { chromium: playwright } = await import("playwright-core")
  const chromium = chromiumModule.default
  chromium.setGraphicsMode = false

  return playwright.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  }) as Promise<BrowserInstance>
}

async function launchLocalChromiumBrowser(): Promise<BrowserInstance> {
  if (process.env.NODE_ENV === "production" && !process.env.PLAYWRIGHT_BROWSERS_PATH) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = PLAYWRIGHT_BROWSER_PATH
  }

  const { chromium } = await import("playwright")
  return chromium.launch({
    args: PLAYWRIGHT_CHROMIUM_ARGS,
    headless: true,
  }) as Promise<BrowserInstance>
}

async function renderPdfFromTemplateUrl(request: Request) {
  const templateUrl = templateUrlForRequest(request)
  const browser = await launchChromiumBrowser()

  try {
    const context = await browser.newContext()
    const cookies = cookiesForPlaywright(request.headers.get("cookie"), templateUrl.origin)
    if (cookies.length > 0) {
      await context.addCookies(cookies)
    }

    const page = await context.newPage()
    await page.goto(templateUrl.toString(), { waitUntil: "networkidle" })

    if (new URL(page.url()).pathname.startsWith("/auth/login")) {
      throw new Error("Billing PDF template render was redirected to login.")
    }

    const pdf = await page.pdf({
      format: "A4",
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      preferCSSPageSize: true,
      printBackground: true,
    })

    await context.close()
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

async function renderPdfFromHtml(payload: BillingDocumentPrintPayload) {
  const browser = await launchChromiumBrowser()

  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.setContent(
      buildBillingDocumentPrintHtml(payload, {
        fullDocument: true,
        assetBaseUrl: resolveAssetBaseUrl(),
      }),
      { waitUntil: "networkidle" },
    )

    const pdf = await page.pdf({
      format: "A4",
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      preferCSSPageSize: true,
      printBackground: true,
    })

    await context.close()
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

function resolveAssetBaseUrl() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    process.env.MICROSOFT_GRAPH_REDIRECT_BASE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

  return raw.replace(/\/$/g, "")
}

async function persistGeneratedPdf(
  payload: BillingDocumentPrintPayload,
  pdf: Buffer,
  uploadedBy: string | null,
): Promise<BillingDocumentFile> {
  const supabase = createAdminClient()
  const sourceSha256 = createHash("sha256").update(pdf).digest("hex")

  const { error: uploadError } = await supabase.storage
    .from(BILLING_DOCUMENTS_BUCKET)
    .upload(payload.generatedStoragePath, pdf, {
      cacheControl: "3600",
      contentType: "application/pdf",
      upsert: true,
    })

  if (uploadError) {
    throw uploadError
  }

  const { data, error: metadataError } = await supabase
    .from("billing_document_files")
    .upsert(
      {
        document_id: payload.document.id,
        file_name: payload.generatedFileName,
        mime_type: "application/pdf",
        file_size: pdf.length,
        storage_bucket: BILLING_DOCUMENTS_BUCKET,
        storage_path: payload.generatedStoragePath,
        source_kind: "generated",
        source_sha256: sourceSha256,
        source_url: null,
        source_downloaded_at: null,
        sharepoint_site_id: null,
        sharepoint_list_id: null,
        sharepoint_item_id: null,
        sharepoint_unique_id: null,
        binary_file_id: null,
        uploaded_by: uploadedBy,
      },
      { onConflict: "storage_path" },
    )
    .select("*")
    .single()

  if (metadataError) {
    await supabase.storage.from(BILLING_DOCUMENTS_BUCKET).remove([payload.generatedStoragePath])
    throw metadataError
  }

  return data as BillingDocumentFile
}

export async function persistGeneratedBillingPdf(
  documentId: string,
  expectedType: BillingDocumentType,
  uploadedBy: string | null,
) {
  const payload = await loadBillingDocumentPrintPayloadAdmin(documentId, expectedType)
  const pdf = await renderPdfFromHtml(payload)
  return persistGeneratedPdf(payload, pdf, uploadedBy)
}

export async function handleBillingDocumentPdfRequest(
  request: Request,
  documentId: string,
  expectedType: BillingDocumentType,
) {
  const { user, payload } = await requireBillingDocumentPrintPayload(documentId, expectedType)
  const pdf = await renderPdfFromTemplateUrl(request)
  await persistGeneratedPdf(payload, pdf, user.id)

  return new Response(pdf, {
    headers: {
      "Content-Disposition": contentDisposition(payload.generatedFileName),
      "Content-Length": String(pdf.length),
      "Content-Type": "application/pdf",
      "Cache-Control": "no-store",
    },
  })
}
