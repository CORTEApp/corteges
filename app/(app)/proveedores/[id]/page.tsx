import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Building2, CalendarDays, Database, Pencil, UserRound } from "lucide-react"

import { SupplierFichaReadOnly, SupplierTraceReadOnly } from "@/app/(app)/proveedores/_components/supplier-readonly-sections"
import { ResourceContentTabs } from "@/components/resource-content-tabs"
import { ResourceDetailScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"
import { FormSectionTabPanel } from "@/components/ui/form-section-tabs"
import { formatSupplierDate, supplierOriginLabel, supplierPaymentMethodLabels } from "@/lib/suppliers/format"
import { getSupplierDetail } from "@/lib/suppliers/data"

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const detail = await getSupplierDetail(id)

  if (!detail) {
    notFound()
  }

  const { supplier } = detail

  return (
    <ResourceDetailScreen
      header={{
        icon: <Building2 className="size-6" aria-hidden="true" />,
        title: supplier.name,
        subtitle: `${supplier.tax_id} · ficha operativa del proveedor`,
        actions: (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/proveedores">
                <ArrowLeft aria-hidden="true" />
                Volver
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/proveedores/${supplier.id}/edit`}>
                <Pencil aria-hidden="true" />
                Editar
              </Link>
            </Button>
          </div>
        ),
      }}
      metrics={[
        { label: "Estado", value: supplier.active ? "Activo" : "Inactivo", tone: supplier.active ? "success" : "neutral" },
        { label: "Pago", value: supplierPaymentMethodLabels[supplier.payment_method] },
        { label: "Inicio", value: formatSupplierDate(supplier.start_date), icon: <CalendarDays className="size-4" aria-hidden="true" /> },
        { label: "Origen", value: supplierOriginLabel(supplier), icon: <Database className="size-4" aria-hidden="true" /> },
      ]}
    >
      <ResourceContentTabs
        defaultTab="ficha"
        tabs={[
          { id: "ficha", label: "Ficha", icon: <UserRound className="size-4" aria-hidden="true" /> },
          { id: "origen", label: "Origen", icon: <Database className="size-4" aria-hidden="true" /> },
        ]}
      >
        <FormSectionTabPanel tabId="ficha">
          <SupplierFichaReadOnly supplier={supplier} />
        </FormSectionTabPanel>

        <FormSectionTabPanel tabId="origen">
          <SupplierTraceReadOnly supplier={supplier} />
        </FormSectionTabPanel>
      </ResourceContentTabs>
    </ResourceDetailScreen>
  )
}
