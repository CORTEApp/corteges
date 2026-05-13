import { BillingDocumentPrintTemplate } from "@/components/billing/billing-document-print-template"
import { requireBillingDocumentPrintPayload } from "@/lib/billing/pdf-payload"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export default async function ProformaPlantillaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { payload } = await requireBillingDocumentPrintPayload(id, "proforma")

  return <BillingDocumentPrintTemplate payload={payload} />
}
