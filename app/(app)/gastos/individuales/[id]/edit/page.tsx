import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CalendarDays, ReceiptText, Save } from "lucide-react"

import { ExpenseDocumentSection } from "@/app/(app)/gastos/individuales/_components/expense-document-section"
import { ExpenseIndividualForm } from "@/app/(app)/gastos/individuales/_components/expense-form"
import { ExpenseAdminReadOnly } from "@/app/(app)/gastos/individuales/_components/expense-readonly-sections"
import { ResourceEditScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"
import {
  expensePaymentMethodLabels,
  formatExpenseAmountCompact,
  formatExpenseDate,
} from "@/lib/expenses/format"
import { getExpenseIndividualDetail, listExpenseSupplierOptions } from "@/lib/expenses/data"

export default async function EditExpenseIndividualPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [detail, suppliers] = await Promise.all([
    getExpenseIndividualDetail(id),
    listExpenseSupplierOptions(),
  ])

  if (!detail) {
    notFound()
  }

  const { expense, documents } = detail

  return (
    <ResourceEditScreen
      header={{
        icon: <ReceiptText className="size-6" aria-hidden="true" />,
        title: `Editar ${expense.invoice_number}`,
        subtitle: "Cambios separados de la ficha de lectura del gasto.",
        actions: (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/gastos/individuales/${expense.id}`}>
                <ArrowLeft aria-hidden="true" />
                Volver a ficha
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/gastos/individuales">Listado</Link>
            </Button>
          </div>
        ),
      }}
      metrics={[
        { label: "Total", value: formatExpenseAmountCompact(expense.total_amount), tone: "success" },
        { label: "Pago", value: expensePaymentMethodLabels[expense.payment_method] },
        { label: "Fecha", value: formatExpenseDate(expense.expense_date), icon: <CalendarDays className="size-4" aria-hidden="true" /> },
        { label: "Guardado", value: "Ficha local", icon: <Save className="size-4" aria-hidden="true" /> },
      ]}
    >
      <div className="grid gap-6">
        <ExpenseIndividualForm
          formId={`expense-individual-edit-form-${expense.id}`}
          expense={expense}
          suppliers={suppliers}
        />
        <ExpenseDocumentSection
          expenseId={expense.id}
          documents={documents}
          legacyHasAttachment={expense.legacy_has_attachment}
        />
        <ExpenseAdminReadOnly expense={expense} />
      </div>
    </ResourceEditScreen>
  )
}
