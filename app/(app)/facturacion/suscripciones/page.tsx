import Link from "next/link"
import { CalendarClock, Euro, ListChecks, PackagePlus, RefreshCw } from "lucide-react"

import {
  SubscriptionFiltersBar,
  SubscriptionsTable,
} from "@/app/(app)/facturacion/suscripciones/_components/subscription-list"
import { ResourceListScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"
import { FILTERS_LAYOUT_CLASS } from "@/components/ui/filter-sidebar-card"
import { listSubscriptions } from "@/lib/billing/data"
import { formatAmount, subscriptionStatusValue, toNumber } from "@/lib/billing/format"
import type { BillingSubscriptionFilters } from "@/lib/billing/types"

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const filters: BillingSubscriptionFilters = {
    q: one(params.q),
    status: one(params.status) ?? "active",
  }
  const { subscriptions } = await listSubscriptions(filters)
  const activeCount = subscriptions.filter((subscription) => subscriptionStatusValue(subscription) === "active").length
  const futureCount = subscriptions.filter((subscription) => subscriptionStatusValue(subscription) === "future").length
  const visibleTotal = subscriptions.reduce((total, subscription) => total + toNumber(subscription.recurring_total_amount), 0)

  return (
    <ResourceListScreen
      header={{
        icon: <RefreshCw className="size-6" aria-hidden="true" />,
        title: "Suscripciones",
        subtitle: "Recurrencias de facturacion con vigencia, cantidad e importe mensual. No generan facturas automaticamente.",
        actions: (
          <Button asChild>
            <Link href="/facturacion/suscripciones/nuevo">
              <PackagePlus aria-hidden="true" />
              Nueva suscripcion
            </Link>
          </Button>
        ),
      }}
      metrics={[
        {
          label: "Visibles",
          value: String(subscriptions.length),
          description: "Resultado del filtro actual",
          icon: <ListChecks className="size-4" aria-hidden="true" />,
        },
        { label: "Activas", value: String(activeCount), tone: "success" },
        { label: "Futuras", value: String(futureCount), tone: "info", icon: <CalendarClock className="size-4" aria-hidden="true" /> },
        {
          label: "Total visible",
          value: `${formatAmount(visibleTotal)} €`,
          description: "Suma recurrente de la vista",
          icon: <Euro className="size-4" aria-hidden="true" />,
        },
      ]}
    >
      <div className={FILTERS_LAYOUT_CLASS}>
        <SubscriptionFiltersBar filters={filters} />
        <div className="space-y-6">
          <SubscriptionsTable subscriptions={subscriptions} />
        </div>
      </div>
    </ResourceListScreen>
  )
}
