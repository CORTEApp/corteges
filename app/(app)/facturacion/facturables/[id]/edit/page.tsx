import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ReceiptText, Save } from "lucide-react"

import { FacturableForm } from "@/app/(app)/facturacion/facturables/_components/facturable-form"
import { ResourceEditScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"
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
      ]}
      contentClassName="max-w-5xl"
    >
      <FacturableForm
        facturable={facturable}
        existingCodes={existingCodes}
        formId={`facturable-edit-form-${facturable.id}`}
      />
    </ResourceEditScreen>
  )
}
