import Link from "next/link"
import { ArrowRight, CalendarClock, PackagePlus, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { FilterSidebarCard } from "@/components/ui/filter-sidebar-card"
import { Input } from "@/components/ui/input"
import {
  MobileRecordActions,
  MobileRecordCard,
  MobileRecordField,
  MobileRecordGrid,
} from "@/components/ui/mobile-record-card"
import { Select } from "@/components/ui/select"
import {
  formatAmount,
  formatDate,
  subscriptionStatusLabel,
  subscriptionStatusTone,
  subscriptionStatusValue,
} from "@/lib/billing/format"
import type { BillingSubscription, BillingSubscriptionFilters } from "@/lib/billing/types"

const statusOptions = [
  ["active", "Activas hoy"],
  ["future", "Futuras"],
  ["history", "Finalizadas"],
  ["all", "Todas"],
]

export function SubscriptionFiltersBar({ filters }: { filters: BillingSubscriptionFilters }) {
  return (
    <FilterSidebarCard
      title="Filtros"
      description="Localiza recurrencias por cliente, CIF, correo, codigo o descripcion."
      contentClassName="space-y-5 pt-5"
    >
      <div className="space-y-3 rounded-[var(--radius-panel)] border border-border/70 bg-[color:var(--surface-2)]/45 p-3.5">
        <Button asChild type="button" className="w-full" variant="secondary">
          <Link href="/facturacion/suscripciones">Borrar todo</Link>
        </Button>
        <p className="text-xs leading-5 text-muted-foreground">
          La vista por defecto suma solo suscripciones activas hoy. Los historicos no se borran.
        </p>
      </div>

      <form className="space-y-5">
        <SidebarField label="Buscar" htmlFor="subscriptions-q">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="subscriptions-q"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Dorado, S-001, plan..."
              className="pl-9"
            />
          </div>
        </SidebarField>

        <SidebarField label="Estado" htmlFor="subscriptions-status">
          <Select
            id="subscriptions-status"
            name="status"
            defaultValue={filters.status ?? "active"}
            options={statusOptions.map(([value, label]) => ({ value, label }))}
          />
        </SidebarField>

        <Button type="submit" className="w-full">
          Filtrar
        </Button>
      </form>
    </FilterSidebarCard>
  )
}

export function SubscriptionsTable({ subscriptions }: { subscriptions: BillingSubscription[] }) {
  if (subscriptions.length === 0) {
    return (
      <EmptyState
        title="No hay suscripciones para este filtro."
        description="Crea una suscripcion o cambia el filtro de estado para revisar historicos."
        actions={
          <Button asChild>
            <Link href="/facturacion/suscripciones/nuevo">
              <PackagePlus aria-hidden="true" />
              Nueva suscripcion
            </Link>
          </Button>
        }
      />
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Suscripciones</CardTitle>
        <CardDescription>Recurrencias comerciales con vigencia, cantidad e importe mensual snapshot.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-3 lg:hidden">
          {subscriptions.map((subscription) => (
            <MobileRecordCard
              key={`mobile-${subscription.id}`}
              eyebrow={subscription.subscription_code}
              title={subscription.client_name}
              subtitle={subscription.description}
              headerSlot={<SubscriptionStatusBadge subscription={subscription} />}
              footer={
                <MobileRecordActions>
                  <Button asChild type="button" variant="outline" size="sm" className="w-full justify-center">
                    <Link href={`/facturacion/suscripciones/${subscription.id}`}>Abrir</Link>
                  </Button>
                </MobileRecordActions>
              }
            >
              <MobileRecordGrid className="grid-cols-2">
                <MobileRecordField label="Inicio" value={formatDate(subscription.start_date)} />
                <MobileRecordField label="Total" value={`${formatAmount(subscription.recurring_total_amount)} €`} />
                <MobileRecordField label="IVA" value={subscription.apply_vat ? `${formatAmount(subscription.vat_rate)}%` : "No"} />
              </MobileRecordGrid>
            </MobileRecordCard>
          ))}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Cliente</th>
                <th className="px-4 py-3 text-left font-medium">Concepto</th>
                <th className="px-4 py-3 text-left font-medium">Inicio</th>
                <th className="px-4 py-3 text-left font-medium">Fin</th>
                <th className="px-4 py-3 text-right font-medium">Cantidad</th>
                <th className="px-4 py-3 text-right font-medium">IVA</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-left font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Ficha</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((subscription) => (
                <tr key={subscription.id} className="border-t border-border/80">
                  <td className="max-w-[18rem] px-4 py-4 align-top">
                    <Link
                      href={`/facturacion/suscripciones/${subscription.id}`}
                      className="font-semibold text-foreground no-underline"
                    >
                      {subscription.client_name}
                    </Link>
                    <div className="mt-1 text-xs text-muted-foreground">{subscription.client_tax_id ?? "-"}</div>
                  </td>
                  <td className="max-w-[28rem] px-4 py-4 align-top text-foreground/85">
                    <span className="inline-flex items-center gap-2 font-semibold text-foreground">
                      <CalendarClock className="size-3.5 text-primary" aria-hidden="true" />
                      {subscription.subscription_code}
                    </span>
                    <div className="mt-1 line-clamp-2 text-sm text-foreground/78">{subscription.description}</div>
                  </td>
                  <td className="px-4 py-4 align-top text-foreground/85">{formatDate(subscription.start_date)}</td>
                  <td className="px-4 py-4 align-top text-foreground/85">{formatDate(subscription.end_date)}</td>
                  <td className="px-4 py-4 text-right align-top text-foreground/85">{formatAmount(subscription.quantity)}</td>
                  <td className="px-4 py-4 text-right align-top text-foreground/85">
                    {subscription.apply_vat ? `${formatAmount(subscription.vat_rate)}%` : "No"}
                  </td>
                  <td className="px-4 py-4 text-right align-top font-semibold text-foreground">
                    {formatAmount(subscription.recurring_total_amount)} €
                  </td>
                  <td className="px-4 py-4 align-top">
                    <SubscriptionStatusBadge subscription={subscription} />
                  </td>
                  <td className="px-4 py-4 text-right align-top">
                    <Button asChild size="icon-sm" variant="ghost" aria-label={`Abrir ${subscription.client_name}`}>
                      <Link href={`/facturacion/suscripciones/${subscription.id}`}>
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function SidebarField({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2.5">
      <label className="text-sm font-medium text-foreground" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  )
}

export function SubscriptionStatusBadge({ subscription }: { subscription: BillingSubscription }) {
  const status = subscriptionStatusValue(subscription)
  return <Badge tone={subscriptionStatusTone(status)}>{subscriptionStatusLabel(status)}</Badge>
}
