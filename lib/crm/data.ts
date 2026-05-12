import { redirect } from "next/navigation"

import { requireAppUser } from "@/lib/clients/data"
import { isOpportunityClosed } from "@/lib/crm/format"
import type {
  CRMOpportunityActivity,
  CRMOpportunityDetail,
  CRMOpportunityFilters,
  CRMOpportunityListItem,
  CRMOpportunityMeeting,
  CRMOpportunityRecord,
  OpportunityAgendaItem,
} from "@/lib/crm/types"
import { getMicrosoftConnectionStatus, listMicrosoftCalendarView } from "@/lib/microsoft/graph"
import { createClient } from "@/lib/supabase/server"

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export async function requireCRMUser(supabase?: SupabaseServerClient, nextPath = "/crm/oportunidades") {
  return requireAppUser(supabase, nextPath)
}

function matchesSearch(opportunity: CRMOpportunityRecord, query: string) {
  const haystack = [
    opportunity.company_name,
    opportunity.contact_name,
    opportunity.contact_phone,
    opportunity.contact_email,
    opportunity.request,
    opportunity.comments,
    opportunity.campaign,
    opportunity.owner,
    opportunity.source,
    opportunity.lead_id,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  return haystack.includes(query.toLowerCase())
}

function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
}

function matchesUpcoming(value: string | null, mode: CRMOpportunityFilters["upcoming"]) {
  if (!mode || mode === "all") {
    return true
  }
  if (mode === "none") {
    return !value
  }
  if (!value) {
    return false
  }

  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) {
    return false
  }

  const now = new Date()
  if (mode === "overdue") {
    return date < now
  }
  if (mode === "today") {
    return sameDay(date, now)
  }
  if (mode === "next7") {
    const sevenDays = new Date(now)
    sevenDays.setDate(now.getDate() + 7)
    return date >= now && date <= sevenDays
  }
  return true
}

function matchesFilters(opportunity: CRMOpportunityListItem, filters: CRMOpportunityFilters) {
  if (filters.q && !matchesSearch(opportunity, filters.q)) {
    return false
  }

  if (filters.status && filters.status !== "all" && opportunity.status !== filters.status) {
    return false
  }

  if (filters.owner && filters.owner !== "all" && (opportunity.owner ?? "") !== filters.owner) {
    return false
  }

  if (filters.source && filters.source !== "all" && (opportunity.source ?? "") !== filters.source) {
    return false
  }

  if (filters.closed === "open" && isOpportunityClosed(opportunity.status)) {
    return false
  }

  if (filters.closed === "closed" && !isOpportunityClosed(opportunity.status)) {
    return false
  }

  if (!matchesUpcoming(opportunity.next_contact_at, filters.upcoming)) {
    return false
  }

  return true
}

async function addActivitySummaries(
  supabase: SupabaseServerClient,
  opportunities: CRMOpportunityRecord[],
): Promise<CRMOpportunityListItem[]> {
  if (opportunities.length === 0) {
    return []
  }

  const opportunityIds = opportunities.map((opportunity) => opportunity.id)
  const { data, error } = await supabase
    .from("crm_opportunity_activities")
    .select("opportunity_id, contact_at")
    .in("opportunity_id", opportunityIds)

  if (error) {
    throw error
  }

  const activityCountByOpportunity = new Map<string, number>()
  const latestByOpportunity = new Map<string, string>()

  for (const activity of data ?? []) {
    const opportunityId = activity.opportunity_id as string
    const contactAt = activity.contact_at as string | null
    activityCountByOpportunity.set(opportunityId, (activityCountByOpportunity.get(opportunityId) ?? 0) + 1)
    if (contactAt && (!latestByOpportunity.has(opportunityId) || contactAt > (latestByOpportunity.get(opportunityId) ?? ""))) {
      latestByOpportunity.set(opportunityId, contactAt)
    }
  }

  return opportunities.map((opportunity) => ({
    ...opportunity,
    activity_count: activityCountByOpportunity.get(opportunity.id) ?? 0,
    latest_activity_at: latestByOpportunity.get(opportunity.id) ?? null,
  }))
}

function uniqueOptions(values: (string | null)[]) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))]
    .sort((left, right) => left.localeCompare(right, "es"))
}

function agendaRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 14)
  return { start, end }
}

function buildOpportunityAgenda(
  opportunity: CRMOpportunityRecord,
  activities: CRMOpportunityActivity[],
  meetings: CRMOpportunityMeeting[],
  microsoftEvents: Array<{ id: string; subject: string; startsAt: string; endsAt: string | null; webLink: string | null; joinUrl: string | null }>,
): OpportunityAgendaItem[] {
  const items: OpportunityAgendaItem[] = []

  if (opportunity.next_contact_at) {
    items.push({
      id: `opportunity-next-${opportunity.id}`,
      source: "opportunity",
      label: "Proximo contacto",
      startsAt: opportunity.next_contact_at,
      endsAt: null,
      description: opportunity.company_name,
      href: null,
      joinUrl: null,
      tone: "warning",
    })
  }

  for (const activity of activities) {
    if (!activity.next_contact_at) {
      continue
    }
    items.push({
      id: `activity-next-${activity.id}`,
      source: "activity",
      label: "Seguimiento pendiente",
      startsAt: activity.next_contact_at,
      endsAt: null,
      description: activity.notes ?? activity.contact_person ?? activity.contact_value,
      href: null,
      joinUrl: null,
      tone: "info",
    })
  }

  const localGraphEventIds = new Set<string>()
  for (const meeting of meetings) {
    if (meeting.graph_event_id) {
      localGraphEventIds.add(meeting.graph_event_id)
    }
    if (meeting.status !== "scheduled") {
      continue
    }
    items.push({
      id: `meeting-${meeting.id}`,
      source: "meeting",
      label: meeting.subject,
      startsAt: meeting.starts_at,
      endsAt: meeting.ends_at,
      description: meeting.organizer_email,
      href: meeting.web_link,
      joinUrl: meeting.teams_join_url,
      tone: "success",
    })
  }

  for (const event of microsoftEvents) {
    if (localGraphEventIds.has(event.id)) {
      continue
    }
    items.push({
      id: `microsoft-${event.id}`,
      source: "microsoft",
      label: event.subject,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      description: "Calendario Microsoft",
      href: event.webLink,
      joinUrl: event.joinUrl,
      tone: event.joinUrl ? "success" : "neutral",
    })
  }

  return items.sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())
}

export async function listCRMOpportunities(filters: CRMOpportunityFilters): Promise<{
  user: Awaited<ReturnType<typeof requireCRMUser>>
  opportunities: CRMOpportunityListItem[]
  owners: string[]
  sources: string[]
}> {
  const supabase = await createClient()
  const user = await requireCRMUser(supabase)

  const { data, error } = await supabase
    .from("crm_opportunities")
    .select("*")
    .order("next_contact_at", { ascending: true, nullsFirst: false })
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .limit(1000)

  if (error) {
    throw error
  }

  const opportunities = (data ?? []) as CRMOpportunityRecord[]
  const withSummaries = await addActivitySummaries(supabase, opportunities)

  return {
    user,
    opportunities: withSummaries.filter((opportunity) => matchesFilters(opportunity, filters)),
    owners: uniqueOptions(opportunities.map((opportunity) => opportunity.owner)),
    sources: uniqueOptions(opportunities.map((opportunity) => opportunity.source)),
  }
}

export async function getCRMOpportunityDetail(opportunityId: string): Promise<CRMOpportunityDetail | null> {
  const supabase = await createClient()
  const user = await requireCRMUser(supabase, `/crm/oportunidades/${opportunityId}`)

  const [
    { data: opportunityData, error: opportunityError },
    { data: activityData, error: activityError },
    { data: meetingData, error: meetingError },
  ] =
    await Promise.all([
      supabase
        .from("crm_opportunities")
        .select("*")
        .eq("id", opportunityId)
        .maybeSingle(),
      supabase
        .from("crm_opportunity_activities")
        .select("*")
        .eq("opportunity_id", opportunityId)
        .order("contact_at", { ascending: false }),
      supabase
        .from("crm_opportunity_meetings")
        .select("*")
        .eq("opportunity_id", opportunityId)
        .order("starts_at", { ascending: true }),
    ])

  if (opportunityError) {
    throw opportunityError
  }

  if (activityError) {
    throw activityError
  }

  if (meetingError) {
    throw meetingError
  }

  if (!opportunityData) {
    return null
  }

  const opportunity = opportunityData as CRMOpportunityRecord
  const activities = (activityData ?? []) as CRMOpportunityActivity[]
  const meetings = (meetingData ?? []) as CRMOpportunityMeeting[]
  let microsoftConnection = await getMicrosoftConnectionStatus(user.id)
  let microsoftEvents: Awaited<ReturnType<typeof listMicrosoftCalendarView>> = []

  if (microsoftConnection.connected) {
    const range = agendaRange()
    try {
      microsoftEvents = await listMicrosoftCalendarView(user.id, range.start, range.end)
    } catch {
      microsoftConnection = await getMicrosoftConnectionStatus(user.id)
    }
  }

  return {
    user,
    opportunity,
    activities,
    meetings,
    microsoftConnection,
    agendaItems: buildOpportunityAgenda(opportunity, activities, meetings, microsoftEvents),
  }
}

export async function requireCRMOpportunityDetail(opportunityId: string) {
  const detail = await getCRMOpportunityDetail(opportunityId)

  if (!detail) {
    redirect("/crm/oportunidades")
  }

  return detail
}
