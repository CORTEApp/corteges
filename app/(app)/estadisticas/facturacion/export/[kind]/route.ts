import {
  buildFiscalCsv,
  fiscalCsvFileName,
  listFiscalBillingStatistics,
  normalizeFiscalPeriod,
  normalizeFiscalView,
  normalizeFiscalYear,
  type FiscalViewId,
} from "@/lib/statistics/fiscal"

function contentDisposition(filename: string) {
  const fallback = filename.replace(/[^\w.\- ]+/g, "_")
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const { kind } = await params
  const view = normalizeFiscalView(kind) as FiscalViewId

  if (view !== kind) {
    return new Response("Export no encontrado.", { status: 404 })
  }

  const url = new URL(request.url)
  const year = normalizeFiscalYear(url.searchParams.get("year") ?? undefined)
  const period = normalizeFiscalPeriod(url.searchParams.get("periodo") ?? undefined)
  const data = await listFiscalBillingStatistics({
    taxYear: year,
    periodId: period,
    viewId: view,
    nextPath: `/estadisticas/facturacion?vista=${view}&periodo=${period}&year=${year}`,
  })
  const csv = buildFiscalCsv(view, data)
  const filename = fiscalCsvFileName(view, data)

  return new Response(csv, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": contentDisposition(filename),
      "Content-Type": "text/csv; charset=utf-8",
    },
  })
}
