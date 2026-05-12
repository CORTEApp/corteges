import Link from "next/link"
import { ArrowLeft, Building2, ReceiptText } from "lucide-react"

import { ExpenseIndividualForm } from "@/app/(app)/gastos/individuales/_components/expense-form"
import { ResourceEditScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"
import { listExpenseSupplierOptions } from "@/lib/expenses/data"

export default async function NewExpenseIndividualPage() {
  const suppliers = await listExpenseSupplierOptions()

  return (
    <ResourceEditScreen
      header={{
        icon: <ReceiptText className="size-6" aria-hidden="true" />,
        title: "Nuevo gasto individual",
        subtitle: "Alta manual con proveedor obligatorio y calculo automatico del total.",
        actions: (
          <Button asChild variant="outline">
            <Link href="/gastos/individuales">
              <ArrowLeft aria-hidden="true" />
              Volver
            </Link>
          </Button>
        ),
      }}
      metrics={[
        { label: "Proveedores", value: String(suppliers.length), icon: <Building2 className="size-4" aria-hidden="true" /> },
        { label: "Documento", value: "Tras guardar", description: "La subida se habilita en edicion" },
      ]}
    >
      <ExpenseIndividualForm suppliers={suppliers} />
    </ResourceEditScreen>
  )
}
