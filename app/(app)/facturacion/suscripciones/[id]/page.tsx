import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CalendarClock, Database, FileText, Pencil, RefreshCw } from "lucide-react"

import {
  SubscriptionFichaReadOnly,
  SubscriptionTraceReadOnly,
} from "@/app/(app)/facturacion/suscripciones/_components/subscription-readonly-sections"
import { ResourceContentTabs } from "@/components/resource-content-tabs"
import { ResourceDetailScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"
import { FormSectionTabPanel } from "@/components/ui/form-section-tabs"
import { getSubscriptionDetail } from "@/lib/billing/data"
import {
  formatAmount,
  formatDate,
  subscriptionStatusLabel,
  subscriptionStatusTone,
  subscriptionStatusValue,
} from "@/lib/billing/format"

export default async function SubscriptionDetailPage({
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
  const status = subscriptionStatusValue(subscription)

  return (
    <ResourceDetailScreen
      header={{
        icon: <RefreshCw className="size-6" aria-hidden="true" />,
        title: subscription.client_name,
        subtitle: `${subscription.subscription_code} · ${subscription.description}`,
        actions: (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/facturacion/suscripciones">
                <ArrowLeft aria-hidden="true" />
                Volver
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/facturacion/suscripciones/${subscription.id}/edit`}>
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
          value: subscriptionStatusLabel(status),
          tone: subscriptionStatusTone(status),
        },
        { label: "Inicio", value: formatDate(subscription.start_date), icon: <CalendarClock className="size-4" aria-hidden="true" /> },
        { label: "Total", value: `${formatAmount(subscription.recurring_total_amount)} €` },
        { label: "Origen", value: subscription.sharepoint_item_id ? "SharePoint" : "Manual", icon: <Database className="size-4" aria-hidden="true" /> },
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
          <SubscriptionFichaReadOnly subscription={subscription} />
        </FormSectionTabPanel>

        <FormSectionTabPanel tabId="trazabilidad">
          <SubscriptionTraceReadOnly subscription={subscription} />
        </FormSectionTabPanel>
      </ResourceContentTabs>
    </ResourceDetailScreen>
  )
}
