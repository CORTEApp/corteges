import Link from "next/link"
import { FileSearch, ShieldCheck } from "lucide-react"

import { ExpenseInvoiceIntakeReview } from "@/app/(app)/gastos/recepcion/_components/intake-detail"
import { ResourceDetailScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"
import { formatExpenseAmountCompact, formatExpenseDate } from "@/lib/expenses/format"
import { requireExpenseInvoiceIntakeDetail } from "@/lib/expenses/invoice-intake/data"
import {
  invoiceIntakeSourceLabels,
  invoiceIntakeStatusLabels,
} from "@/lib/expenses/invoice-intake/format"

export default async function ExpenseInvoiceIntakeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const detail = await requireExpenseInvoiceIntakeDetail(id)
  const { item, documents } = detail

  return (
    <ResourceDetailScreen
      header={{
        icon: <FileSearch className="size-6" aria-hidden="true" />,
        title: item.title ?? item.invoice_number ?? "Factura recibida",
        subtitle: `${invoiceIntakeStatusLabels[item.status]} · ${invoiceIntakeSourceLabels[item.source_kind]}`,
        actions: (
          <Button asChild variant="outline">
            <Link href="/gastos/recepcion">Volver</Link>
          </Button>
        ),
      }}
      metrics={[
        { label: "Proveedor", value: item.supplier_name ?? "Sin proveedor", description: item.supplier_tax_id ?? undefined, icon: <ShieldCheck className="size-4" aria-hidden="true" /> },
        { label: "Fecha", value: formatExpenseDate(item.invoice_date), description: item.invoice_number ?? undefined },
        { label: "Total", value: formatExpenseAmountCompact(item.total_amount), tone: "success" },
        { label: "Docs", value: String(documents.length), description: item.template_id ? "Con plantilla" : "Sin plantilla" },
      ]}
    >
      <ExpenseInvoiceIntakeReview detail={detail} />
    </ResourceDetailScreen>
  )
}

