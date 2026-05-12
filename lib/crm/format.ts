import type {
  CRMOpportunityRecord,
  OpportunityActivityType,
  OpportunityMeetingKind,
  OpportunityStatus,
} from "@/lib/crm/types"
import { formatDateTime } from "@/lib/utils"

export const opportunityStatusLabels: Record<OpportunityStatus, string> = {
  new: "Nueva",
  contacted: "Contactada",
  qualified: "Cualificada",
  diagnosis_booked: "Diagnostico agendado",
  diagnosis_attended: "Diagnostico hecho",
  proposal_sent: "Propuesta enviada",
  closed_won: "Ganada",
  closed_lost: "Perdida",
  disqualified: "Descartada",
}

export const opportunityActivityTypeLabels: Record<OpportunityActivityType, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  linkedin: "LinkedIn",
  email: "Correo",
  call: "Llamada",
  meeting_in_person: "Reunion presencial",
  meeting_online: "Reunion online",
  other: "Otro",
}

export const opportunityMeetingKindLabels: Record<OpportunityMeetingKind, string> = {
  general: "General",
  diagnosis: "Diagnostico",
  follow_up: "Seguimiento",
  proposal: "Propuesta",
}

export const opportunityMeetingKinds: OpportunityMeetingKind[] = [
  "diagnosis",
  "follow_up",
  "proposal",
  "general",
]

export const opportunityStatuses: OpportunityStatus[] = [
  "new",
  "contacted",
  "qualified",
  "diagnosis_booked",
  "diagnosis_attended",
  "proposal_sent",
  "closed_won",
  "closed_lost",
  "disqualified",
]

export const opportunityActivityTypes: OpportunityActivityType[] = [
  "whatsapp",
  "telegram",
  "linkedin",
  "email",
  "call",
  "meeting_in_person",
  "meeting_online",
  "other",
]

type OpportunityBoardColumn = {
  id: string
  label: string
  statuses: OpportunityStatus[]
}

export const openOpportunityBoardColumns: OpportunityBoardColumn[] = [
  { id: "new", label: "Nuevas", statuses: ["new"] },
  { id: "contacted", label: "Contactadas", statuses: ["contacted"] },
  { id: "qualified", label: "Cualificadas", statuses: ["qualified"] },
  { id: "diagnosis", label: "Diagnostico", statuses: ["diagnosis_booked", "diagnosis_attended"] },
  { id: "proposal", label: "Propuesta", statuses: ["proposal_sent"] },
]

export const closedOpportunityBoardColumns: OpportunityBoardColumn[] = [
  { id: "won", label: "Ganadas", statuses: ["closed_won"] },
  { id: "lost", label: "Perdidas / descartadas", statuses: ["closed_lost", "disqualified"] },
]

export const opportunityBoardColumns: OpportunityBoardColumn[] = [
  ...openOpportunityBoardColumns,
  ...closedOpportunityBoardColumns,
]

const closedStatuses = new Set<OpportunityStatus>(["closed_won", "closed_lost", "disqualified"])

export function isOpportunityClosed(status: OpportunityStatus) {
  return closedStatuses.has(status)
}

export function opportunityStatusTone(status: OpportunityStatus) {
  if (status === "closed_won") {
    return "success" as const
  }
  if (status === "closed_lost" || status === "disqualified") {
    return "danger" as const
  }
  if (status === "proposal_sent" || status.startsWith("diagnosis")) {
    return "warning" as const
  }
  if (status === "qualified" || status === "contacted") {
    return "info" as const
  }
  return "neutral" as const
}

export function opportunityOriginLabel(opportunity: CRMOpportunityRecord) {
  return opportunity.sharepoint_item_id ? "SharePoint" : "Manual"
}

export function formatOpportunityDateTime(value: string | null | undefined) {
  return value ? formatDateTime(value) : "-"
}

export function formatOpportunityMoney(value: number | string | null | undefined) {
  if (value == null || value === "") {
    return "-"
  }
  const numberValue = typeof value === "number" ? value : Number.parseFloat(String(value).replace(",", "."))
  if (!Number.isFinite(numberValue)) {
    return "-"
  }
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(numberValue)
}

export function dateTimeInputValue(value: string | null | undefined) {
  if (!value) {
    return ""
  }
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) {
    return ""
  }
  const offsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}
