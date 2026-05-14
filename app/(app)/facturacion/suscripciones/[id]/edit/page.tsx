import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CalendarClock, FileText, RefreshCw, Save, Settings2 } from "lucide-react"

import { SubscriptionForm } from "@/app/(app)/facturacion/suscripciones/_components/subscription-form"
import { SubscriptionAdminReadOnly } from "@/app/(app)/facturacion/suscripciones/_components/subscription-readonly-sections"
import { ResourceContentTabs } from "@/components/resource-content-tabs"
import { ResourceEditScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"
import { FormSectionTabPanel } from "@/components/ui/form-section-tabs"
import { getSubscriptionDetail, listSubscriptionFormOptions } from "@/lib/billing/data"
import {
  formatAmount,
  subscriptionStatusLabel,
  subscriptionStatusTone,
  subscriptionStatusValue,
} from "@/lib/billing/format"

export default async function EditSubscriptionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const detail = await getSubscriptionDetail(id)

  if (!detail) {
    notFound()
  }

  const { subscription } = detail
  const { clients, facturables } = await listSubscriptionFormOptions(subscription)
  const status = subscriptionStatusValue(subscription)

  return (
    <ResourceEditScreen
      header={{
        icon: <RefreshCw className="size-6" aria-hidden="true" />,
        title: `Editar ${subscription.subscription_code}`,
        subtitle: "Edicion separada de la ficha de suscripcion.",
        actions: (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/facturacion/suscripciones/${subscription.id}`}>
                <ArrowLeft aria-hidden="true" />
                Volver a ficha
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/facturacion/suscripciones">Listado</Link>
            </Button>
          </div>
        ),
      }}
      metrics={[
        {
          label: "Estado",
          value: subscriptionStatusLabel(status),
          tone: subscriptionStatusTone(status),
        },
        { label: "Total actual", value: `${formatAmount(subscription.recurring_total_amount)} €` },
        { label: "Guardado", value: "Suscripcion", icon: <Save className="size-4" aria-hidden="true" /> },
        { label: "Vigencia", value: subscription.end_date ? "Con fin" : "Abierta", icon: <CalendarClock className="size-4" aria-hidden="true" /> },
      ]}
      contentClassName="max-w-5xl"
    >
      <ResourceContentTabs
        defaultTab="datos"
        tabs={[
          { id: "datos", label: "Datos", icon: <FileText className="size-4" aria-hidden="true" /> },
          { id: "administracion", label: "Administracion", icon: <Settings2 className="size-4" aria-hidden="true" /> },
        ]}
      >
        <FormSectionTabPanel tabId="datos">
          <SubscriptionForm
            subscription={subscription}
            clients={clients}
            facturables={facturables}
            formId={`subscription-edit-form-${subscription.id}`}
          />
        </FormSectionTabPanel>

        <FormSectionTabPanel tabId="administracion">
          <SubscriptionAdminReadOnly subscription={subscription} />
        </FormSectionTabPanel>
      </ResourceContentTabs>
    </ResourceEditScreen>
  )
}
