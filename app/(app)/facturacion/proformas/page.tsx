import Link from "next/link"
import { Euro, FilePlus2, ReceiptText, WalletCards } from "lucide-react"

import { BillingDocumentFiltersBar, BillingDocumentsTable } from "@/app/(app)/facturacion/_components/billing-document-list"
import { ResourceListScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"
import { FILTERS_LAYOUT_CLASS } from "@/components/ui/filter-sidebar-card"
import { listBillingDocuments } from "@/lib/billing/data"
import { formatAmount } from "@/lib/billing/format"
import type { BillingDocumentFilters } from "@/lib/billing/types"

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function ProformasPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const filters: BillingDocumentFilters = {
    q: one(params.q),
    status: one(params.status) ?? "all",
    payment: one(params.payment) ?? "all",
  }
  const { documents } = await listBillingDocuments("proforma", filters)
  const paidCount = documents.filter((document) => document.payment_status === "paid").length
  const invoicedCount = documents.filter((document) => document.status === "invoiced").length
  const pendingTotal = documents
    .filter((document) => document.payment_status === "unpaid")
    .reduce((total, document) => total + Number(document.total_amount), 0)

  return (
    <ResourceListScreen
      header={{
        icon: <ReceiptText className="size-6" aria-hidden="true" />,
        title: "Proformas",
        subtitle: "Serie P comercial: pago completo antes de emitir factura fiscal.",
        actions: (
          <Button asChild>
            <Link href="/facturacion/proformas/nuevo">
              <FilePlus2 aria-hidden="true" />
              Nueva proforma
            </Link>
          </Button>
        ),
      }}
      metrics={[
        { label: "Proformas", value: String(documents.length), icon: <ReceiptText className="size-4" aria-hidden="true" /> },
        { label: "Pagadas", value: String(paidCount), tone: "success", icon: <WalletCards className="size-4" aria-hidden="true" /> },
        { label: "Facturadas", value: String(invoicedCount), tone: "info" },
        {
          label: "Pendiente",
          value: `${formatAmount(pendingTotal)} €`,
          tone: pendingTotal > 0 ? "warning" : "neutral",
          icon: <Euro className="size-4" aria-hidden="true" />,
        },
      ]}
    >
      <div className={FILTERS_LAYOUT_CLASS}>
        <BillingDocumentFiltersBar documentType="proforma" filters={filters} />
        <div className="space-y-6">
          <BillingDocumentsTable documentType="proforma" documents={documents} />
        </div>
      </div>
    </ResourceListScreen>
  )
}
