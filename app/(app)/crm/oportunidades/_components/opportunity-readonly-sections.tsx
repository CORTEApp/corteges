import Link from "next/link"
import { CalendarDays, CheckCircle2, ExternalLink, MessageSquarePlus, PlugZap, Route, Video } from "lucide-react"

import {
  closeOpportunityAction,
  createOpportunityTeamsMeetingAction,
  saveOpportunityActivityAction,
  updateOpportunityStatusAction,
} from "@/app/(app)/crm/oportunidades/actions"
import { DetailField, DetailFieldGrid, DetailTextBlock } from "@/components/detail-fields"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button"
import { FormSection } from "@/components/ui/form-section"
import { FormSubmitButton } from "@/components/ui/form-submit-button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  dateTimeInputValue,
  formatOpportunityDateTime,
  formatOpportunityMoney,
  opportunityActivityTypeLabels,
  opportunityActivityTypes,
  opportunityMeetingKindLabels,
  opportunityMeetingKinds,
  opportunityOriginLabel,
  opportunityStatusLabels,
  opportunityStatuses,
  opportunityStatusTone,
} from "@/lib/crm/format"
import type {
  CRMOpportunityActivity,
  CRMOpportunityMeeting,
  CRMOpportunityRecord,
  MicrosoftConnectionStatus,
  OpportunityAgendaItem,
} from "@/lib/crm/types"
import { cn, formatDateTime } from "@/lib/utils"

type HistoryItem = {
  id: string
  at: string
  title: string
  kind: "activity" | "milestone"
  sourceLabel: string
  tone: "neutral" | "success" | "warning" | "danger" | "info"
  activity?: CRMOpportunityActivity
  details?: string | null
}

export function OpportunityFichaReadOnly({ opportunity }: { opportunity: CRMOpportunityRecord }) {
  return (
    <div className="grid gap-6">
      <FormSection
        action={<Badge tone={opportunityStatusTone(opportunity.status)}>{opportunityStatusLabels[opportunity.status]}</Badge>}
        className="border-l-4 border-l-primary"
        title="Oportunidad"
      >
        <DetailFieldGrid>
          <DetailField label="Empresa" value={opportunity.company_name} />
          <DetailField label="Contacto" value={opportunity.contact_name} />
          <DetailField label="Telefono" value={opportunity.contact_phone} />
          <DetailField label="Email" value={opportunity.contact_email} />
          <DetailField label="Owner" value={opportunity.owner} />
          <DetailField label="Temperatura" value={opportunity.temperature == null ? "-" : `${opportunity.temperature}/10`} />
        </DetailFieldGrid>
      </FormSection>

      <FormSection className="border-l-4 border-l-primary/55" title="Pipeline">
        <DetailFieldGrid>
          <DetailField label="Entrada" value={formatOpportunityDateTime(opportunity.submitted_at)} />
          <DetailField label="Primer contacto" value={formatOpportunityDateTime(opportunity.first_contact_at)} />
          <DetailField label="Metodo primer contacto" value={opportunity.first_contact_method} />
          <DetailField label="Proximo contacto" value={formatOpportunityDateTime(opportunity.next_contact_at)} />
          <DetailField label="Precio inicial" value={formatOpportunityMoney(opportunity.initial_price)} />
          <DetailField label="Presupuesto" value={opportunity.budget} />
        </DetailFieldGrid>
      </FormSection>

      <FormSection className="border-l-4 border-l-primary/30" title="Contexto">
        <DetailFieldGrid>
          <DetailField label="Origen" value={opportunity.source} />
          <DetailField label="Campana" value={opportunity.campaign} />
          <DetailField label="Anuncio" value={opportunity.ad} />
          <DetailField label="Plataforma" value={opportunity.platform} />
          <DetailField label="Provincia" value={opportunity.province} />
          <DetailField label="Tamano" value={opportunity.company_size} />
          <DetailField label="Tiene CRM" value={opportunity.has_crm} />
          <DetailField label="Landing" value={opportunity.landing_slug} />
          <DetailField label="Urgencia" value={opportunity.urgency} />
        </DetailFieldGrid>
      </FormSection>

      <FormSection className="border-l-4 border-l-primary/20" title="Peticion">
        <div className="grid gap-3">
          <DetailTextBlock label="Peticion" value={opportunity.request} />
          <DetailTextBlock label="Comentarios" value={opportunity.comments} />
          <DetailTextBlock label="Problema principal" value={opportunity.main_problem} />
        </div>
      </FormSection>
    </div>
  )
}

export function OpportunityManagementSection({
  opportunity,
  meetings,
  microsoftConnection,
  agendaItems,
}: {
  opportunity: CRMOpportunityRecord
  meetings: CRMOpportunityMeeting[]
  microsoftConnection: MicrosoftConnectionStatus
  agendaItems: OpportunityAgendaItem[]
}) {
  const detailPath = `/crm/oportunidades/${opportunity.id}`

  return (
    <div className="grid gap-6">
      <OpportunityAgendaSection
        opportunity={opportunity}
        meetings={meetings}
        microsoftConnection={microsoftConnection}
        agendaItems={agendaItems}
      />

      <FormSection
        action={<Badge tone={opportunityStatusTone(opportunity.status)}>{opportunityStatusLabels[opportunity.status]}</Badge>}
        className="border-l-4 border-l-primary"
        title="Estado y siguiente paso"
        description="Cambia el estado del pipeline y fija el proximo contacto sin salir de la oportunidad."
      >
        <form action={updateOpportunityStatusAction} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <input type="hidden" name="opportunity_id" value={opportunity.id} />
          <input type="hidden" name="redirect_to" value={`${detailPath}#gestion`} />
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Estado</span>
            <Select
              name="status"
              defaultValue={opportunity.status}
              options={opportunityStatuses.map((status) => ({
                value: status,
                label: opportunityStatusLabels[status],
              }))}
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Proximo contacto</span>
            <Input name="next_contact_at" type="datetime-local" defaultValue={dateTimeInputValue(opportunity.next_contact_at)} />
          </label>
          <FormSubmitButton pendingLabel="Actualizando...">
            <Route aria-hidden="true" />
            Actualizar
          </FormSubmitButton>
        </form>
      </FormSection>

      <ActivityForm
        opportunity={opportunity}
        redirectTo={`${detailPath}#contactos`}
        title="Registrar contacto o reunion"
        description="Guarda llamadas, correos, WhatsApp o reuniones y deja preparado el siguiente toque."
      />

      <FormSection
        className="border-l-4 border-l-amber-300"
        title="Cerrar oportunidad"
        description="No hay borrado fisico en CRM: la oportunidad se gana, se pierde o se descarta."
      >
        <form action={closeOpportunityAction} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <input type="hidden" name="opportunity_id" value={opportunity.id} />
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Resultado</span>
            <Select
              name="close_status"
              defaultValue="closed_won"
              options={[
                { value: "closed_won", label: "Ganada" },
                { value: "closed_lost", label: "Perdida" },
                { value: "disqualified", label: "Descartada" },
              ]}
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Motivo / nota</span>
            <Input name="close_note" placeholder="Motivo de cierre" />
          </label>
          <ConfirmSubmitButton
            title="Cerrar oportunidad"
            description={`Vas a cerrar ${opportunity.company_name}. Podras editarla despues, pero saldra del flujo abierto.`}
            confirmLabel="Confirma si este es el resultado correcto."
          >
            <CheckCircle2 aria-hidden="true" />
            Cerrar
          </ConfirmSubmitButton>
        </form>
      </FormSection>
    </div>
  )
}

function OpportunityAgendaSection({
  opportunity,
  meetings,
  microsoftConnection,
  agendaItems,
}: {
  opportunity: CRMOpportunityRecord
  meetings: CRMOpportunityMeeting[]
  microsoftConnection: MicrosoftConnectionStatus
  agendaItems: OpportunityAgendaItem[]
}) {
  const detailPath = `/crm/oportunidades/${opportunity.id}`
  const nextPath = `${detailPath}#gestion`
  const microsoftProfileHref = "/perfil#integraciones"
  const statusTone = !microsoftConnection.configured || microsoftConnection.requiresReconnect
    ? "warning"
    : microsoftConnection.connected
      ? "success"
      : "neutral"
  const statusLabel = !microsoftConnection.configured
    ? "Sin configurar"
    : microsoftConnection.connected
      ? "Microsoft conectado"
      : microsoftConnection.requiresReconnect
        ? "Reconectar Microsoft"
        : "Microsoft pendiente"

  return (
    <FormSection
      action={<Badge tone={statusTone}>{statusLabel}</Badge>}
      className="border-l-4 border-l-primary/80"
      title="Agenda y Teams"
      description="Agenda mixta de la oportunidad, reuniones creadas desde CORTE.Ges y calendario Microsoft del usuario conectado."
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_28rem]">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">Proximos 14 dias</p>
              <p className="text-xs text-muted-foreground">
                {agendaItems.length} eventos visibles · {meetings.length} reuniones vinculadas
              </p>
            </div>
          </div>
          <AgendaList items={agendaItems} />
        </div>

        <div className="grid gap-4 rounded-[var(--radius-panel)] border border-border/80 bg-[color:var(--surface-2)]/70 p-4">
          {microsoftConnection.configured ? (
            microsoftConnection.connected ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Crear reunion de Teams</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {microsoftConnection.email ?? microsoftConnection.displayName ?? "Cuenta Microsoft conectada"}
                    </p>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={microsoftProfileHref}>Gestionar</Link>
                  </Button>
                </div>
                <TeamsMeetingForm opportunity={opportunity} redirectTo={nextPath} />
              </>
            ) : (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <p className="text-sm font-semibold text-foreground">Microsoft no esta conectado</p>
                  <p className="text-sm text-muted-foreground">
                    Conecta tu cuenta para leer tu calendario y crear eventos de Teams en tu propio Outlook.
                  </p>
                  {microsoftConnection.lastError ? (
                    <p className="rounded-[var(--radius-control)] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      {microsoftConnection.lastError}
                    </p>
                  ) : null}
                </div>
                <Button asChild>
                  <Link href={microsoftProfileHref}>
                    <PlugZap aria-hidden="true" />
                    Configurar en perfil
                  </Link>
                </Button>
              </div>
            )
          ) : (
            <div className="grid gap-3">
              <p className="text-sm font-semibold text-foreground">Configuracion pendiente</p>
              <p className="text-sm text-muted-foreground">
                Faltan variables de Microsoft Graph en el entorno. La agenda local sigue disponible.
              </p>
              {microsoftConnection.lastError ? (
                <p className="rounded-[var(--radius-control)] border border-border bg-[color:var(--surface-1)] px-3 py-2 text-xs text-muted-foreground">
                  {microsoftConnection.lastError}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </FormSection>
  )
}

function TeamsMeetingForm({
  opportunity,
  redirectTo,
}: {
  opportunity: CRMOpportunityRecord
  redirectTo: string
}) {
  const defaultSubject = `Reunion con ${opportunity.company_name}`
  const defaultStart = dateTimeInputValue(opportunity.next_contact_at) || defaultMeetingStart()
  const attendees = opportunity.contact_email ?? ""

  return (
    <form action={createOpportunityTeamsMeetingAction} className="grid gap-4">
      <input type="hidden" name="opportunity_id" value={opportunity.id} />
      <input type="hidden" name="redirect_to" value={redirectTo} />
      <label className="grid gap-2">
        <span className="text-sm font-medium text-foreground">Asunto</span>
        <Input name="subject" defaultValue={defaultSubject} required />
      </label>
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-foreground">Inicio</span>
          <Input name="starts_at" type="datetime-local" defaultValue={defaultStart} required />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-foreground">Minutos</span>
          <Input name="duration_minutes" type="number" min="15" max="240" step="15" defaultValue="45" required />
        </label>
      </div>
      <label className="grid gap-2">
        <span className="text-sm font-medium text-foreground">Tipo</span>
        <Select
          name="meeting_kind"
          defaultValue="diagnosis"
          options={opportunityMeetingKinds.map((kind) => ({
            value: kind,
            label: opportunityMeetingKindLabels[kind],
          }))}
        />
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-medium text-foreground">Asistentes</span>
        <Textarea name="attendees" defaultValue={attendees} placeholder="email@empresa.com" required />
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-medium text-foreground">Notas</span>
        <Textarea name="notes" placeholder="Contexto para la reunion" />
      </label>
      <FormSubmitButton pendingLabel="Creando reunion...">
        <Video aria-hidden="true" />
        Crear reunion Teams
      </FormSubmitButton>
    </form>
  )
}

function AgendaList({ items }: { items: OpportunityAgendaItem[] }) {
  if (!items.length) {
    return (
      <div className="rounded-[var(--radius-panel)] border border-dashed border-border/80 bg-[color:var(--surface-2)] px-4 py-8 text-center text-sm text-muted-foreground">
        No hay eventos ni contactos proximos en el rango visible.
      </div>
    )
  }

  const groups = groupAgendaItems(items)

  return (
    <div className="grid gap-4">
      {groups.map((group) => (
        <div key={group.label} className="grid gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            {group.label}
          </div>
          <div className="grid gap-2">
            {group.items.map((item) => (
              <AgendaItemCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function AgendaItemCard({ item }: { item: OpportunityAgendaItem }) {
  return (
    <div className="grid gap-3 rounded-[var(--radius-panel)] border border-border/70 bg-[color:var(--surface-1)] px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge tone={item.tone}>{agendaSourceLabel(item.source)}</Badge>
            <p className="min-w-0 text-sm font-semibold text-foreground">{item.label}</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{agendaTimeRange(item)}</p>
          {item.description ? <p className="mt-2 text-sm text-muted-foreground">{item.description}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {item.joinUrl ? (
            <Button asChild size="sm">
              <a href={item.joinUrl} target="_blank" rel="noreferrer">
                <Video aria-hidden="true" />
                Teams
              </a>
            </Button>
          ) : null}
          {item.href ? (
            <Button asChild size="sm" variant="outline">
              <a href={item.href} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden="true" />
                Outlook
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function groupAgendaItems(items: OpportunityAgendaItem[]) {
  const groups = new Map<string, OpportunityAgendaItem[]>()
  for (const item of items) {
    const label = agendaDateLabel(item.startsAt)
    groups.set(label, [...(groups.get(label) ?? []), item])
  }
  return [...groups.entries()].map(([label, groupItems]) => ({ label, items: groupItems }))
}

function agendaDateLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) {
    return "Sin fecha"
  }
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(date)
}

function agendaTimeRange(item: OpportunityAgendaItem) {
  const start = agendaTimeLabel(item.startsAt)
  const end = item.endsAt ? agendaTimeLabel(item.endsAt) : ""
  return end ? `${start} - ${end}` : start
}

function agendaTimeLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) {
    return "-"
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function agendaSourceLabel(source: OpportunityAgendaItem["source"]) {
  if (source === "meeting") {
    return "Teams"
  }
  if (source === "microsoft") {
    return "Microsoft"
  }
  if (source === "activity") {
    return "Seguimiento"
  }
  return "CRM"
}

function defaultMeetingStart() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(10, 0, 0, 0)
  const offsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

function ActivityForm({
  opportunity,
  redirectTo,
  title,
  description,
}: {
  opportunity: CRMOpportunityRecord
  redirectTo: string
  title: string
  description: string
}) {
  return (
    <FormSection className="border-l-4 border-l-primary/70" title={title} description={description}>
      <form action={saveOpportunityActivityAction} className="grid gap-4 md:grid-cols-6">
        <input type="hidden" name="opportunity_id" value={opportunity.id} />
        <input type="hidden" name="redirect_to" value={redirectTo} />
        <label className="grid gap-2 md:col-span-2">
          <span className="text-sm font-medium text-foreground">Tipo</span>
          <Select
            name="activity_type"
            defaultValue="whatsapp"
            options={opportunityActivityTypes.map((type) => ({
              value: type,
              label: opportunityActivityTypeLabels[type],
            }))}
          />
        </label>
        <label className="grid gap-2 md:col-span-2">
          <span className="text-sm font-medium text-foreground">Fecha contacto / reunion</span>
          <Input name="contact_at" type="datetime-local" />
        </label>
        <label className="grid gap-2 md:col-span-2">
          <span className="text-sm font-medium text-foreground">Proximo contacto</span>
          <Input name="next_contact_at" type="datetime-local" />
        </label>
        <label className="grid gap-2 md:col-span-2">
          <span className="text-sm font-medium text-foreground">Persona</span>
          <Input name="contact_person" defaultValue={opportunity.contact_name ?? ""} />
        </label>
        <label className="grid gap-2 md:col-span-2">
          <span className="text-sm font-medium text-foreground">Contacto</span>
          <Input name="contact_value" defaultValue={opportunity.contact_phone ?? opportunity.contact_email ?? ""} />
        </label>
        <label className="grid gap-2 md:col-span-2">
          <span className="text-sm font-medium text-foreground">Temperatura</span>
          <Input name="temperature" type="number" min="0" max="10" step="0.1" />
        </label>
        <label className="grid gap-2 md:col-span-3">
          <span className="text-sm font-medium text-foreground">Rol</span>
          <Input name="contact_role" />
        </label>
        <label className="grid gap-2 md:col-span-3">
          <span className="text-sm font-medium text-foreground">Owner</span>
          <Input name="owner" defaultValue={opportunity.owner ?? ""} />
        </label>
        <label className="grid gap-2 md:col-span-6">
          <span className="text-sm font-medium text-foreground">Notas</span>
          <Textarea name="notes" />
        </label>
        <div className="md:col-span-6">
          <FormSubmitButton pendingLabel="Guardando...">
            <MessageSquarePlus aria-hidden="true" />
            Guardar actividad
          </FormSubmitButton>
        </div>
      </form>
    </FormSection>
  )
}

export function OpportunityActivitiesSection({
  opportunity,
  activities,
}: {
  opportunity: CRMOpportunityRecord
  activities: CRMOpportunityActivity[]
}) {
  return (
    <FormSection
      action={<Badge tone="info">{activities.length} contactos</Badge>}
      className="border-l-4 border-l-primary/35"
      title="Historico de la oportunidad"
      description="Contactos de Prospectos, actividades manuales, reuniones e hitos del pipeline."
    >
      <OpportunityTimeline opportunity={opportunity} activities={activities} />
    </FormSection>
  )
}

function OpportunityTimeline({
  opportunity,
  activities,
}: {
  opportunity: CRMOpportunityRecord
  activities: CRMOpportunityActivity[]
}) {
  const items = [
    ...milestoneItems(opportunity),
    ...activities.map(activityHistoryItem),
  ].sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime())

  if (!items.length) {
    return (
      <div className="rounded-[var(--radius-panel)] border border-dashed border-border/80 bg-[color:var(--surface-2)] px-4 py-8 text-center text-sm text-muted-foreground">
        Todavia no hay historico registrado.
      </div>
    )
  }

  return (
    <ol className="relative grid gap-4 pl-5 before:absolute before:bottom-0 before:left-1.5 before:top-2 before:w-px before:bg-border">
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span
            className={cn(
              "absolute -left-[1.05rem] top-4 size-3 rounded-full border-2 border-[color:var(--surface-1)]",
              item.kind === "activity" ? "bg-primary" : "bg-amber-400",
            )}
            aria-hidden="true"
          />
          <div className="grid gap-3 rounded-[var(--radius-panel)] border border-border/70 bg-[color:var(--surface-2)]/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={item.tone}>{item.title}</Badge>
                <span className="text-sm font-semibold text-foreground">{formatDateTime(item.at)}</span>
              </div>
              <span className="text-xs text-muted-foreground">{item.sourceLabel}</span>
            </div>
            {item.activity ? (
              <>
                <DetailFieldGrid>
                  <DetailField label="Persona" value={item.activity.contact_person} />
                  <DetailField label="Contacto" value={item.activity.contact_value} />
                  <DetailField label="Proximo contacto" value={formatOpportunityDateTime(item.activity.next_contact_at)} />
                  <DetailField label="Temperatura" value={item.activity.temperature == null ? "-" : `${item.activity.temperature}/10`} />
                  <DetailField label="Owner" value={item.activity.owner} />
                  <DetailField label="Rol" value={item.activity.contact_role} />
                </DetailFieldGrid>
                <DetailTextBlock label="Notas" value={item.activity.notes} />
              </>
            ) : item.details ? (
              <DetailTextBlock label="Detalle" value={item.details} />
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  )
}

function activityHistoryItem(activity: CRMOpportunityActivity): HistoryItem {
  return {
    id: `activity-${activity.id}`,
    at: activity.contact_at,
    title: opportunityActivityTypeLabels[activity.activity_type],
    kind: "activity",
    sourceLabel: activity.source_kind === "sharepoint" ? "SharePoint" : "Manual",
    tone: activity.source_kind === "sharepoint" ? "info" : "success",
    activity,
  }
}

function milestoneItems(opportunity: CRMOpportunityRecord): HistoryItem[] {
  const items: (HistoryItem | null)[] = [
    opportunity.submitted_at
      ? {
          id: "milestone-submitted",
          at: opportunity.submitted_at,
          title: "Entrada",
          kind: "milestone",
          sourceLabel: opportunityOriginLabel(opportunity),
          tone: "neutral",
          details: opportunity.request,
        }
      : null,
    opportunity.first_contact_at
      ? {
          id: "milestone-first-contact",
          at: opportunity.first_contact_at,
          title: "Primer contacto",
          kind: "milestone",
          sourceLabel: opportunity.first_contact_method ?? "Pipeline",
          tone: "info",
          details: opportunity.comments,
        }
      : null,
    opportunity.qualified_at
      ? {
          id: "milestone-qualified",
          at: opportunity.qualified_at,
          title: "Cualificada",
          kind: "milestone",
          sourceLabel: "Pipeline",
          tone: "success",
          details: opportunity.qualification_status,
        }
      : null,
    opportunity.diagnosis_booked_at
      ? {
          id: "milestone-diagnosis-booked",
          at: opportunity.diagnosis_booked_at,
          title: "Diagnostico agendado",
          kind: "milestone",
          sourceLabel: "Pipeline",
          tone: "warning",
          details: null,
        }
      : null,
    opportunity.diagnosis_attended_at
      ? {
          id: "milestone-diagnosis-attended",
          at: opportunity.diagnosis_attended_at,
          title: "Diagnostico hecho",
          kind: "milestone",
          sourceLabel: "Pipeline",
          tone: "warning",
          details: null,
        }
      : null,
    opportunity.proposal_sent_at
      ? {
          id: "milestone-proposal",
          at: opportunity.proposal_sent_at,
          title: "Propuesta enviada",
          kind: "milestone",
          sourceLabel: "Pipeline",
          tone: "warning",
          details: formatOpportunityMoney(opportunity.initial_price),
        }
      : null,
    opportunity.closed_at
      ? {
          id: "milestone-closed",
          at: opportunity.closed_at,
          title: opportunityStatusLabels[opportunity.status],
          kind: "milestone",
          sourceLabel: "Cierre",
          tone: opportunity.status === "closed_won" ? "success" : "danger",
          details: opportunity.closed_lost_note ?? opportunity.closed_lost_reason ?? opportunity.disqualification_reason,
        }
      : null,
    !opportunity.closed_at && opportunity.disqualified_at
      ? {
          id: "milestone-disqualified",
          at: opportunity.disqualified_at,
          title: "Descartada",
          kind: "milestone",
          sourceLabel: "Pipeline",
          tone: "danger",
          details: opportunity.disqualification_reason,
        }
      : null,
  ]

  return items.filter((item): item is HistoryItem => Boolean(item))
}

export function OpportunityTraceReadOnly({ opportunity }: { opportunity: CRMOpportunityRecord }) {
  return (
    <FormSection
      action={<Badge tone={opportunity.sharepoint_item_id ? "info" : "neutral"}>{opportunityOriginLabel(opportunity)}</Badge>}
      className="border-l-4 border-l-primary/45"
      title="Origen del registro"
    >
      <DetailFieldGrid>
        <DetailField label="Lead id" value={opportunity.lead_id} />
        <DetailField label="Estado legado" value={opportunity.legacy_status} />
        <DetailField label="SharePoint site" value={opportunity.sharepoint_site_id} />
        <DetailField label="SharePoint list" value={opportunity.sharepoint_list_id} />
        <DetailField label="SharePoint item" value={opportunity.sharepoint_item_id} />
        <DetailField label="SharePoint unique id" value={opportunity.sharepoint_unique_id} />
        <DetailField label="SharePoint etag" value={opportunity.sharepoint_etag} />
        <DetailField label="Importado" value={formatOpportunityDateTime(opportunity.imported_at)} />
        <DetailField label="Creado" value={formatDateTime(opportunity.created_at)} />
        <DetailField label="Actualizado" value={formatDateTime(opportunity.updated_at)} />
      </DetailFieldGrid>
      {opportunity.url ? (
        <div className="mt-4">
          <Button asChild variant="outline">
            <a href={opportunity.url} target="_blank" rel="noreferrer">
              Abrir URL original
            </a>
          </Button>
        </div>
      ) : null}
    </FormSection>
  )
}
