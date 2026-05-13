import { finishSubscriptionAction } from "@/app/(app)/facturacion/suscripciones/actions"
import { DetailField, DetailFieldGrid, DetailTextBlock } from "@/components/detail-fields"
import { FormSection } from "@/components/ui/form-section"
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button"
import {
  formatAmount,
  formatDate,
  subscriptionStatusLabel,
  subscriptionStatusTone,
  subscriptionStatusValue,
} from "@/lib/billing/format"
import type { BillingSubscription } from "@/lib/billing/types"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function SubscriptionFichaReadOnly({ subscription }: { subscription: BillingSubscription }) {
  const status = subscriptionStatusValue(subscription)

  return (
    <div className="grid gap-6">
      <FormSection
        title="Ficha"
        description="Lectura de la recurrencia comercial sin edicion inline."
        action={<Badge tone={subscriptionStatusTone(status)}>{subscriptionStatusLabel(status)}</Badge>}
      >
        <DetailFieldGrid>
          <DetailField label="Cliente" value={subscription.client_name} />
          <DetailField label="CIF" value={subscription.client_tax_id ?? "-"} />
          <DetailField label="Correo" value={subscription.billing_email ?? "-"} />
          <DetailField label="Codigo" value={subscription.subscription_code} />
          <DetailField label="Inicio" value={formatDate(subscription.start_date)} />
          <DetailField label="Fin" value={formatDate(subscription.end_date)} />
          <DetailField label="Cantidad" value={formatAmount(subscription.quantity)} />
          <DetailField label="Total recurrente" value={`${formatAmount(subscription.recurring_total_amount)} €`} />
          <DetailField label="IVA" value={subscription.apply_vat ? `${formatAmount(subscription.vat_rate)}%` : "No aplica"} />
          <DetailField label="Moneda" value={subscription.currency} />
        </DetailFieldGrid>
      </FormSection>

      <FormSection title="Descripcion">
        <DetailTextBlock label="Concepto recurrente" value={subscription.description} />
      </FormSection>
    </div>
  )
}

export function SubscriptionTraceReadOnly({ subscription }: { subscription: BillingSubscription }) {
  const status = subscriptionStatusValue(subscription)
  const isFinished = status === "history"

  return (
    <div className="grid gap-6">
      <FormSection
        title="Trazabilidad"
        description="Referencia al origen SharePoint cuando el registro procede de la lista Suscripciones."
      >
        <DetailFieldGrid>
          <DetailField label="SharePoint list" value={subscription.sharepoint_list_id ?? "-"} />
          <DetailField label="SharePoint item" value={subscription.sharepoint_item_id ?? "-"} />
          <DetailField label="Importado" value={subscription.imported_at ? new Date(subscription.imported_at).toLocaleString("es-ES") : "-"} />
          <DetailField label="Creado" value={new Date(subscription.created_at).toLocaleString("es-ES")} />
          <DetailField label="Actualizado" value={new Date(subscription.updated_at).toLocaleString("es-ES")} />
        </DetailFieldGrid>
      </FormSection>

      <FormSection
        title="Administracion"
        description="La baja se guarda con fecha fin; no se elimina la suscripcion ni su historico."
      >
        <form action={finishSubscriptionAction} className="grid gap-4 rounded-[var(--radius-panel)] border border-border/70 bg-[color:var(--surface-2)]/60 px-4 py-4 md:grid-cols-[minmax(0,1fr)_12rem_auto] md:items-end">
          <input type="hidden" name="subscription_id" value={subscription.id} />
          <div>
            <div className="text-sm font-semibold text-foreground">Finalizar suscripcion</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              El registro seguira disponible en el filtro de finalizadas y mantendra su trazabilidad.
            </p>
          </div>
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Fecha fin</span>
            <Input name="end_date" type="date" defaultValue={subscription.end_date ?? todayISO()} disabled={isFinished} />
          </label>
          <ConfirmSubmitButton
            variant="destructive"
            disabled={isFinished}
            title="Finalizar suscripcion"
            description={`Vas a finalizar ${subscription.subscription_code} para ${subscription.client_name}. No se borrara de la base de datos.`}
            pendingLabel="Finalizando..."
          >
            Finalizar
          </ConfirmSubmitButton>
        </form>
      </FormSection>
    </div>
  )
}
