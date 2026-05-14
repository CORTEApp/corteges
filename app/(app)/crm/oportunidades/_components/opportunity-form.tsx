import { Save } from "lucide-react"

import { saveOpportunityAction } from "@/app/(app)/crm/oportunidades/actions"
import { SectionTitle } from "@/app/(app)/clientes/_components/form-controls"
import { FormPendingScreen } from "@/components/ui/form-pending-screen"
import { FormSubmitButton } from "@/components/ui/form-submit-button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  dateTimeInputValue,
  opportunityStatusLabels,
  opportunityStatuses,
} from "@/lib/crm/format"
import type { CRMOpportunityRecord } from "@/lib/crm/types"

const sectionClassName =
  "rounded-[var(--radius-shell)] border border-border/80 bg-[color:var(--surface-1)] p-5 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.24)] backdrop-blur-sm"

function nowInputValue() {
  const now = new Date()
  const offsetMs = now.getTimezoneOffset() * 60 * 1000
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16)
}

function numberValue(value: number | null | undefined) {
  return value == null ? "" : String(value)
}

export function OpportunityForm({
  opportunity,
  formId = "opportunity-form",
  actionsPlacement = "section",
}: {
  opportunity?: CRMOpportunityRecord
  formId?: string
  actionsPlacement?: "page" | "section"
}) {
  const pendingLabel = "Guardando..."
  const sectionAction = actionsPlacement === "section"
    ? (
        <FormSubmitButton fullscreenPending={false} pendingLabel={pendingLabel}>
          <Save aria-hidden="true" />
          Guardar oportunidad
        </FormSubmitButton>
      )
    : null

  return (
    <form id={formId} action={saveOpportunityAction} className="grid gap-8">
      <FormPendingScreen label={pendingLabel} />
      {opportunity ? <input type="hidden" name="opportunity_id" value={opportunity.id} /> : null}

      <section className={sectionClassName}>
        <SectionTitle
          title="Identidad"
          note="Empresa, persona de contacto y trazas comerciales basicas."
          action={sectionAction}
        />
        <div className="mt-5 grid gap-4 md:grid-cols-6">
          <label className="grid gap-2 md:col-span-3">
            <span className="text-sm font-medium text-foreground">Empresa</span>
            <Input name="company_name" required defaultValue={opportunity?.company_name ?? ""} placeholder="Nombre de la empresa" />
          </label>
          <label className="grid gap-2 md:col-span-3">
            <span className="text-sm font-medium text-foreground">Contacto</span>
            <Input name="contact_name" defaultValue={opportunity?.contact_name ?? ""} placeholder="Persona de contacto" />
          </label>
          <label className="grid gap-2 md:col-span-3">
            <span className="text-sm font-medium text-foreground">Telefono</span>
            <Input name="contact_phone" defaultValue={opportunity?.contact_phone ?? ""} inputMode="tel" placeholder="600 123 123" />
          </label>
          <label className="grid gap-2 md:col-span-3">
            <span className="text-sm font-medium text-foreground">Email</span>
            <Input name="contact_email" type="email" defaultValue={opportunity?.contact_email ?? ""} placeholder="contacto@empresa.com" />
          </label>
        </div>
      </section>

      <section className={sectionClassName}>
        <SectionTitle
          title="Pipeline"
          note="Estado, responsable, primera accion y siguiente contacto."
        />
        <div className="mt-5 grid gap-4 md:grid-cols-6">
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Estado</span>
            <Select
              name="status"
              defaultValue={opportunity?.status ?? "new"}
              options={opportunityStatuses.map((status) => ({
                value: status,
                label: opportunityStatusLabels[status],
              }))}
            />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Responsable</span>
            <Input name="owner" defaultValue={opportunity?.owner ?? ""} placeholder="Owner" />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Temperatura</span>
            <Input
              name="temperature"
              type="number"
              min="0"
              max="10"
              step="0.1"
              defaultValue={numberValue(opportunity?.temperature)}
              placeholder="0-10"
            />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Entrada</span>
            <Input
              name="submitted_at"
              type="datetime-local"
              defaultValue={opportunity ? dateTimeInputValue(opportunity.submitted_at) : nowInputValue()}
            />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Primer contacto</span>
            <Input name="first_contact_at" type="datetime-local" defaultValue={dateTimeInputValue(opportunity?.first_contact_at)} />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Proximo contacto</span>
            <Input name="next_contact_at" type="datetime-local" defaultValue={dateTimeInputValue(opportunity?.next_contact_at)} />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Metodo primer contacto</span>
            <Input name="first_contact_method" defaultValue={opportunity?.first_contact_method ?? ""} placeholder="WhatsApp, correo..." />
          </label>
        </div>
      </section>

      <section className={sectionClassName}>
        <SectionTitle
          title="Contexto comercial"
          note="Origen de marketing, necesidad, presupuesto y senales de cualificacion."
        />
        <div className="mt-5 grid gap-4 md:grid-cols-6">
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Origen</span>
            <Input name="source" defaultValue={opportunity?.source ?? ""} placeholder="Web, LinkedIn..." />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Campana</span>
            <Input name="campaign" defaultValue={opportunity?.campaign ?? ""} placeholder="Campana" />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Anuncio</span>
            <Input name="ad" defaultValue={opportunity?.ad ?? ""} placeholder="Anuncio" />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Precio inicial</span>
            <Input
              name="initial_price"
              type="number"
              step="0.01"
              min="0"
              defaultValue={numberValue(opportunity?.initial_price)}
              placeholder="8000"
            />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Presupuesto</span>
            <Input name="budget" defaultValue={opportunity?.budget ?? ""} placeholder="8k, 20k..." />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Provincia</span>
            <Input name="province" defaultValue={opportunity?.province ?? ""} placeholder="Madrid" />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Plataforma</span>
            <Input name="platform" defaultValue={opportunity?.platform ?? ""} placeholder="Web, app, CRM..." />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Tamano empresa</span>
            <Input name="company_size" defaultValue={opportunity?.company_size ?? ""} placeholder="1-10, 10-50..." />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Tiene CRM</span>
            <Input name="has_crm" defaultValue={opportunity?.has_crm ?? ""} placeholder="Si, no, parcial..." />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Landing</span>
            <Input name="landing_slug" defaultValue={opportunity?.landing_slug ?? ""} placeholder="landing-slug" />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Urgencia</span>
            <Input name="urgency" defaultValue={opportunity?.urgency ?? ""} placeholder="Alta, media, baja" />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Rol decision</span>
            <Input name="decision_role" defaultValue={opportunity?.decision_role ?? ""} placeholder="Decisor, usuario..." />
          </label>
        </div>
      </section>

      <section className={sectionClassName}>
        <SectionTitle title="Peticion y notas" note="Texto original de la oportunidad y comentarios internos." />
        <div className="mt-5 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">URL</span>
            <Input name="url" type="url" defaultValue={opportunity?.url ?? ""} placeholder="https://..." />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Problema principal</span>
            <Input name="main_problem" defaultValue={opportunity?.main_problem ?? ""} placeholder="Dolor principal detectado" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Peticion</span>
            <Textarea name="request" defaultValue={opportunity?.request ?? ""} data-filled={opportunity?.request ? "true" : "false"} />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Comentarios</span>
            <Textarea name="comments" defaultValue={opportunity?.comments ?? ""} data-filled={opportunity?.comments ? "true" : "false"} />
          </label>
        </div>
      </section>

    </form>
  )
}
