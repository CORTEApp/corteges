import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Database, FileText, Pencil, ReceiptText, Tag } from "lucide-react"

import {
  FacturableFichaReadOnly,
  FacturableTraceReadOnly,
} from "@/app/(app)/facturacion/facturables/_components/facturable-readonly-sections"
import { ResourceContentTabs } from "@/components/resource-content-tabs"
import { ResourceDetailScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"
import { FormSectionTabPanel } from "@/components/ui/form-section-tabs"
import { facturableStateLabel, facturableStateTone, formatAmount } from "@/lib/billing/format"
import { getFacturableDetail } from "@/lib/billing/data"

export default async function FacturableDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const detail = await getFacturableDetail(id)

  if (!detail) {
    notFound()
  }

  const { facturable } = detail

  return (
    <ResourceDetailScreen
      header={{
        icon: <ReceiptText className="size-6" aria-hidden="true" />,
        title: facturable.code,
        subtitle: `${facturable.description} · catálogo de conceptos facturables`,
        actions: (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/facturacion/facturables">
                <ArrowLeft aria-hidden="true" />
                Volver
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/facturacion/facturables/${facturable.id}/edit`}>
                <Pencil aria-hidden="true" />
                Editar
              </Link>
            </Button>
          </div>
        ),
      }}
      metrics={[
        {
          label: "Estado",
          value: facturableStateLabel(facturable),
          tone: facturableStateTone(facturable),
        },
        { label: "Tipo", value: facturable.type, icon: <Tag className="size-4" aria-hidden="true" /> },
        { label: "Precio", value: formatAmount(facturable.unit_price) },
        { label: "Origen", value: facturable.sharepoint_item_id ? "SharePoint" : "Manual", icon: <Database className="size-4" aria-hidden="true" /> },
      ]}
    >
      <ResourceContentTabs
        defaultTab="ficha"
        tabs={[
          { id: "ficha", label: "Ficha", icon: <FileText className="size-4" aria-hidden="true" /> },
          { id: "trazabilidad", label: "Trazabilidad", icon: <Database className="size-4" aria-hidden="true" /> },
        ]}
      >
        <FormSectionTabPanel tabId="ficha">
          <FacturableFichaReadOnly facturable={facturable} />
        </FormSectionTabPanel>

        <FormSectionTabPanel tabId="trazabilidad">
          <FacturableTraceReadOnly facturable={facturable} />
        </FormSectionTabPanel>
      </ResourceContentTabs>
    </ResourceDetailScreen>
  )
}
