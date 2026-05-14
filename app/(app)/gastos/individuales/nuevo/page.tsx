import Link from "next/link"
import { ArrowLeft, Building2, ReceiptText, Save } from "lucide-react"

import { ExpenseIndividualForm } from "@/app/(app)/gastos/individuales/_components/expense-form"
import { ResourceEditScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"
import { listExpenseSupplierOptions } from "@/lib/expenses/data"

const EXPENSE_FORM_ID = "expense-individual-create-form"

export default async function NewExpenseIndividualPage() {
  const suppliers = await listExpenseSupplierOptions()

  return (
    <ResourceEditScreen
      header={{
        icon: <ReceiptText className="size-6" aria-hidden="true" />,
        title: "Nuevo gasto individual",
        subtitle: "Alta manual con proveedor obligatorio y calculo automatico del total.",
        actions: (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/gastos/individuales">
                <ArrowLeft aria-hidden="true" />
                Volver
              </Link>
            </Button>
            <Button type="submit" form={EXPENSE_FORM_ID}>
              <Save aria-hidden="true" />
              Guardar gasto
            </Button>
          </div>
        ),
      }}
      metrics={[
        { label: "Proveedores", value: String(suppliers.length), icon: <Building2 className="size-4" aria-hidden="true" /> },
        { label: "Documento", value: "Tras guardar", description: "La subida se habilita en edicion" },
      ]}
    >
      <ExpenseIndividualForm actionsPlacement="page" formId={EXPENSE_FORM_ID} suppliers={suppliers} />
    </ResourceEditScreen>
  )
}
