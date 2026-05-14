import { Trash2 } from "lucide-react"

import { deleteSupplierAction } from "@/app/(app)/proveedores/actions"
import { DetailField, DetailFieldGrid, DetailTextBlock } from "@/components/detail-fields"
import { Badge } from "@/components/ui/badge"
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button"
import { FormSection } from "@/components/ui/form-section"
import { formatSupplierDate, supplierPaymentMethodLabels } from "@/lib/suppliers/format"
import type { SupplierRecord } from "@/lib/suppliers/types"

export function SupplierFichaReadOnly({ supplier }: { supplier: SupplierRecord }) {
  return (
    <div className="grid gap-6">
      <FormSection
        action={<Badge tone={supplier.active ? "success" : "neutral"}>{supplier.active ? "Vigente" : "Histórico"}</Badge>}
        className="border-l-4 border-l-primary"
        title="Estado actual"
      >
        <DetailFieldGrid>
          <DetailField label="Proveedor" value={supplier.name} />
          <DetailField label="CIF" value={supplier.tax_id} />
          <DetailField
            label="Estado"
            value={<Badge tone={supplier.active ? "success" : "neutral"}>{supplier.active ? "Activo" : "Inactivo"}</Badge>}
          />
          <DetailField
            label="Aprobación gastos"
            value={
              <Badge tone={supplier.auto_approve_expense_invoices ? "success" : "neutral"}>
                {supplier.auto_approve_expense_invoices ? "Automática" : "Manual"}
              </Badge>
            }
          />
          <DetailField label="Fecha de inicio" value={formatSupplierDate(supplier.start_date)} />
          <DetailField label="Método de pago" value={supplierPaymentMethodLabels[supplier.payment_method]} />
        </DetailFieldGrid>
      </FormSection>

      <FormSection className="border-l-4 border-l-primary/55" title="Contacto">
        <DetailFieldGrid>
          <DetailField label="Nombre de contacto" value={supplier.contact_name} />
          <DetailField label="Teléfono" value={supplier.contact_phone} />
          <DetailField label="Correo de contacto" value={supplier.contact_email} />
        </DetailFieldGrid>
      </FormSection>

      <FormSection
        action={<Badge tone="info">Administrativo</Badge>}
        className="border-l-4 border-l-primary/35"
        title="Referencias de pago"
      >
        <DetailFieldGrid>
          <DetailField label="Referencia SEPA" value={supplier.sepa_reference} />
          <DetailField label="Referencia Stripe" value={supplier.stripe_reference} />
        </DetailFieldGrid>
      </FormSection>

      <FormSection className="border-l-4 border-l-primary/20" title="Observaciones">
        <DetailTextBlock label="Notas internas" value={supplier.comments} />
      </FormSection>
    </div>
  )
}

export function SupplierAdminReadOnly({ supplier }: { supplier: SupplierRecord }) {
  return (
    <div className="grid gap-6">
      <FormSection
        className="border-l-4 border-l-red-300"
        title="Eliminación"
        description="Borra el proveedor de la base local si ya no debe existir en el maestro operativo."
      >
        <form action={deleteSupplierAction}>
          <input type="hidden" name="supplier_id" value={supplier.id} />
          <ConfirmSubmitButton
            variant="destructive"
            title="Eliminar proveedor"
            description={`Vas a eliminar ${supplier.name}. Esta acción no se puede deshacer desde la app.`}
            confirmLabel="Confirma solo si ya no debe existir en el maestro local."
          >
            <Trash2 aria-hidden="true" />
            Eliminar proveedor
          </ConfirmSubmitButton>
        </form>
      </FormSection>
    </div>
  )
}
