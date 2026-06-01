import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

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
const PLAYWRIGHT_CHROMIUM_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--no-zygote",
]

type PdfBrowserSession = {
  addCookies: (cookies: Array<{ name: string; value: string; url: string }>) => Promise<void>
  close: () => Promise<void>
  newPage: () => Promise<PdfPage>
}

type PdfPage = {
  goto: (url: string, options: { waitUntil: "networkidle" }) => Promise<unknown>
  pdf: (options: {
    format: "A4"
    margin: { top: string; right: string; bottom: string; left: string }
    preferCSSPageSize: boolean
    printBackground: boolean
  }) => Promise<Buffer | Uint8Array>
  setContent: (html: string, options: { waitUntil: "networkidle" }) => Promise<void>
  url: () => string
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

function configurePlaywrightBrowserPath() {
  if (process.env.NODE_ENV === "production") {
    process.env.PLAYWRIGHT_BROWSERS_PATH = PLAYWRIGHT_BROWSER_PATH
  }
}

function explicitChromiumExecutablePath() {
  const candidate =
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    process.env.CHROME_BIN ||
    process.env.CHROMIUM_PATH ||
    null

  if (!candidate) {
    return null
  }

  const normalized = candidate.replace(/\\/g, "/")
  if (
    normalized === "/tmp/chromium" &&
    process.env.BILLING_PDF_ALLOW_TMP_CHROMIUM !== "1"
  ) {
    console.warn("[billing-pdf] ignoring unstable /tmp/chromium executable; using bundled Playwright browser")
    return null
  }

  if (!existsSync(candidate)) {
    console.warn("[billing-pdf] configured chromium executable does not exist; using bundled Playwright browser", {
      executablePath: candidate,
    })
    return null
  }

  return candidate
}

function browserLaunchOptions(executablePath: string) {
  return {
    args: PLAYWRIGHT_CHROMIUM_ARGS,
    executablePath,
    headless: true,
  }
}

async function createPersistentPdfBrowserSession(): Promise<PdfBrowserSession> {
  const { chromium } = await import("playwright")
  const userDataDir = await mkdtemp(join(tmpdir(), "corteges-pdf-"))
  const executablePath = explicitChromiumExecutablePath() ?? chromium.executablePath()

  console.info("[billing-pdf] launching chromium", {
    executablePath,
    playwrightBrowsersPath: process.env.PLAYWRIGHT_BROWSERS_PATH ?? null,
  })

  try {
    const context = await chromium.launchPersistentContext(userDataDir, browserLaunchOptions(executablePath))

    return {
      addCookies: (cookies) => context.addCookies(cookies),
      close: async () => {
        try {
          await context.close()
        } finally {
          await rm(userDataDir, { recursive: true, force: true })
        }
      },
      newPage: () => context.newPage(),
    } as PdfBrowserSession
  } catch (error) {
    await rm(userDataDir, { recursive: true, force: true })
    throw error
  }
}

async function createEphemeralPdfBrowserSession(): Promise<PdfBrowserSession> {
  const { chromium } = await import("playwright")
  const executablePath = explicitChromiumExecutablePath() ?? chromium.executablePath()
  const browser = await chromium.launch(browserLaunchOptions(executablePath))
  const context = await browser.newContext()

  return {
    addCookies: (cookies) => context.addCookies(cookies),
    close: async () => {
      try {
        await context.close()
      } finally {
        await browser.close()
      }
    },
    newPage: () => context.newPage(),
  }
}

async function createPdfBrowserSession(): Promise<PdfBrowserSession> {
  configurePlaywrightBrowserPath()

  try {
    return await createPersistentPdfBrowserSession()
  } catch (error) {
    console.error("[billing-pdf] persistent chromium launch failed; retrying with ephemeral context", error)
    return createEphemeralPdfBrowserSession()
  }
}

async function renderPdfFromTemplateUrl(request: Request) {
  const templateUrl = templateUrlForRequest(request)
  const session = await createPdfBrowserSession()

  try {
    const cookies = cookiesForPlaywright(request.headers.get("cookie"), templateUrl.origin)
    if (cookies.length > 0) {
      await session.addCookies(cookies)
    }

    const page = await session.newPage()
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

    return Buffer.from(pdf)
  } finally {
    await session.close()
  }
}

async function renderPdfFromHtml(payload: BillingDocumentPrintPayload) {
  const session = await createPdfBrowserSession()

  try {
    const page = await session.newPage()
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

    return Buffer.from(pdf)
  } finally {
    await session.close()
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
