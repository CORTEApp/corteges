import { recoverExpensePdfsFromMail } from "../../../../../tools/recover_expense_pdfs_from_mail.mjs"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEFAULT_LIMIT = 10
const DEFAULT_MAX_MESSAGES = 150
const DEFAULT_DAYS_BEFORE = 45
const DEFAULT_DAYS_AFTER = 120

function truncateError(error) {
  const message = error instanceof Error ? error.message : String(error || "No se pudo recuperar PDFs desde correo.")
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/refresh_token=[^&\s]+/gi, "refresh_token=[redacted]")
    .slice(0, 1200)
}

function intParam(searchParams, name, envName, fallback, min, max) {
  const raw = searchParams.get(name) ?? process.env[envName]
  const parsed = Number.parseInt(String(raw ?? ""), 10)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.min(Math.max(parsed, min), max)
}

function textParam(searchParams, name, envName, fallback) {
  return (searchParams.get(name) ?? process.env[envName] ?? fallback).trim()
}

function boolParam(searchParams, name, envName, fallback = false) {
  const raw = searchParams.get(name) ?? process.env[envName]
  if (raw == null || raw === "") {
    return fallback
  }
  return ["1", "true", "yes", "on"].includes(String(raw).trim().toLowerCase())
}

export async function GET(request) {
  const authHeader = request.headers.get("authorization")
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ success: false }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const dryRun = boolParam(url.searchParams, "dry_run", "EXPENSE_PDF_RECOVERY_DRY_RUN", false)
    const matchMode = textParam(url.searchParams, "match_mode", "EXPENSE_PDF_RECOVERY_MATCH_MODE", "invoice")
    const folderId = textParam(url.searchParams, "folder_id", "EXPENSE_PDF_RECOVERY_FOLDER_ID", "inbox")
    const result = await recoverExpensePdfsFromMail({
      apply: !dryRun,
      dryRun,
      limit: intParam(url.searchParams, "limit", "EXPENSE_PDF_RECOVERY_LIMIT", DEFAULT_LIMIT, 1, 50),
      maxMessages: intParam(
        url.searchParams,
        "max_messages",
        "EXPENSE_PDF_RECOVERY_MAX_MESSAGES",
        DEFAULT_MAX_MESSAGES,
        1,
        500,
      ),
      daysBefore: intParam(
        url.searchParams,
        "days_before",
        "EXPENSE_PDF_RECOVERY_DAYS_BEFORE",
        DEFAULT_DAYS_BEFORE,
        0,
        3650,
      ),
      daysAfter: intParam(
        url.searchParams,
        "days_after",
        "EXPENSE_PDF_RECOVERY_DAYS_AFTER",
        DEFAULT_DAYS_AFTER,
        0,
        3650,
      ),
      matchMode,
      folderId,
      continueOnError: true,
    })

    return Response.json({
      success: result.errors === 0,
      ...result,
    })
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: truncateError(error),
      },
      { status: 500 },
    )
  }
}
