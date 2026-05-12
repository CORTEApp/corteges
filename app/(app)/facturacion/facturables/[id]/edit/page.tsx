import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Database, FileText, ReceiptText, Save } from "lucide-react"

import { FacturableForm } from "@/app/(app)/facturacion/facturables/_components/facturable-form"
import { FacturableTraceReadOnly } from "@/app/(app)/facturacion/facturables/_components/facturable-readonly-sections"
import { ResourceContentTabs } from "@/components/resource-content-tabs"
import { ResourceEditScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"
import { FormSectionTabPanel } from "@/components/ui/form-section-tabs"
import { facturableStateLabel, facturableStateTone, formatAmount } from "@/lib/billing/format"
import { getFacturableDetail, listFacturableCodes } from "@/lib/billing/data"

export default async function EditFacturablePage({
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
  const existingCodes = await listFacturableCodes(facturable.id)

  return (
    <ResourceEditScreen
      header={{
        icon: <ReceiptText className="size-6" aria-hidden="true" />,
        title: `Editar ${facturable.code}`,
        subtitle: "Edición separada de la ficha del concepto facturable.",
        actions: (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/facturacion/facturables/${facturable.id}`}>
                <ArrowLeft aria-hidden="true" />
                Volver a ficha
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/facturacion/facturables">Listado</Link>
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
        { label: "Precio actual", value: formatAmount(facturable.unit_price) },
        { label: "Guardado", value: "Catálogo", icon: <Save className="size-4" aria-hidden="true" /> },
        { label: "Origen", value: facturable.sharepoint_item_id ? "SharePoint" : "Manual", icon: <Database className="size-4" aria-hidden="true" /> },
      ]}
      contentClassName="max-w-5xl"
    >
      <ResourceContentTabs
        defaultTab="datos"
        tabs={[
          { id: "datos", label: "Datos", icon: <FileText className="size-4" aria-hidden="true" /> },
          { id: "trazabilidad", label: "Trazabilidad", icon: <Database className="size-4" aria-hidden="true" /> },
        ]}
      >
        <FormSectionTabPanel tabId="datos">
          <FacturableForm
            facturable={facturable}
            existingCodes={existingCodes}
            cancelHref={`/facturacion/facturables/${facturable.id}`}
          />
        </FormSectionTabPanel>

        <FormSectionTabPanel tabId="trazabilidad">
          <FacturableTraceReadOnly facturable={facturable} />
        </FormSectionTabPanel>
      </ResourceContentTabs>
    </ResourceEditScreen>
  )
}
