import { Trash2 } from "lucide-react"

import { deleteExpenseIndividualAction } from "@/app/(app)/gastos/individuales/actions"
import { DetailField, DetailFieldGrid, DetailTextBlock } from "@/components/detail-fields"
import { Badge } from "@/components/ui/badge"
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button"
import { FormSection } from "@/components/ui/form-section"
import {
  expenseOriginLabel,
  expensePaymentMethodLabels,
  formatExpenseAmount,
  formatExpenseDate,
} from "@/lib/expenses/format"
import type { ExpenseIndividualRecord } from "@/lib/expenses/types"
import { formatDateTime } from "@/lib/utils"

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
          <DetailField label="Origen" value={expenseOriginLabel(expense)} />
        </DetailFieldGrid>
      </FormSection>

      <FormSection
        action={<Badge tone={expense.legacy_has_attachment ? "warning" : "neutral"}>{expense.legacy_has_attachment ? "Adjunto historico" : "Sin adjunto historico"}</Badge>}
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

export function ExpenseTraceReadOnly({ expense }: { expense: ExpenseIndividualRecord }) {
  return (
    <div className="grid gap-6">
      <FormSection
        action={<Badge tone={expense.sharepoint_item_id ? "info" : "neutral"}>{expenseOriginLabel(expense)}</Badge>}
        className="border-l-4 border-l-primary/45"
        title="Origen del registro"
      >
        <DetailFieldGrid>
          <DetailField label="SharePoint site" value={expense.sharepoint_site_id} />
          <DetailField label="SharePoint list" value={expense.sharepoint_list_id} />
          <DetailField label="SharePoint item" value={expense.sharepoint_item_id} />
          <DetailField label="SharePoint unique id" value={expense.sharepoint_unique_id} />
          <DetailField label="SharePoint etag" value={expense.sharepoint_etag} />
          <DetailField label="Importado" value={expense.imported_at ? formatDateTime(expense.imported_at) : "-"} />
          <DetailField label="Creado" value={formatDateTime(expense.created_at)} />
          <DetailField label="Actualizado" value={formatDateTime(expense.updated_at)} />
        </DetailFieldGrid>
      </FormSection>

      <FormSection
        className="border-l-4 border-l-red-300"
        title="Eliminacion"
        description="Borra el gasto y sus documentos locales. No modifica la lista SharePoint de origen."
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
