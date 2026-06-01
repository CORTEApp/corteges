import { Save } from "lucide-react"

import { FormPendingScreen } from "@/components/ui/form-pending-screen"
import { FormSubmitButton } from "@/components/ui/form-submit-button"
import { saveClientAction } from "@/app/(app)/clientes/actions"
import { paymentMethodLabels } from "@/lib/clients/format"
import type { ClientRecord, PaymentMethod } from "@/lib/clients/types"

import { Field, SectionTitle, SelectField, TextAreaField } from "./form-controls"

const paymentOptions: PaymentMethod[] = ["unknown", "stripe", "sepa", "transfer", "other"]
const sectionClassName =
  "rounded-[var(--radius-shell)] border border-border/80 bg-[color:var(--surface-1)] p-5 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.24)] backdrop-blur-sm"

export function ClientForm({
  client,
  formId = "client-form",
  actionsPlacement = "section",
}: {
  client?: ClientRecord
  formId?: string
  actionsPlacement?: "page" | "section"
}) {
  const pendingLabel = "Guardando cliente..."
  const sectionAction = actionsPlacement === "section"
    ? (
        <FormSubmitButton fullscreenPending={false} pendingLabel={pendingLabel}>
          <Save aria-hidden="true" />
          Guardar cliente
        </FormSubmitButton>
      )
    : null

  return (
    <form id={formId} action={saveClientAction} className="grid gap-8">
      <FormPendingScreen label={pendingLabel} />
      {client ? <input type="hidden" name="client_id" value={client.id} /> : null}

      <section className={sectionClassName}>
        <SectionTitle
          title="Identidad"
          note="Lo mínimo que evita dudas: quién es, cómo se reconoce y si sigue operativo."
          action={sectionAction}
        />
        <div className="mt-5 grid gap-4 md:grid-cols-6">
          <Field
            label="CIF"
            name="tax_id"
            required
            defaultValue={client?.tax_id}
            placeholder="B87724365"
            className="grid gap-2 md:col-span-2"
          />
          <Field
            label="Nombre"
            name="name"
            required
            defaultValue={client?.name}
            placeholder="Dorado Telecom S.L."
            className="grid gap-2 md:col-span-4"
          />
          <Field
            label="Dirección"
            name="address"
            defaultValue={client?.address}
            placeholder="Calle, población, provincia"
            className="grid gap-2 md:col-span-6"
          />
          <Field
            label="Fecha de inicio"
            name="start_date"
            type="date"
            defaultValue={client?.start_date}
            className="grid gap-2 md:col-span-2"
          />
          <Field
            label="Calificación"
            name="customer_rating"
            type="number"
            defaultValue={client?.customer_rating}
            placeholder="0-10"
            className="grid gap-2 md:col-span-2"
          />
          <label className="flex h-full items-end gap-3 rounded-[var(--radius-panel)] border border-input/85 bg-[color:var(--surface-2)] px-4 py-3 md:col-span-2">
            <input
              type="checkbox"
              name="active"
              defaultChecked={client?.active ?? true}
              className="size-4 rounded-[var(--radius-control)] border-input accent-primary"
            />
            <span className="text-sm font-semibold text-foreground">Cliente activo</span>
          </label>
        </div>
      </section>

      <section className={sectionClassName}>
        <SectionTitle
          title="Contacto"
          note="La persona y canales que desbloquean decisiones, incidencias y cobros."
        />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Nombre de contacto" name="contact_name" defaultValue={client?.contact_name} />
          <Field label="Teléfono" name="contact_phone" defaultValue={client?.contact_phone} />
          <Field label="Correo de contacto" name="contact_email" type="email" defaultValue={client?.contact_email} />
          <Field
            label="Correo de cobro"
            name="billing_email"
            type="text"
            inputMode="email"
            defaultValue={client?.billing_email}
            placeholder="cobros@cliente.es; admon@cliente.es"
          />
        </div>
      </section>

      <section className={sectionClassName}>
        <SectionTitle
          title="Cobro y pago"
          note="Estado administrativo del cobro. La integración con pasarelas queda fuera de esta fase."
        />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <SelectField label="Método de pago" name="payment_method" defaultValue={client?.payment_method ?? "unknown"}>
            {paymentOptions.map((option) => (
              <option key={option} value={option}>
                {paymentMethodLabels[option]}
              </option>
            ))}
          </SelectField>
          <Field label="Referencia Stripe" name="stripe_reference" defaultValue={client?.stripe_reference} />
          <Field label="Referencia SEPA" name="sepa_reference" defaultValue={client?.sepa_reference} />
          <Field label="Notas de pago" name="payment_notes" defaultValue={client?.payment_notes} />
        </div>
      </section>

      <section className={sectionClassName}>
        <SectionTitle title="Comentarios" note="Contexto operativo que no cabe en una columna." />
        <div className="mt-5">
          <TextAreaField
            label="Notas internas"
            name="comments"
            defaultValue={client?.comments}
            placeholder="Compromisos, sensibilidad del cliente, incidencias recurrentes..."
          />
        </div>
      </section>

    </form>
  )
}
