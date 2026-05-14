import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CalendarDays, FileText, Pencil, ReceiptText, Settings2, UserRound } from "lucide-react"

import { ExpenseDocumentSection } from "@/app/(app)/gastos/individuales/_components/expense-document-section"
import {
  ExpenseAdminReadOnly,
  ExpenseFichaReadOnly,
} from "@/app/(app)/gastos/individuales/_components/expense-readonly-sections"
import { ResourceContentTabs } from "@/components/resource-content-tabs"
import { ResourceDetailScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"
import { FormSectionTabPanel } from "@/components/ui/form-section-tabs"
import { expensePaymentMethodLabels, formatExpenseAmountCompact, formatExpenseDate } from "@/lib/expenses/format"
import { getExpenseIndividualDetail } from "@/lib/expenses/data"

export default async function ExpenseIndividualDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const detail = await getExpenseIndividualDetail(id)

  if (!detail) {
    notFound()
  }

  const { expense, documents } = detail

  return (
    <ResourceDetailScreen
      header={{
        icon: <ReceiptText className="size-6" aria-hidden="true" />,
        title: expense.title,
        subtitle: `${expense.invoice_number} · ${expense.supplier_name}`,
        actions: (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/gastos/individuales">
                <ArrowLeft aria-hidden="true" />
                Volver
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/gastos/individuales/${expense.id}/edit`}>
                <Pencil aria-hidden="true" />
                Editar
              </Link>
            </Button>
          </div>
        ),
      }}
      metrics={[
        { label: "Total", value: formatExpenseAmountCompact(expense.total_amount), tone: "success" },
        { label: "Pago", value: expensePaymentMethodLabels[expense.payment_method] },
        { label: "Fecha", value: formatExpenseDate(expense.expense_date), icon: <CalendarDays className="size-4" aria-hidden="true" /> },
      ]}
    >
      <ResourceContentTabs
        defaultTab="ficha"
        tabs={[
          { id: "ficha", label: "Ficha", icon: <UserRound className="size-4" aria-hidden="true" /> },
          { id: "documentos", label: "Documentos", icon: <FileText className="size-4" aria-hidden="true" /> },
          { id: "administracion", label: "Administracion", icon: <Settings2 className="size-4" aria-hidden="true" /> },
        ]}
      >
        <FormSectionTabPanel tabId="ficha">
          <ExpenseFichaReadOnly expense={expense} />
        </FormSectionTabPanel>

        <FormSectionTabPanel tabId="documentos">
          <ExpenseDocumentSection
            expenseId={expense.id}
            documents={documents}
            legacyHasAttachment={expense.legacy_has_attachment}
            mode="read"
          />
        </FormSectionTabPanel>

        <FormSectionTabPanel tabId="administracion">
          <ExpenseAdminReadOnly expense={expense} />
        </FormSectionTabPanel>
      </ResourceContentTabs>
    </ResourceDetailScreen>
  )
}
