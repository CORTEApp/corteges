import Link from "next/link"
import { ArrowLeft, Eye, FileDown, ReceiptText } from "lucide-react"

import { BillingDocumentDetailView } from "@/app/(app)/facturacion/_components/billing-document-detail"
import { ResourceDetailScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"
import { requireBillingDocumentDetail } from "@/lib/billing/data"
import { formatAmount, formatDate } from "@/lib/billing/format"

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

export default async function ProformaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const detail = await requireBillingDocumentDetail(id, "proforma")
  const { document } = detail

  return (
    <ResourceDetailScreen
      header={{
        icon: <ReceiptText className="size-6" aria-hidden="true" />,
        title: document.document_number,
        subtitle: `${document.client_name} · ${formatDate(document.issue_date)}`,
        actions: (
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/facturacion/proformas/${document.id}/pdf`}>
                <FileDown aria-hidden="true" />
                Descargar PDF
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/facturacion/proformas/${document.id}/plantilla`}>
                <Eye aria-hidden="true" />
                Ver plantilla
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/facturacion/proformas">
                <ArrowLeft aria-hidden="true" />
                Proformas
              </Link>
            </Button>
          </div>
        ),
      }}
      metrics={[
        { label: "Base", value: `${formatAmount(document.subtotal_amount)} €` },
        { label: "IVA", value: `${formatAmount(document.tax_amount)} €` },
        { label: "Total", value: `${formatAmount(document.total_amount)} €`, tone: "info" },
        { label: "Vencimiento", value: formatDate(document.due_date) },
      ]}
    >
      <BillingDocumentDetailView detail={detail} today={dateInputValue(new Date())} />
    </ResourceDetailScreen>
  )
}
