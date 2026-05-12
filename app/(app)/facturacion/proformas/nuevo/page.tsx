import Link from "next/link"
import { ArrowLeft, FilePlus2 } from "lucide-react"

import { ProformaForm } from "@/app/(app)/facturacion/proformas/_components/proforma-form"
import { ResourceEditScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"
import { getBillingNumberPreview, listBillingClients, listBillingFacturableOptions } from "@/lib/billing/data"

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

export default async function NewProformaPage() {
  const [clients, facturables, nextNumberPreview] = await Promise.all([
    listBillingClients(),
    listBillingFacturableOptions(),
    getBillingNumberPreview("proforma"),
  ])
  const today = new Date()

  return (
    <ResourceEditScreen
      header={{
        icon: <FilePlus2 className="size-6" aria-hidden="true" />,
        title: "Nueva proforma",
        subtitle: "Documento comercial P separado de la factura fiscal F.",
        actions: (
          <Button asChild variant="outline">
            <Link href="/facturacion/proformas">
              <ArrowLeft aria-hidden="true" />
              Proformas
            </Link>
          </Button>
        ),
      }}
    >
      <ProformaForm
        clients={clients}
        facturables={facturables}
        nextNumberPreview={nextNumberPreview}
        today={dateInputValue(today)}
        defaultDueDate={dateInputValue(addDays(today, 30))}
      />
    </ResourceEditScreen>
  )
}
