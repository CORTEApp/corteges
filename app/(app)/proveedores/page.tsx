import Link from "next/link"
import { Building2, CreditCard, Landmark, Plus } from "lucide-react"

import { SupplierFiltersBar, SuppliersTable } from "@/app/(app)/proveedores/_components/supplier-list"
import { ResourceListScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"
import { FILTERS_LAYOUT_CLASS } from "@/components/ui/filter-sidebar-card"
import { listSuppliers } from "@/lib/suppliers/data"
import type { SupplierFilters } from "@/lib/suppliers/types"

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function ProveedoresPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const filters: SupplierFilters = {
    q: one(params.q),
    active: one(params.active) ?? "active",
    payment: one(params.payment) ?? "all",
  }
  const { suppliers } = await listSuppliers(filters)
  const activeCount = suppliers.filter((supplier) => supplier.active).length
  const sepaCount = suppliers.filter((supplier) => supplier.payment_method === "sepa").length
  const stripeCount = suppliers.filter((supplier) => supplier.payment_method === "stripe").length

  return (
    <ResourceListScreen
      header={{
        icon: <Building2 className="size-6" aria-hidden="true" />,
        title: "Proveedores",
        subtitle: "Maestro operativo para contactos y pagos de proveedores.",
        actions: (
          <Button asChild>
            <Link href="/proveedores/nuevo">
              <Plus aria-hidden="true" />
              Nuevo proveedor
            </Link>
          </Button>
        ),
      }}
      metrics={[
        { label: "Proveedores", value: String(suppliers.length), description: "Resultado del filtro actual", icon: <Building2 className="size-4" aria-hidden="true" /> },
        { label: "Activos", value: String(activeCount), tone: "success" },
        { label: "SEPA", value: String(sepaCount), icon: <Landmark className="size-4" aria-hidden="true" /> },
        { label: "Stripe", value: String(stripeCount), icon: <CreditCard className="size-4" aria-hidden="true" /> },
      ]}
    >
      <div className={FILTERS_LAYOUT_CLASS}>
        <SupplierFiltersBar filters={filters} />
        <div className="space-y-6">
          <SuppliersTable suppliers={suppliers} />
        </div>
      </div>
    </ResourceListScreen>
  )
}
