import Link from "next/link"
import { ArrowLeft, Building2, Database, Save } from "lucide-react"

import { SupplierForm } from "@/app/(app)/proveedores/_components/supplier-form"
import { ResourceEditScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"
import { requireSupplierUser } from "@/lib/suppliers/data"

export default async function NewSupplierPage() {
  await requireSupplierUser(undefined, "/proveedores/nuevo")

  return (
    <ResourceEditScreen
      header={{
        icon: <Building2 className="size-6" aria-hidden="true" />,
        title: "Nuevo proveedor",
        subtitle: "Alta manual en el maestro local de proveedores.",
        actions: (
          <Button asChild variant="outline">
            <Link href="/proveedores">
              <ArrowLeft aria-hidden="true" />
              Volver
            </Link>
          </Button>
        ),
      }}
      metrics={[
        { label: "Estado inicial", value: "Activo", tone: "success" },
        { label: "Origen", value: "Manual", icon: <Database className="size-4" aria-hidden="true" /> },
        { label: "Pago", value: "Sin definir" },
        { label: "Guardado", value: "Ficha local", icon: <Save className="size-4" aria-hidden="true" /> },
      ]}
    >
      <SupplierForm />
    </ResourceEditScreen>
  )
}
