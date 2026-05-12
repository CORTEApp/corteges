import Link from "next/link"
import { ListChecks, PackagePlus, ReceiptText, Tag } from "lucide-react"

import { FacturableFiltersBar, FacturablesTable } from "@/app/(app)/facturacion/facturables/_components/facturable-list"
import { ResourceListScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"
import { FILTERS_LAYOUT_CLASS } from "@/components/ui/filter-sidebar-card"
import { listFacturables } from "@/lib/billing/data"
import type { BillingFacturableFilters } from "@/lib/billing/types"

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function primaryType(items: { type: string }[]) {
  const counts = new Map<string, number>()
  for (const item of items) {
    counts.set(item.type, (counts.get(item.type) ?? 0) + 1)
  }

  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0] ?? ["-", 0]
}

export default async function FacturablesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const filters: BillingFacturableFilters = {
    q: one(params.q),
    active: one(params.active) ?? "active",
    current: one(params.current) ?? "current",
    type: one(params.type) ?? "all",
    unitType: one(params.unitType) ?? "all",
  }
  const { facturables } = await listFacturables(filters)
  const activeCount = facturables.filter((item) => item.active).length
  const currentCount = facturables.filter((item) => item.is_current).length
  const [topType, topTypeCount] = primaryType(facturables)

  return (
    <ResourceListScreen
      header={{
        icon: <ReceiptText className="size-6" aria-hidden="true" />,
        title: "Facturables",
        subtitle: "Catálogo de conceptos facturables. No emite facturas: solo mantiene la base operativa.",
        actions: (
          <Button asChild>
            <Link href="/facturacion/facturables/nuevo">
              <PackagePlus aria-hidden="true" />
              Nuevo facturable
            </Link>
          </Button>
        ),
      }}
      metrics={[
        {
          label: "Visibles",
          value: String(facturables.length),
          description: "Resultado del filtro actual",
          icon: <ListChecks className="size-4" aria-hidden="true" />,
        },
        { label: "Activos", value: String(activeCount), tone: "success" },
        { label: "Vigentes", value: String(currentCount), tone: "info" },
        {
          label: "Tipo principal",
          value: topType,
          description: `${topTypeCount} conceptos`,
          icon: <Tag className="size-4" aria-hidden="true" />,
        },
      ]}
    >
      <div className={FILTERS_LAYOUT_CLASS}>
        <FacturableFiltersBar filters={filters} />
        <div className="space-y-6">
          <FacturablesTable facturables={facturables} />
        </div>
      </div>
    </ResourceListScreen>
  )
}
