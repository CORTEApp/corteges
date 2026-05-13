import { handleBillingDocumentPdfRequest } from "@/lib/billing/pdf-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return handleBillingDocumentPdfRequest(request, id, "invoice")
}
