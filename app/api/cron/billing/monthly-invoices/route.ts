import {
  normalizeBillingPeriodStart,
  prepareMonthlyInvoiceApprovalCandidates,
} from "@/lib/billing/approval"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function truncateError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "No se pudo generar el lote mensual.")
  return message.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]").slice(0, 1200)
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ success: false }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const periodStart = normalizeBillingPeriodStart(url.searchParams.get("period"))
    const result = await prepareMonthlyInvoiceApprovalCandidates(periodStart, null, "cron")

    return Response.json({
      success: true,
      period_start: result.batch.period_start,
      period_end: result.batch.period_end,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      candidate_count: result.candidateCount,
      total_amount: result.totalAmount,
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
