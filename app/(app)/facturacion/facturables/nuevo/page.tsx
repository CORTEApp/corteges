import Link from "next/link"
import { ArrowLeft, PackagePlus, ReceiptText, Save } from "lucide-react"

import { FacturableForm } from "@/app/(app)/facturacion/facturables/_components/facturable-form"
import { ResourceEditScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"
import { listFacturableCodes, requireBillingUser } from "@/lib/billing/data"

const FACTURABLE_FORM_ID = "facturable-create-form"

export default async function NewFacturablePage() {
  await requireBillingUser(undefined, "/facturacion/facturables/nuevo")
  const existingCodes = await listFacturableCodes()

  return (
    <ResourceEditScreen
      header={{
        icon: <PackagePlus className="size-6" aria-hidden="true" />,
        title: "Nuevo facturable",
        subtitle: "Alta de un concepto de catálogo con precio base y estado operativo.",
        actions: (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/facturacion/facturables">
                <ArrowLeft aria-hidden="true" />
                Volver al listado
              </Link>
            </Button>
            <Button type="submit" form={FACTURABLE_FORM_ID}>
              <Save aria-hidden="true" />
              Guardar facturable
            </Button>
          </div>
        ),
      }}
      metrics={[
        { label: "Módulo", value: "Catálogo", icon: <ReceiptText className="size-4" aria-hidden="true" /> },
        { label: "Precio", value: "Base" },
        { label: "Borrado", value: "Desactivar" },
        { label: "Estado inicial", value: "Activo", tone: "success" },
      ]}
      contentClassName="max-w-5xl"
    >
      <FacturableForm actionsPlacement="page" existingCodes={existingCodes} formId={FACTURABLE_FORM_ID} />
    </ResourceEditScreen>
  )
}
