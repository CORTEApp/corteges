import { Euro, FileCheck2, ReceiptText, WalletCards } from "lucide-react"

import { BillingDocumentFiltersBar, BillingDocumentsTable } from "@/app/(app)/facturacion/_components/billing-document-list"
import { markSelectedInvoicesPaidAction } from "@/app/(app)/facturacion/facturas/actions"
import { ResourceListScreen } from "@/components/resource-screens"
import { FILTERS_LAYOUT_CLASS } from "@/components/ui/filter-sidebar-card"
import { listBillingDocuments } from "@/lib/billing/data"
import { formatAmount } from "@/lib/billing/format"
import type { BillingDocumentFilters } from "@/lib/billing/types"

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function InvoiceQueryNotice({
  paid,
  selected,
}: {
  paid?: string
  selected?: string
}) {
  if (selected === "0") {
    return (
      <div className="rounded-[var(--radius-panel)] border border-amber-200/70 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Selecciona al menos una factura pendiente para marcarla como pagada.
      </div>
    )
  }

  if (paid) {
    return (
      <div className="rounded-[var(--radius-panel)] border border-border/80 bg-[color:var(--surface-2)] px-4 py-3 text-sm text-foreground">
        Facturas marcadas como pagadas: <strong>{paid}</strong>.
      </div>
    )
  }

  return null
}

export default async function FacturasPage({
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
  const { documents } = await listBillingDocuments("invoice", filters)
  const paidCount = documents.filter((document) => document.payment_status === "paid").length
  const pendingCount = documents.filter((document) => document.payment_status === "unpaid").length
  const totalIssued = documents.reduce((total, document) => total + Number(document.total_amount), 0)

  return (
    <ResourceListScreen
      header={{
        icon: <FileCheck2 className="size-6" aria-hidden="true" />,
        title: "Facturas",
        subtitle: "Serie fiscal F, independiente de proformas y preparada para reset anual desde 2027.",
      }}
      metrics={[
        { label: "Facturas", value: String(documents.length), icon: <ReceiptText className="size-4" aria-hidden="true" /> },
        { label: "Pagadas", value: String(paidCount), tone: "success", icon: <WalletCards className="size-4" aria-hidden="true" /> },
        { label: "Pendientes", value: String(pendingCount), tone: pendingCount > 0 ? "warning" : "neutral" },
        {
          label: "Total listado",
          value: `${formatAmount(totalIssued)} €`,
          icon: <Euro className="size-4" aria-hidden="true" />,
        },
      ]}
    >
      <div className={FILTERS_LAYOUT_CLASS}>
        <BillingDocumentFiltersBar documentType="invoice" filters={filters} />
        <div className="space-y-6">
          <InvoiceQueryNotice paid={one(params.paid)} selected={one(params.selected)} />
          <BillingDocumentsTable
            documentType="invoice"
            documents={documents}
            markSelectedPaidAction={markSelectedInvoicesPaidAction}
          />
        </div>
      </div>
    </ResourceListScreen>
  )
}
