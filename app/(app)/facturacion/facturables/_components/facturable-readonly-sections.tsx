import { Badge } from "@/components/ui/badge"
import { DetailField, DetailFieldGrid, DetailTextBlock } from "@/components/detail-fields"
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button"
import { FormSection } from "@/components/ui/form-section"
import { deactivateFacturableAction } from "@/app/(app)/facturacion/facturables/actions"
import {
  facturableStateLabel,
  facturableStateTone,
  formatAmount,
} from "@/lib/billing/format"
import type { BillingFacturable } from "@/lib/billing/types"

export function FacturableFichaReadOnly({ facturable }: { facturable: BillingFacturable }) {
  return (
    <div className="grid gap-6">
      <FormSection
        title="Ficha"
        description="Lectura del concepto facturable sin edición inline."
        action={<Badge tone={facturableStateTone(facturable)}>{facturableStateLabel(facturable)}</Badge>}
      >
        <DetailFieldGrid>
          <DetailField label="Denominación" value={facturable.code} />
          <DetailField label="Tipo" value={facturable.type} />
          <DetailField label="Unidad" value={facturable.unit_type} />
          <DetailField label="Descripción" value={facturable.description} className="md:col-span-2 xl:col-span-3" />
        </DetailFieldGrid>
      </FormSection>

      <FormSection
        title="Precio"
        description="Importe base del concepto dentro del catálogo."
      >
        <DetailFieldGrid>
          <DetailField label="Precio" value={formatAmount(facturable.unit_price)} />
        </DetailFieldGrid>
      </FormSection>

      <FormSection title="Comentarios">
        <DetailTextBlock label="Notas internas" value={facturable.comments || "Sin comentarios"} />
      </FormSection>

      <FormSection
        title="Administración"
        description="El catálogo no borra físicamente registros: se desactivan para conservar histórico."
      >
        <form action={deactivateFacturableAction} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-panel)] border border-border/70 bg-[color:var(--surface-2)]/60 px-4 py-4">
          <input type="hidden" name="facturable_id" value={facturable.id} />
          <div>
            <div className="text-sm font-semibold text-foreground">Desactivar concepto</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Seguirá visible si filtras inactivos, pero no aparecerá en la vista operativa por defecto.
            </p>
          </div>
          <ConfirmSubmitButton
            variant="destructive"
            disabled={!facturable.active}
            title="Desactivar facturable"
            description={`Vas a desactivar ${facturable.code}. No se borrará de la base de datos.`}
            pendingLabel="Desactivando..."
          >
            Desactivar
          </ConfirmSubmitButton>
        </form>
      </FormSection>
    </div>
  )
}

export function FacturableTraceReadOnly({ facturable }: { facturable: BillingFacturable }) {
  return (
    <div className="grid gap-6">
      <FormSection
        title="Trazabilidad"
        description="Referencia al origen SharePoint cuando el registro viene del catálogo importado."
      >
        <DetailFieldGrid>
          <DetailField label="SharePoint list" value={facturable.sharepoint_list_id ?? "-"} />
          <DetailField label="SharePoint item" value={facturable.sharepoint_item_id ?? "-"} />
          <DetailField label="Importado" value={facturable.imported_at ? new Date(facturable.imported_at).toLocaleString("es-ES") : "-"} />
          <DetailField label="Creado" value={new Date(facturable.created_at).toLocaleString("es-ES")} />
          <DetailField label="Actualizado" value={new Date(facturable.updated_at).toLocaleString("es-ES")} />
        </DetailFieldGrid>
      </FormSection>
    </div>
  )
}
