import { Trash2 } from "lucide-react"

import { deleteSupplierAction } from "@/app/(app)/proveedores/actions"
import { DetailField, DetailFieldGrid, DetailTextBlock } from "@/components/detail-fields"
import { Badge } from "@/components/ui/badge"
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button"
import { FormSection } from "@/components/ui/form-section"
import { formatDateTime } from "@/lib/utils"
import { formatSupplierDate, supplierOriginLabel, supplierPaymentMethodLabels } from "@/lib/suppliers/format"
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
          <DetailField label="Fecha de inicio" value={formatSupplierDate(supplier.start_date)} />
          <DetailField label="Método de pago" value={supplierPaymentMethodLabels[supplier.payment_method]} />
          <DetailField label="Origen" value={supplierOriginLabel(supplier)} />
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

export function SupplierTraceReadOnly({ supplier }: { supplier: SupplierRecord }) {
  return (
    <div className="grid gap-6">
      <FormSection
        action={<Badge tone={supplier.sharepoint_item_id ? "info" : "neutral"}>{supplierOriginLabel(supplier)}</Badge>}
        className="border-l-4 border-l-primary/45"
        title="Origen del registro"
      >
        <DetailFieldGrid>
          <DetailField label="SharePoint site" value={supplier.sharepoint_site_id} />
          <DetailField label="SharePoint list" value={supplier.sharepoint_list_id} />
          <DetailField label="SharePoint item" value={supplier.sharepoint_item_id} />
          <DetailField label="SharePoint unique id" value={supplier.sharepoint_unique_id} />
          <DetailField label="SharePoint etag" value={supplier.sharepoint_etag} />
          <DetailField label="Importado" value={supplier.imported_at ? formatDateTime(supplier.imported_at) : "-"} />
          <DetailField label="Creado" value={formatDateTime(supplier.created_at)} />
          <DetailField label="Actualizado" value={formatDateTime(supplier.updated_at)} />
        </DetailFieldGrid>
      </FormSection>

      <FormSection
        className="border-l-4 border-l-red-300"
        title="Eliminación"
        description="Borra el proveedor de la base local. No modifica la lista SharePoint de origen."
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
