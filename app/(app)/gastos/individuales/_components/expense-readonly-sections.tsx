import { Trash2 } from "lucide-react"

import { deleteExpenseIndividualAction } from "@/app/(app)/gastos/individuales/actions"
import { DetailField, DetailFieldGrid, DetailTextBlock } from "@/components/detail-fields"
import { Badge } from "@/components/ui/badge"
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button"
import { FormSection } from "@/components/ui/form-section"
import {
  expensePaymentMethodLabels,
  formatExpenseAmount,
  formatExpenseDate,
} from "@/lib/expenses/format"
import type { ExpenseIndividualRecord } from "@/lib/expenses/types"

export function ExpenseFichaReadOnly({ expense }: { expense: ExpenseIndividualRecord }) {
  return (
    <div className="grid gap-6">
      <FormSection
        action={<Badge tone="info">{expensePaymentMethodLabels[expense.payment_method]}</Badge>}
        className="border-l-4 border-l-primary"
        title="Factura y proveedor"
      >
        <DetailFieldGrid>
          <DetailField label="Titulo" value={expense.title} />
          <DetailField label="Factura" value={expense.invoice_number} />
          <DetailField label="Proveedor" value={expense.supplier_name} />
          <DetailField label="CIF" value={expense.supplier_tax_id} />
          <DetailField label="Fecha" value={formatExpenseDate(expense.expense_date)} />
        </DetailFieldGrid>
      </FormSection>

      <FormSection
        action={<Badge tone={expense.legacy_has_attachment ? "warning" : "neutral"}>{expense.legacy_has_attachment ? "Adjunto pendiente" : "Sin adjunto"}</Badge>}
        className="border-l-4 border-l-primary/55"
        title="Importes"
      >
        <DetailFieldGrid>
          <DetailField label="Base" value={expense.net_amount == null ? "-" : formatExpenseAmount(expense.net_amount)} />
          <DetailField label="IVA" value={`${expense.vat_rate} %`} />
          <DetailField label="Total" value={formatExpenseAmount(expense.total_amount)} />
          <DetailField label="Metodo de pago" value={expensePaymentMethodLabels[expense.payment_method]} />
        </DetailFieldGrid>
      </FormSection>

      <FormSection className="border-l-4 border-l-primary/20" title="Observaciones">
        <DetailTextBlock label="Notas internas" value={expense.notes} />
      </FormSection>
    </div>
  )
}

export function ExpenseAdminReadOnly({ expense }: { expense: ExpenseIndividualRecord }) {
  return (
    <div className="grid gap-6">
      <FormSection
        className="border-l-4 border-l-red-300"
        title="Eliminacion"
        description="Borra el gasto y sus documentos locales si ya no debe existir en el maestro operativo."
      >
        <form action={deleteExpenseIndividualAction}>
          <input type="hidden" name="expense_id" value={expense.id} />
          <ConfirmSubmitButton
            variant="destructive"
            title="Eliminar gasto"
            description={`Vas a eliminar ${expense.invoice_number}. Esta accion no se puede deshacer desde la app.`}
            confirmLabel="Confirma solo si ya no debe existir en el maestro local."
          >
            <Trash2 aria-hidden="true" />
            Eliminar gasto
          </ConfirmSubmitButton>
        </form>
      </FormSection>
    </div>
  )
}
