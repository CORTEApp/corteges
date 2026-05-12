import Link from "next/link"
import { ArrowRight, PackagePlus, Search, Tag } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { FilterSidebarCard } from "@/components/ui/filter-sidebar-card"
import { Input } from "@/components/ui/input"
import { MobileRecordActions, MobileRecordCard, MobileRecordField, MobileRecordGrid } from "@/components/ui/mobile-record-card"
import { Select } from "@/components/ui/select"
import {
  facturableStateLabel,
  facturableStateTone,
  formatAmount,
} from "@/lib/billing/format"
import {
  BILLING_FACTURABLE_TYPES,
  BILLING_FACTURABLE_UNITS,
  type BillingFacturable,
  type BillingFacturableFilters,
} from "@/lib/billing/types"

const activeOptions = [
  ["all", "Todos"],
  ["active", "Activos"],
  ["inactive", "Inactivos"],
]

const currentOptions = [
  ["all", "Todos"],
  ["current", "Vigentes"],
  ["history", "Históricos"],
]

export function FacturableFiltersBar({ filters }: { filters: BillingFacturableFilters }) {
  return (
    <FilterSidebarCard
      title="Filtros"
      description="Localiza conceptos por denominación, descripción, tipo, estado y unidad."
      contentClassName="space-y-5 pt-5"
    >
      <div className="space-y-3 rounded-[var(--radius-panel)] border border-border/70 bg-[color:var(--surface-2)]/45 p-3.5">
        <Button asChild type="button" className="w-full" variant="secondary">
          <Link href="/facturacion/facturables">Borrar todo</Link>
        </Button>
        <p className="text-xs leading-5 text-muted-foreground">
          Por defecto se muestra catálogo activo y vigente. Los históricos quedan disponibles para consulta.
        </p>
      </div>

      <form className="space-y-5">
        <SidebarField label="Buscar" htmlFor="facturables-q">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="facturables-q"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="A-001, licencia, RPA..."
              className="pl-9"
            />
          </div>
        </SidebarField>

        <SidebarField label="Activo" htmlFor="facturables-active">
          <Select
            id="facturables-active"
            name="active"
            defaultValue={filters.active ?? "active"}
            options={activeOptions.map(([value, label]) => ({ value, label }))}
          />
        </SidebarField>

        <SidebarField label="Vigencia" htmlFor="facturables-current">
          <Select
            id="facturables-current"
            name="current"
            defaultValue={filters.current ?? "current"}
            options={currentOptions.map(([value, label]) => ({ value, label }))}
          />
        </SidebarField>

        <SidebarField label="Tipo" htmlFor="facturables-type">
          <Select
            id="facturables-type"
            name="type"
            defaultValue={filters.type ?? "all"}
            options={[
              { value: "all", label: "Todos los tipos" },
              ...BILLING_FACTURABLE_TYPES.map((value) => ({ value, label: value })),
            ]}
          />
        </SidebarField>

        <SidebarField label="Unidad" htmlFor="facturables-unit-type">
          <Select
            id="facturables-unit-type"
            name="unitType"
            defaultValue={filters.unitType ?? "all"}
            options={[
              { value: "all", label: "Todas las unidades" },
              ...BILLING_FACTURABLE_UNITS.map((value) => ({ value, label: value })),
            ]}
          />
        </SidebarField>

        <Button type="submit" className="w-full">
          Filtrar
        </Button>
      </form>
    </FilterSidebarCard>
  )
}

export function FacturablesTable({ facturables }: { facturables: BillingFacturable[] }) {
  if (facturables.length === 0) {
    return (
      <EmptyState
        title="No hay facturables para este filtro."
        description="Crea el primero o relaja los filtros para volver a ver catálogo."
        actions={
          <Button asChild>
            <Link href="/facturacion/facturables/nuevo">
              <PackagePlus aria-hidden="true" />
              Nuevo facturable
            </Link>
          </Button>
        }
      />
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Catálogo facturable</CardTitle>
        <CardDescription>Conceptos que podrán alimentar presupuestos y facturación cuando esos módulos entren.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-3 lg:hidden">
          {facturables.map((facturable) => (
            <MobileRecordCard
              key={`mobile-${facturable.id}`}
              eyebrow={facturable.code}
              title={facturable.description}
              subtitle={facturable.type}
              headerSlot={<FacturableStatusBadge facturable={facturable} />}
              footer={
                <MobileRecordActions>
                  <Button asChild type="button" variant="outline" size="sm" className="w-full justify-center">
                    <Link href={`/facturacion/facturables/${facturable.id}`}>Abrir</Link>
                  </Button>
                </MobileRecordActions>
              }
            >
              <MobileRecordGrid className="grid-cols-2">
                <MobileRecordField label="Precio" value={formatAmount(facturable.unit_price)} />
                <MobileRecordField label="Unidad" value={facturable.unit_type} />
              </MobileRecordGrid>
            </MobileRecordCard>
          ))}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Denominación</th>
                <th className="px-4 py-3 text-left font-medium">Descripción</th>
                <th className="px-4 py-3 text-left font-medium">Tipo</th>
                <th className="px-4 py-3 text-right font-medium">Precio</th>
                <th className="px-4 py-3 text-left font-medium">Unidad</th>
                <th className="px-4 py-3 text-left font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Ficha</th>
              </tr>
            </thead>
            <tbody>
              {facturables.map((facturable) => (
                <tr key={facturable.id} className="border-t border-border/80">
                  <td className="px-4 py-4 align-top">
                    <Link
                      href={`/facturacion/facturables/${facturable.id}`}
                      className="font-semibold text-foreground no-underline"
                    >
                      {facturable.code}
                    </Link>
                  </td>
                  <td className="max-w-[32rem] px-4 py-4 align-top text-foreground/85">
                    <span className="line-clamp-2">{facturable.description}</span>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <span className="inline-flex items-center gap-2">
                      <Tag className="size-3 text-primary" aria-hidden="true" />
                      {facturable.type}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right align-top text-foreground/85">{formatAmount(facturable.unit_price)}</td>
                  <td className="px-4 py-4 align-top text-foreground/85">{facturable.unit_type}</td>
                  <td className="px-4 py-4 align-top">
                    <FacturableStatusBadge facturable={facturable} />
                  </td>
                  <td className="px-4 py-4 text-right align-top">
                    <Button asChild size="icon-sm" variant="ghost" aria-label={`Abrir ${facturable.code}`}>
                      <Link href={`/facturacion/facturables/${facturable.id}`}>
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

function FacturableStatusBadge({ facturable }: { facturable: BillingFacturable }) {
  return <Badge tone={facturableStateTone(facturable)}>{facturableStateLabel(facturable)}</Badge>
}
