import type { AppUser } from "@/lib/clients/types"

export type OpportunityStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "diagnosis_booked"
  | "diagnosis_attended"
  | "proposal_sent"
  | "closed_won"
  | "closed_lost"
  | "disqualified"

export type OpportunityActivityType =
  | "whatsapp"
  | "telegram"
  | "linkedin"
  | "email"
  | "call"
  | "meeting_in_person"
  | "meeting_online"
  | "other"

export type OpportunityClosedFilter = "open" | "closed" | "all"
export type OpportunityUpcomingFilter = "all" | "overdue" | "today" | "next7" | "none"
export type OpportunityMeetingKind = "general" | "diagnosis" | "follow_up" | "proposal"

export type MicrosoftConnectionStatus = {
  configured: boolean
  connected: boolean
  requiresReconnect: boolean
  email: string | null
  displayName: string | null
  lastError: string | null
}

export type CRMOpportunityRecord = {
  id: string
  lead_id: string | null
  company_name: string
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  submitted_at: string | null
  first_contact_at: string | null
  first_contact_method: string | null
  temperature: number | null
  status: OpportunityStatus
  legacy_status: string | null
  request: string | null
  comments: string | null
  url: string | null
  continue_label: string | null
  platform: string | null
  schedule: string | null
  company_size: string | null
  province: string | null
  budget: string | null
  has_crm: string | null
  gamma: string | null
  chat_database: string | null
  chat_screens: string | null
  chat_automations: string | null
  gamma_url: string | null
  initial_price: number | null
  campaign: string | null
  ad: string | null
  owner: string | null
  source: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  cta_id: string | null
  narrative: string[] | null
  landing_slug: string | null
  main_problem: string | null
  urgency: string | null
  decision_role: string | null
  qualification_status: string | null
  qualified_at: string | null
  disqualified_at: string | null
  disqualification_reason: string | null
  diagnosis_booked_at: string | null
  diagnosis_attended_at: string | null
  proposal_sent_at: string | null
  closed_at: string | null
  closed_outcome: "won" | "lost" | null
  closed_lost_reason: string | null
  closed_lost_note: string | null
  closed_lost_stage: string | null
  next_contact_at: string | null
  sharepoint_site_id: string | null
  sharepoint_list_id: string | null
  sharepoint_item_id: number | null
  sharepoint_unique_id: string | null
  sharepoint_etag: string | null
  source_raw: unknown
  imported_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type CRMOpportunityActivity = {
  id: string
  opportunity_id: string
  activity_type: OpportunityActivityType
  contact_at: string
  next_contact_at: string | null
  temperature: number | null
  notes: string | null
  contact_person: string | null
  contact_role: string | null
  contact_value: string | null
  owner: string | null
  diagnosis_booked_at: string | null
  diagnosis_attended_at: string | null
  closed_outcome: "won" | "lost" | null
  closed_lost_reason: string | null
  closed_lost_note: string | null
  closed_lost_stage: string | null
  source_kind: "manual" | "sharepoint"
  sharepoint_site_id: string | null
  sharepoint_list_id: string | null
  sharepoint_item_id: number | null
  sharepoint_unique_id: string | null
  sharepoint_etag: string | null
  source_raw: unknown
  imported_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type CRMOpportunityMeeting = {
  id: string
  opportunity_id: string
  organizer_user_id: string | null
  organizer_email: string | null
  subject: string
  meeting_kind: OpportunityMeetingKind
  starts_at: string
  ends_at: string
  time_zone: string
  attendees: Array<{ email: string; name?: string | null }>
  notes: string | null
  graph_event_id: string | null
  graph_ical_uid: string | null
  teams_join_url: string | null
  web_link: string | null
  status: "scheduled" | "cancelled"
  graph_raw: unknown
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type OpportunityAgendaItem = {
  id: string
  source: "opportunity" | "activity" | "meeting" | "microsoft"
  label: string
  startsAt: string
  endsAt: string | null
  description: string | null
  href: string | null
  joinUrl: string | null
  tone: "neutral" | "info" | "success" | "warning" | "danger"
}

export type CRMOpportunityListItem = CRMOpportunityRecord & {
  activity_count: number
  latest_activity_at: string | null
}

export type CRMOpportunityDetail = {
  user: AppUser
  opportunity: CRMOpportunityRecord
  activities: CRMOpportunityActivity[]
  meetings: CRMOpportunityMeeting[]
  microsoftConnection: MicrosoftConnectionStatus
  agendaItems: OpportunityAgendaItem[]
}

export type CRMOpportunityFilters = {
  q?: string
  status?: OpportunityStatus | "all"
  owner?: string
  source?: string
  upcoming?: OpportunityUpcomingFilter
  closed?: OpportunityClosedFilter
}
