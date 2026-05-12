import { Badge } from "@/components/ui/badge"
import { DetailField, DetailFieldGrid, DetailTextBlock } from "@/components/detail-fields"
import { FormSection } from "@/components/ui/form-section"
import { formatDate, paymentMethodLabels } from "@/lib/clients/format"
import type { ClientRecord } from "@/lib/clients/types"

export function ClientFichaReadOnly({ client }: { client: ClientRecord }) {
  return (
    <div className="grid gap-6">
      <FormSection
        action={<Badge tone={client.active ? "success" : "neutral"}>{client.active ? "Vigente" : "Histórico"}</Badge>}
        className="border-l-4 border-l-primary"
        title="Estado actual"
      >
        <DetailFieldGrid>
          <DetailField label="Cliente" value={client.name} />
          <DetailField label="CIF" value={client.tax_id} />
          <DetailField
            label="Estado"
            value={<Badge tone={client.active ? "success" : "neutral"}>{client.active ? "Activo" : "Inactivo"}</Badge>}
          />
          <DetailField label="Fecha de inicio" value={formatDate(client.start_date)} />
          <DetailField label="Calificación" value={client.customer_rating ?? "-"} />
          <DetailField label="Método de pago" value={paymentMethodLabels[client.payment_method]} />
        </DetailFieldGrid>
      </FormSection>

      <FormSection
        className="border-l-4 border-l-primary/55"
        title="Contacto y cobro"
      >
        <DetailFieldGrid>
          <DetailField label="Nombre de contacto" value={client.contact_name} />
          <DetailField label="Teléfono" value={client.contact_phone} />
          <DetailField label="Correo de contacto" value={client.contact_email} />
          <DetailField label="Correo de cobro" value={client.billing_email} />
          <DetailField className="md:col-span-2 xl:col-span-3" label="Dirección" value={client.address} />
        </DetailFieldGrid>
      </FormSection>

      <FormSection
        action={<Badge tone="info">Administrativo</Badge>}
        className="border-l-4 border-l-primary/35"
        title="Referencias de pago"
      >
        <DetailFieldGrid>
          <DetailField label="Referencia Stripe" value={client.stripe_reference} />
          <DetailField label="Referencia SEPA" value={client.sepa_reference} />
          <DetailField label="Notas de pago" value={client.payment_notes} />
        </DetailFieldGrid>
      </FormSection>

      <FormSection className="border-l-4 border-l-primary/20" title="Observaciones">
        <DetailTextBlock label="Notas internas" value={client.comments} />
      </FormSection>
    </div>
  )
}
