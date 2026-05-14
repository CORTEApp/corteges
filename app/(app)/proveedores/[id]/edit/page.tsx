import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Building2, CalendarDays, Save } from "lucide-react"

import { SupplierForm } from "@/app/(app)/proveedores/_components/supplier-form"
import { SupplierAdminReadOnly } from "@/app/(app)/proveedores/_components/supplier-readonly-sections"
import { ResourceEditScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"
import { formatSupplierDate, supplierPaymentMethodLabels } from "@/lib/suppliers/format"
import { getSupplierDetail } from "@/lib/suppliers/data"

export default async function EditSupplierPage({
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
  const formId = `supplier-edit-form-${supplier.id}`

  return (
    <ResourceEditScreen
      header={{
        icon: <Building2 className="size-6" aria-hidden="true" />,
        title: `Editar ${supplier.name}`,
        subtitle: "Cambios separados de la ficha de lectura del proveedor.",
        actions: (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/proveedores/${supplier.id}`}>
                <ArrowLeft aria-hidden="true" />
                Volver a ficha
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/proveedores">Listado</Link>
            </Button>
            <Button type="submit" form={formId}>
              <Save aria-hidden="true" />
              Guardar proveedor
            </Button>
          </div>
        ),
      }}
      metrics={[
        { label: "Estado", value: supplier.active ? "Activo" : "Inactivo", tone: supplier.active ? "success" : "neutral" },
        { label: "Pago", value: supplierPaymentMethodLabels[supplier.payment_method] },
        { label: "Inicio", value: formatSupplierDate(supplier.start_date), icon: <CalendarDays className="size-4" aria-hidden="true" /> },
        { label: "Guardado", value: "Ficha local", icon: <Save className="size-4" aria-hidden="true" /> },
      ]}
    >
      <div className="grid gap-6">
        <SupplierForm actionsPlacement="page" formId={formId} supplier={supplier} />
        <SupplierAdminReadOnly supplier={supplier} />
      </div>
    </ResourceEditScreen>
  )
}
