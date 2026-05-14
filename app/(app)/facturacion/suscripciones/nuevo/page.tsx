import Link from "next/link"
import { ArrowLeft, CalendarClock, PackagePlus, RefreshCw, Save } from "lucide-react"

import { SubscriptionForm } from "@/app/(app)/facturacion/suscripciones/_components/subscription-form"
import { ResourceEditScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"
import { listSubscriptionFormOptions } from "@/lib/billing/data"

const SUBSCRIPTION_FORM_ID = "subscription-create-form"

export default async function NewSubscriptionPage() {
  const { clients, facturables } = await listSubscriptionFormOptions()

  return (
    <ResourceEditScreen
      header={{
        icon: <PackagePlus className="size-6" aria-hidden="true" />,
        title: "Nueva suscripcion",
        subtitle: "Alta de una recurrencia comercial con snapshot de cliente, concepto e importe.",
        actions: (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/facturacion/suscripciones">
                <ArrowLeft aria-hidden="true" />
                Volver al listado
              </Link>
            </Button>
            <Button type="submit" form={SUBSCRIPTION_FORM_ID}>
              <Save aria-hidden="true" />
              Guardar suscripcion
            </Button>
          </div>
        ),
      }}
      metrics={[
        { label: "Modulo", value: "Suscripciones", icon: <RefreshCw className="size-4" aria-hidden="true" /> },
        { label: "Vigencia", value: "Fecha fin", icon: <CalendarClock className="size-4" aria-hidden="true" /> },
        { label: "Clientes", value: String(clients.length) },
        { label: "Facturables", value: String(facturables.length) },
      ]}
      contentClassName="max-w-5xl"
    >
      <SubscriptionForm actionsPlacement="page" clients={clients} facturables={facturables} formId={SUBSCRIPTION_FORM_ID} />
    </ResourceEditScreen>
  )
}
