import { AlertTriangle, CheckCircle2, FileSearch, Inbox, Mail, UploadCloud } from "lucide-react"

import {
  ExpenseInvoiceIntakePanel,
  ExpenseInvoiceIntakeTable,
} from "@/app/(app)/gastos/recepcion/_components/intake-list"
import { ResourceListScreen } from "@/components/resource-screens"
import { Badge } from "@/components/ui/badge"
import { FILTERS_LAYOUT_CLASS } from "@/components/ui/filter-sidebar-card"
import { listExpenseInvoiceIntake } from "@/lib/expenses/invoice-intake/data"
import type { ExpenseInvoiceIntakeFilters } from "@/lib/expenses/invoice-intake/types"
import { getModuleOutbox } from "@/lib/mail/settings"

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function numberParam(value: string | string[] | undefined) {
  const parsed = Number.parseInt(one(value) ?? "", 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function Notice({ params }: { params: Record<string, string | string[] | undefined> }) {
  const uploaded = numberParam(params.uploaded)
  const imported = numberParam(params.imported)
  const skipped = numberParam(params.skipped)
  const scanned = numberParam(params.scanned)

  if (!uploaded && !imported && !skipped && !scanned) {
    return null
  }

  return (
    <div className="rounded-[var(--radius-panel)] border border-primary/15 bg-primary/10 px-3 py-2 text-sm leading-6 text-primary">
      {uploaded ? <div>{uploaded} PDF subido{uploaded === 1 ? "" : "s"}.</div> : null}
      {imported ? <div>{imported} adjunto{imported === 1 ? "" : "s"} importado{imported === 1 ? "" : "s"}.</div> : null}
      {scanned ? <div>{scanned} adjunto{scanned === 1 ? "" : "s"} PDF revisado{scanned === 1 ? "" : "s"}.</div> : null}
      {skipped ? <div>{skipped} archivo{skipped === 1 ? "" : "s"} omitido{skipped === 1 ? "" : "s"} por duplicado o formato.</div> : null}
    </div>
  )
}

export default async function ExpenseInvoiceIntakePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const filters: ExpenseInvoiceIntakeFilters = {
    q: one(params.q),
    status: one(params.status) ?? "all",
    supplier: one(params.supplier) ?? "all",
    source: one(params.source) ?? "all",
  }
  const { items, suppliers, templates } = await listExpenseInvoiceIntake(filters)
  const configuredOutbox = await getModuleOutbox("expense_invoice_intake")
  const pendingCount = items.filter((item) => item.status === "pendiente" || item.status === "extraida" || item.status === "requiere_revision").length
  const approvedCount = items.filter((item) => item.status === "aprobada").length
  const failedCount = items.filter((item) => item.status === "fallida").length
  const emailCount = items.filter((item) => item.source_kind === "email").length

  return (
    <ResourceListScreen
      header={{
        icon: <FileSearch className="size-6" aria-hidden="true" />,
        title: "Recepcion de facturas",
        subtitle: "PDFs de proveedores convertidos a borradores revisables sin IA.",
      }}
      metrics={[
        { label: "Bandeja", value: String(items.length), description: "Resultado del filtro", icon: <Inbox className="size-4" aria-hidden="true" /> },
        { label: "Por revisar", value: String(pendingCount), tone: "warning", icon: <AlertTriangle className="size-4" aria-hidden="true" /> },
        { label: "Aprobadas", value: String(approvedCount), tone: "success", icon: <CheckCircle2 className="size-4" aria-hidden="true" /> },
        { label: "Plantillas", value: String(templates.length), description: `${emailCount} desde email`, icon: <Mail className="size-4" aria-hidden="true" /> },
      ]}
    >
      <div className={FILTERS_LAYOUT_CLASS} data-surface-id="expense_invoice_intake_list">
        <ExpenseInvoiceIntakePanel
          filters={filters}
          suppliers={suppliers}
          configuredOutbox={configuredOutbox}
          notice={<Notice params={params} />}
        />
        <div className="space-y-4">
          {failedCount ? (
            <div className="flex items-center gap-2 rounded-[var(--radius-panel)] border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <UploadCloud className="size-4" aria-hidden="true" />
              <span>{failedCount} PDF no tiene texto util o necesita correccion manual.</span>
              <Badge tone="warning">Sin OCR v1</Badge>
            </div>
          ) : null}
          <ExpenseInvoiceIntakeTable items={items} />
        </div>
      </div>
    </ResourceListScreen>
  )
}
