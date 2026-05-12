import Link from "next/link"
import { Clock3, FileText, Mail, Phone, Plus, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { FilterSidebarCard } from "@/components/ui/filter-sidebar-card"
import { Input } from "@/components/ui/input"
import { MobileRecordActions, MobileRecordCard, MobileRecordField, MobileRecordGrid } from "@/components/ui/mobile-record-card"
import { Select } from "@/components/ui/select"
import { paymentMethodLabels } from "@/lib/clients/format"
import type { ClientFilters, ClientListItem } from "@/lib/clients/types"

const paymentOptions = [
  ["all", "Todos los pagos"],
  ["stripe", "Stripe"],
  ["sepa", "SEPA"],
  ["transfer", "Transferencia"],
  ["other", "Otro"],
  ["unknown", "Sin definir"],
]

const activeOptions = [
  ["all", "Todos"],
  ["active", "Activos"],
  ["inactive", "Inactivos"],
]

function stateTone(item: ClientListItem) {
  if (!item.active) {
    return "neutral"
  }

  return "success"
}

function stateLabel(item: ClientListItem) {
  if (!item.active) {
    return "Inactivo"
  }

  return "Activo"
}

export function ClientFiltersBar({ filters }: { filters: ClientFilters }) {
  return (
    <FilterSidebarCard
      title="Filtros"
      description="Afina la cartera por cliente, cobro y estado administrativo."
      contentClassName="space-y-5 pt-5"
    >
      <div className="space-y-3 rounded-[var(--radius-panel)] border border-border/70 bg-[color:var(--surface-2)]/45 p-3.5">
        <Button asChild type="button" className="w-full" variant="secondary">
          <Link href="/clientes">Borrar todo</Link>
        </Button>
        <p className="text-xs leading-5 text-muted-foreground">
          La búsqueda cubre CIF, nombre, contacto, teléfono y correo. Por defecto se muestran solo clientes activos.
        </p>
      </div>

      <form className="space-y-5">
        <SidebarField label="Buscar" htmlFor="clientes-q">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="clientes-q"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="CIF, cliente o contacto"
              className="pl-9"
            />
          </div>
        </SidebarField>

        <SidebarField label="Activo" htmlFor="clientes-active">
          <Select
            id="clientes-active"
            name="active"
            defaultValue={filters.active ?? "all"}
            options={activeOptions.map(([value, label]) => ({ value, label }))}
          />
        </SidebarField>

        <SidebarField label="Pago" htmlFor="clientes-payment">
          <Select
            id="clientes-payment"
            name="payment"
            defaultValue={filters.payment ?? "all"}
            options={paymentOptions.map(([value, label]) => ({ value, label }))}
          />
        </SidebarField>

        <Button type="submit" className="w-full">
          Filtrar
        </Button>
      </form>
    </FilterSidebarCard>
  )
}

export function ClientsTable({ clients }: { clients: ClientListItem[] }) {
  if (clients.length === 0) {
    return (
      <EmptyState
        title="No hay clientes para este filtro."
        description="Crea el primero o relaja la búsqueda para volver a ver cartera."
        actions={
          <Button asChild>
          <Link href="/clientes/nuevo">
            <Plus aria-hidden="true" />
            Nuevo cliente
          </Link>
          </Button>
        }
      />
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Listado operativo</CardTitle>
        <CardDescription>Vista compacta para localizar cliente, estado de cobro y soporte documental.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-3 sm:hidden">
          {clients.map((client) => (
            <MobileRecordCard
              key={`mobile-${client.id}`}
              eyebrow={client.tax_id}
              title={client.name}
              subtitle={paymentMethodLabels[client.payment_method]}
              headerSlot={<ClientStatusBadge client={client} />}
              footer={
                <MobileRecordActions>
                  <Button asChild type="button" variant="outline" size="sm" className="w-full justify-center">
                    <Link href={`/clientes/${client.id}`}>Abrir</Link>
                  </Button>
                </MobileRecordActions>
              }
            >
              <MobileRecordGrid className="grid-cols-2">
                <MobileRecordField label="Contacto" value={client.contact_name ?? "-"} />
                <MobileRecordField label="Teléfono" value={client.contact_phone ?? "-"} />
                <MobileRecordField
                  label="Email"
                  value={client.contact_email ?? client.billing_email ?? "-"}
                  className="col-span-2"
                />
                <MobileRecordField label="Docs" value={String(client.document_count)} />
                <MobileRecordField label="Historial" value={String(client.history_count)} />
              </MobileRecordGrid>
            </MobileRecordCard>
          ))}
        </div>

        <div className="hidden overflow-x-auto sm:block">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Cliente</th>
                <th className="px-4 py-3 text-left font-medium">Pago</th>
                <th className="px-4 py-3 text-left font-medium">Contacto</th>
                <th className="px-4 py-3 text-left font-medium">Teléfono</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Estado</th>
                <th className="px-4 py-3 text-center font-medium">Docs</th>
                <th className="px-4 py-3 text-center font-medium">Hist.</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-t border-border/80">
                  <td className="px-4 py-4 align-top">
                    <Link href={`/clientes/${client.id}`} className="block text-foreground no-underline">
                      <span className="block font-semibold">{client.name}</span>
                      <span className="mt-1 block text-[0.72rem] uppercase tracking-[0.16em] text-muted-foreground">{client.tax_id}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-4 align-top text-foreground/80">{paymentMethodLabels[client.payment_method]}</td>
                  <td className="px-4 py-4 align-top text-foreground/80">{client.contact_name ?? "-"}</td>
                  <td className="px-4 py-4 align-top text-foreground/80">
                    {client.contact_phone ? (
                      <span className="inline-flex items-center gap-2">
                        <Phone className="size-3 text-primary" aria-hidden="true" />
                        {client.contact_phone}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-4 align-top text-foreground/80">
                    {client.contact_email ?? client.billing_email ? (
                      <span className="inline-flex max-w-[260px] items-center gap-2 truncate">
                        <Mail className="size-3 shrink-0 text-primary" aria-hidden="true" />
                        <span className="truncate">{client.contact_email ?? client.billing_email}</span>
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <ClientStatusBadge client={client} />
                  </td>
                  <td className="px-4 py-4 text-center align-top text-foreground/80">
                    <span className="inline-flex items-center gap-1">
                      <FileText className="size-3 text-primary" aria-hidden="true" />
                      {client.document_count}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center align-top text-foreground/80">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="size-3 text-primary" aria-hidden="true" />
                      {client.history_count}
                    </span>
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

function ClientStatusBadge({ client }: { client: ClientListItem }) {
  return <Badge tone={stateTone(client)}>{stateLabel(client)}</Badge>
}
