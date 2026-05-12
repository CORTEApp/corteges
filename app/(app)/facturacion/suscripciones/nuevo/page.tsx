import Link from "next/link"
import { ArrowLeft, CalendarClock, PackagePlus, RefreshCw } from "lucide-react"

import { SubscriptionForm } from "@/app/(app)/facturacion/suscripciones/_components/subscription-form"
import { ResourceEditScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"
import { listSubscriptionFormOptions } from "@/lib/billing/data"

export default async function NewSubscriptionPage() {
  const { clients, facturables } = await listSubscriptionFormOptions()

  return (
    <ResourceEditScreen
      header={{
        icon: <PackagePlus className="size-6" aria-hidden="true" />,
        title: "Nueva suscripcion",
        subtitle: "Alta de una recurrencia comercial con snapshot de cliente, concepto e importe.",
        actions: (
          <Button asChild variant="outline">
            <Link href="/facturacion/suscripciones">
              <ArrowLeft aria-hidden="true" />
              Volver al listado
            </Link>
          </Button>
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
      <SubscriptionForm clients={clients} facturables={facturables} />
    </ResourceEditScreen>
  )
}
