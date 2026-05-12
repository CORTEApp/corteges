import type { ReactNode } from "react"
import Link from "next/link"
import { CreditCard, Database, Mail, Phone, Plus, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { FilterSidebarCard } from "@/components/ui/filter-sidebar-card"
import { Input } from "@/components/ui/input"
import { MobileRecordActions, MobileRecordCard, MobileRecordField, MobileRecordGrid } from "@/components/ui/mobile-record-card"
import { Select } from "@/components/ui/select"
import { supplierOriginLabel, supplierPaymentMethodLabels } from "@/lib/suppliers/format"
import type { SupplierFilters, SupplierListItem } from "@/lib/suppliers/types"

const paymentOptions = [
  ["all", "Todos los pagos"],
  ["sepa", "SEPA"],
  ["stripe", "Stripe"],
  ["transfer", "Transferencia"],
  ["other", "Otro"],
  ["unknown", "Sin definir"],
]

const activeOptions = [
  ["all", "Todos"],
  ["active", "Activos"],
  ["inactive", "Inactivos"],
]

function stateTone(item: SupplierListItem) {
  return item.active ? "success" : "neutral"
}

function stateLabel(item: SupplierListItem) {
  return item.active ? "Activo" : "Inactivo"
}

export function SupplierFiltersBar({ filters }: { filters: SupplierFilters }) {
  return (
    <FilterSidebarCard
      title="Filtros"
      description="Afina proveedores por identificador, contacto, pago y vigencia."
      contentClassName="space-y-5 pt-5"
    >
      <div className="space-y-3 rounded-[var(--radius-panel)] border border-border/70 bg-[color:var(--surface-2)]/45 p-3.5">
        <Button asChild type="button" className="w-full" variant="secondary">
          <Link href="/proveedores">Borrar todo</Link>
        </Button>
        <p className="text-xs leading-5 text-muted-foreground">
          La búsqueda cubre CIF, nombre, contacto, teléfono, correo, SEPA y comentarios. Por defecto se muestran solo proveedores activos.
        </p>
      </div>

      <form className="space-y-5">
        <SidebarField label="Buscar" htmlFor="proveedores-q">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="proveedores-q"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="CIF, proveedor o contacto"
              className="pl-9"
            />
          </div>
        </SidebarField>

        <SidebarField label="Activo" htmlFor="proveedores-active">
          <Select
            id="proveedores-active"
            name="active"
            defaultValue={filters.active ?? "all"}
            options={activeOptions.map(([value, label]) => ({ value, label }))}
          />
        </SidebarField>

        <SidebarField label="Pago" htmlFor="proveedores-payment">
          <Select
            id="proveedores-payment"
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

export function SuppliersTable({ suppliers }: { suppliers: SupplierListItem[] }) {
  if (suppliers.length === 0) {
    return (
      <EmptyState
        title="No hay proveedores para este filtro."
        description="Crea el primero o relaja la búsqueda para volver al maestro."
        actions={
          <Button asChild>
            <Link href="/proveedores/nuevo">
              <Plus aria-hidden="true" />
              Nuevo proveedor
            </Link>
          </Button>
        }
      />
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Maestro de proveedores</CardTitle>
        <CardDescription>Vista compacta para localizar proveedor, contacto, forma de pago y origen.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-3 sm:hidden">
          {suppliers.map((supplier) => (
            <MobileRecordCard
              key={`mobile-${supplier.id}`}
              eyebrow={supplier.tax_id}
              title={supplier.name}
              subtitle={supplierPaymentMethodLabels[supplier.payment_method]}
              headerSlot={<SupplierStatusBadge supplier={supplier} />}
              footer={
                <MobileRecordActions>
                  <Button asChild type="button" variant="outline" size="sm" className="w-full justify-center">
                    <Link href={`/proveedores/${supplier.id}`}>Abrir</Link>
                  </Button>
                </MobileRecordActions>
              }
            >
              <MobileRecordGrid className="grid-cols-2">
                <MobileRecordField label="Contacto" value={supplier.contact_name ?? "-"} />
                <MobileRecordField label="Teléfono" value={supplier.contact_phone ?? "-"} />
                <MobileRecordField label="Email" value={supplier.contact_email ?? "-"} className="col-span-2" />
                <MobileRecordField label="Pago" value={supplierPaymentMethodLabels[supplier.payment_method]} />
                <MobileRecordField label="Origen" value={supplierOriginLabel(supplier)} />
              </MobileRecordGrid>
            </MobileRecordCard>
          ))}
        </div>

        <div className="hidden overflow-x-auto sm:block">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Proveedor</th>
                <th className="px-4 py-3 text-left font-medium">Pago</th>
                <th className="px-4 py-3 text-left font-medium">Contacto</th>
                <th className="px-4 py-3 text-left font-medium">Teléfono</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Estado</th>
                <th className="px-4 py-3 text-left font-medium">Origen</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => (
                <tr key={supplier.id} className="border-t border-border/80">
                  <td className="px-4 py-4 align-top">
                    <Link href={`/proveedores/${supplier.id}`} className="block text-foreground no-underline">
                      <span className="block font-semibold">{supplier.name}</span>
                      <span className="mt-1 block text-[0.72rem] uppercase tracking-[0.16em] text-muted-foreground">{supplier.tax_id}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-4 align-top text-foreground/80">
                    <span className="inline-flex items-center gap-2">
                      <CreditCard className="size-3 text-primary" aria-hidden="true" />
                      {supplierPaymentMethodLabels[supplier.payment_method]}
                    </span>
                  </td>
                  <td className="px-4 py-4 align-top text-foreground/80">{supplier.contact_name ?? "-"}</td>
                  <td className="px-4 py-4 align-top text-foreground/80">
                    {supplier.contact_phone ? (
                      <span className="inline-flex items-center gap-2">
                        <Phone className="size-3 text-primary" aria-hidden="true" />
                        {supplier.contact_phone}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-4 align-top text-foreground/80">
                    {supplier.contact_email ? (
                      <span className="inline-flex max-w-[260px] items-center gap-2 truncate">
                        <Mail className="size-3 shrink-0 text-primary" aria-hidden="true" />
                        <span className="truncate">{supplier.contact_email}</span>
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <SupplierStatusBadge supplier={supplier} />
                  </td>
                  <td className="px-4 py-4 align-top text-foreground/80">
                    <span className="inline-flex items-center gap-2">
                      <Database className="size-3 text-primary" aria-hidden="true" />
                      {supplierOriginLabel(supplier)}
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
  children: ReactNode
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

function SupplierStatusBadge({ supplier }: { supplier: SupplierListItem }) {
  return <Badge tone={stateTone(supplier)}>{stateLabel(supplier)}</Badge>
}
