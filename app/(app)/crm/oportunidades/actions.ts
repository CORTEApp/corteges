"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireCRMUser } from "@/lib/crm/data"
import type { OpportunityActivityType, OpportunityMeetingKind, OpportunityStatus } from "@/lib/crm/types"
import {
  createTeamsCalendarEvent,
  getMicrosoftConnectionStatus,
  getMicrosoftGraphConfig,
  type TeamsEventAttendee,
} from "@/lib/microsoft/graph"
import { createClient } from "@/lib/supabase/server"

const OPPORTUNITY_STATUSES = new Set<OpportunityStatus>([
  "new",
  "contacted",
  "qualified",
  "diagnosis_booked",
  "diagnosis_attended",
  "proposal_sent",
  "closed_won",
  "closed_lost",
  "disqualified",
])

const ACTIVITY_TYPES = new Set<OpportunityActivityType>([
  "whatsapp",
  "telegram",
  "linkedin",
  "email",
  "call",
  "meeting_in_person",
  "meeting_online",
  "other",
])

const MEETING_KINDS = new Set<OpportunityMeetingKind>([
  "general",
  "diagnosis",
  "follow_up",
  "proposal",
])

function textValue(formData: FormData, key: string) {
  const value = formData.get(key)
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function graphLocalDateTimeValue(formData: FormData, key: string) {
  const value = requiredText(formData, key)
  const parsed = new Date(value)
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error(`Invalid date field: ${key}`)
  }
  return value.length === 16 ? `${value}:00` : value
}

function localInputFromDate(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 19)
}

function parseAttendees(value: string | null): TeamsEventAttendee[] {
  const seen = new Set<string>()
  return String(value ?? "")
    .split(/[\n,;]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
      return match?.[0]?.toLowerCase() ?? ""
    })
    .filter((email) => {
      if (!email || seen.has(email)) {
        return false
      }
      seen.add(email)
      return true
    })
    .map((email) => ({ email }))
}

function meetingKindValue(formData: FormData): OpportunityMeetingKind {
  const value = textValue(formData, "meeting_kind") ?? "general"
  return MEETING_KINDS.has(value as OpportunityMeetingKind) ? (value as OpportunityMeetingKind) : "general"
}

function integerValue(formData: FormData, key: string, fallback: number) {
  const value = textValue(formData, key)
  if (!value) {
    return fallback
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function requiredText(formData: FormData, key: string) {
  const value = textValue(formData, key)
  if (!value) {
    throw new Error(`Missing required field: ${key}`)
  }
  return value
}

function numberValue(formData: FormData, key: string) {
  const value = textValue(formData, key)
  if (!value) {
    return null
  }

  const parsed = Number.parseFloat(value.replace(",", "."))
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number field: ${key}`)
  }
  return parsed
}

function dateTimeValue(formData: FormData, key: string) {
  const value = textValue(formData, key)
  if (!value) {
    return null
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error(`Invalid date field: ${key}`)
  }
  return parsed.toISOString()
}

function statusValue(formData: FormData, key = "status"): OpportunityStatus {
  const value = textValue(formData, key) ?? "new"
  return OPPORTUNITY_STATUSES.has(value as OpportunityStatus) ? (value as OpportunityStatus) : "new"
}

function activityTypeValue(formData: FormData): OpportunityActivityType {
  const value = textValue(formData, "activity_type") ?? "other"
  return ACTIVITY_TYPES.has(value as OpportunityActivityType) ? (value as OpportunityActivityType) : "other"
}

function redirectTarget(formData: FormData, fallback: string) {
  const value = textValue(formData, "redirect_to")
  if (!value || !value.startsWith("/crm/oportunidades")) {
    return fallback
  }
  return value
}

async function getActionContext(nextPath: string) {
  const supabase = await createClient()
  const user = await requireCRMUser(supabase, nextPath)
  return { supabase, userId: user.id }
}

function revalidateCRMPaths(opportunityId?: string) {
  revalidatePath("/crm")
  revalidatePath("/crm/oportunidades")
  if (opportunityId) {
    revalidatePath(`/crm/oportunidades/${opportunityId}`)
    revalidatePath(`/crm/oportunidades/${opportunityId}/edit`)
  }
}

function statusTimestampPatch(status: OpportunityStatus, now = new Date().toISOString()) {
  if (status === "qualified") {
    return { qualified_at: now }
  }
  if (status === "diagnosis_booked") {
    return { diagnosis_booked_at: now }
  }
  if (status === "diagnosis_attended") {
    return { diagnosis_attended_at: now }
  }
  if (status === "proposal_sent") {
    return { proposal_sent_at: now }
  }
  if (status === "closed_won") {
    return { closed_at: now, closed_outcome: "won" as const }
  }
  if (status === "closed_lost") {
    return { closed_at: now, closed_outcome: "lost" as const }
  }
  if (status === "disqualified") {
    return { disqualified_at: now, closed_at: now, closed_outcome: null }
  }
  return {}
}

export async function saveOpportunityAction(formData: FormData) {
  const opportunityId = textValue(formData, "opportunity_id")
  const { supabase, userId } = await getActionContext(
    opportunityId ? `/crm/oportunidades/${opportunityId}/edit` : "/crm/oportunidades/nuevo",
  )
  const status = statusValue(formData)

  const payload = {
    company_name: requiredText(formData, "company_name"),
    contact_name: textValue(formData, "contact_name"),
    contact_phone: textValue(formData, "contact_phone"),
    contact_email: textValue(formData, "contact_email"),
    submitted_at: dateTimeValue(formData, "submitted_at"),
    first_contact_at: dateTimeValue(formData, "first_contact_at"),
    first_contact_method: textValue(formData, "first_contact_method"),
    temperature: numberValue(formData, "temperature"),
    status,
    request: textValue(formData, "request"),
    comments: textValue(formData, "comments"),
    url: textValue(formData, "url"),
    platform: textValue(formData, "platform"),
    schedule: textValue(formData, "schedule"),
    company_size: textValue(formData, "company_size"),
    province: textValue(formData, "province"),
    budget: textValue(formData, "budget"),
    has_crm: textValue(formData, "has_crm"),
    initial_price: numberValue(formData, "initial_price"),
    campaign: textValue(formData, "campaign"),
    ad: textValue(formData, "ad"),
    owner: textValue(formData, "owner"),
    source: textValue(formData, "source"),
    landing_slug: textValue(formData, "landing_slug"),
    main_problem: textValue(formData, "main_problem"),
    urgency: textValue(formData, "urgency"),
    decision_role: textValue(formData, "decision_role"),
    qualification_status: textValue(formData, "qualification_status"),
    next_contact_at: dateTimeValue(formData, "next_contact_at"),
    updated_by: userId,
    ...statusTimestampPatch(status),
  }

  if (opportunityId) {
    const { error } = await supabase
      .from("crm_opportunities")
      .update(payload)
      .eq("id", opportunityId)

    if (error) {
      throw error
    }

    revalidateCRMPaths(opportunityId)
    redirect(`/crm/oportunidades/${opportunityId}`)
  }

  const { data, error } = await supabase
    .from("crm_opportunities")
    .insert({ ...payload, created_by: userId })
    .select("id")
    .single()

  if (error) {
    throw error
  }

  const created = data as { id: string }
  revalidateCRMPaths(created.id)
  redirect(`/crm/oportunidades/${created.id}`)
}

export async function updateOpportunityStatusAction(formData: FormData) {
  const opportunityId = requiredText(formData, "opportunity_id")
  const status = statusValue(formData)
  const target = redirectTarget(formData, "/crm/oportunidades")
  const { supabase, userId } = await getActionContext(target)
  const nextContactAt = dateTimeValue(formData, "next_contact_at")

  const { error } = await supabase
    .from("crm_opportunities")
    .update({
      status,
      next_contact_at: nextContactAt,
      updated_by: userId,
      ...statusTimestampPatch(status),
    })
    .eq("id", opportunityId)

  if (error) {
    throw error
  }

  revalidateCRMPaths(opportunityId)
  redirect(target)
}

export async function saveOpportunityActivityAction(formData: FormData) {
  const opportunityId = requiredText(formData, "opportunity_id")
  const target = redirectTarget(formData, `/crm/oportunidades/${opportunityId}#contactos`)
  const { supabase, userId } = await getActionContext(`/crm/oportunidades/${opportunityId}`)
  const nextContactAt = dateTimeValue(formData, "next_contact_at")
  const contactAt = dateTimeValue(formData, "contact_at") ?? new Date().toISOString()

  const { data: opportunityData, error: opportunityError } = await supabase
    .from("crm_opportunities")
    .select("status")
    .eq("id", opportunityId)
    .single()

  if (opportunityError) {
    throw opportunityError
  }

  const { error } = await supabase.from("crm_opportunity_activities").insert({
    opportunity_id: opportunityId,
    activity_type: activityTypeValue(formData),
    contact_at: contactAt,
    next_contact_at: nextContactAt,
    temperature: numberValue(formData, "temperature"),
    notes: textValue(formData, "notes"),
    contact_person: textValue(formData, "contact_person"),
    contact_role: textValue(formData, "contact_role"),
    contact_value: textValue(formData, "contact_value"),
    owner: textValue(formData, "owner"),
    source_kind: "manual",
    created_by: userId,
    updated_by: userId,
  })

  if (error) {
    throw error
  }

  const currentStatus = (opportunityData as { status: OpportunityStatus }).status
  const statusPatch = currentStatus === "new" ? { status: "contacted" as const } : {}
  const { error: updateError } = await supabase
    .from("crm_opportunities")
    .update({
      next_contact_at: nextContactAt,
      updated_by: userId,
      ...statusPatch,
    })
    .eq("id", opportunityId)

  if (updateError) {
    throw updateError
  }

  revalidateCRMPaths(opportunityId)
  redirect(target)
}

export async function createOpportunityTeamsMeetingAction(formData: FormData) {
  const opportunityId = requiredText(formData, "opportunity_id")
  const target = redirectTarget(formData, `/crm/oportunidades/${opportunityId}#gestion`)
  const { supabase, userId } = await getActionContext(`/crm/oportunidades/${opportunityId}`)
  const meetingKind = meetingKindValue(formData)
  const subject = requiredText(formData, "subject")
  const startLocal = graphLocalDateTimeValue(formData, "starts_at")
  const startDate = new Date(startLocal)
  const durationMinutes = Math.min(Math.max(integerValue(formData, "duration_minutes", 45), 15), 240)
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000)
  const endLocal = localInputFromDate(endDate)
  const attendees = parseAttendees(textValue(formData, "attendees"))
  const notes = textValue(formData, "notes")

  if (!attendees.length) {
    throw new Error("Anade al menos un asistente con email para crear la reunion.")
  }

  const { data: opportunityData, error: opportunityError } = await supabase
    .from("crm_opportunities")
    .select("id, company_name, contact_name, contact_email, status")
    .eq("id", opportunityId)
    .single()

  if (opportunityError) {
    throw opportunityError
  }

  const opportunity = opportunityData as {
    company_name: string
    contact_name: string | null
    contact_email: string | null
    status: OpportunityStatus
  }
  const bodyParts = [
    `<p><strong>Oportunidad:</strong> ${escapeHtml(opportunity.company_name)}</p>`,
    opportunity.contact_name ? `<p><strong>Contacto:</strong> ${escapeHtml(opportunity.contact_name)}</p>` : "",
    notes ? `<p>${escapeHtml(notes).replaceAll("\n", "<br />")}</p>` : "",
  ].filter(Boolean)
  const createdEvent = await createTeamsCalendarEvent(userId, {
    subject,
    bodyHtml: bodyParts.join("\n"),
    startLocal,
    endLocal,
    attendees,
  })
  const config = getMicrosoftGraphConfig()
  const microsoftConnection = await getMicrosoftConnectionStatus(userId)
  const startsAt = startDate.toISOString()
  const endsAt = endDate.toISOString()

  const { error: meetingError } = await supabase.from("crm_opportunity_meetings").insert({
    opportunity_id: opportunityId,
    organizer_user_id: userId,
    organizer_email: microsoftConnection.email,
    subject,
    meeting_kind: meetingKind,
    starts_at: startsAt,
    ends_at: endsAt,
    time_zone: config.timeZone,
    attendees,
    notes,
    graph_event_id: createdEvent.id,
    graph_ical_uid: createdEvent.iCalUId,
    teams_join_url: createdEvent.joinUrl,
    web_link: createdEvent.webLink,
    status: "scheduled",
    graph_raw: createdEvent.raw,
    created_by: userId,
    updated_by: userId,
  })

  if (meetingError) {
    throw meetingError
  }

  const { error: activityError } = await supabase.from("crm_opportunity_activities").insert({
    opportunity_id: opportunityId,
    activity_type: "meeting_online",
    contact_at: startsAt,
    next_contact_at: null,
    notes: [notes, createdEvent.joinUrl ? `Teams: ${createdEvent.joinUrl}` : ""].filter(Boolean).join("\n"),
    contact_person: opportunity.contact_name,
    contact_value: attendees.map((attendee) => attendee.email).join(", "),
    owner: null,
    source_kind: "manual",
    created_by: userId,
    updated_by: userId,
  })

  if (activityError) {
    throw activityError
  }

  const shouldMarkDiagnosis = meetingKind === "diagnosis" && !["closed_won", "closed_lost", "disqualified"].includes(opportunity.status)
  const { error: updateError } = await supabase
    .from("crm_opportunities")
    .update({
      next_contact_at: startsAt,
      updated_by: userId,
      ...(shouldMarkDiagnosis ? { status: "diagnosis_booked" as const, diagnosis_booked_at: startsAt } : {}),
    })
    .eq("id", opportunityId)

  if (updateError) {
    throw updateError
  }

  revalidateCRMPaths(opportunityId)
  redirect(target)
}

export async function closeOpportunityAction(formData: FormData) {
  const opportunityId = requiredText(formData, "opportunity_id")
  const closeStatus = statusValue(formData, "close_status")
  if (!["closed_won", "closed_lost", "disqualified"].includes(closeStatus)) {
    throw new Error("Invalid close status.")
  }

  const { supabase, userId } = await getActionContext(`/crm/oportunidades/${opportunityId}`)
  const now = new Date().toISOString()
  const payload = {
    status: closeStatus,
    closed_at: now,
    closed_outcome: closeStatus === "closed_won" ? "won" : closeStatus === "closed_lost" ? "lost" : null,
    disqualified_at: closeStatus === "disqualified" ? now : null,
    disqualification_reason: closeStatus === "disqualified" ? textValue(formData, "close_note") : null,
    closed_lost_reason: closeStatus === "closed_lost" ? textValue(formData, "close_reason") : null,
    closed_lost_note: closeStatus === "closed_lost" ? textValue(formData, "close_note") : null,
    updated_by: userId,
  }

  const { error } = await supabase
    .from("crm_opportunities")
    .update(payload)
    .eq("id", opportunityId)

  if (error) {
    throw error
  }

  revalidateCRMPaths(opportunityId)
  redirect(`/crm/oportunidades/${opportunityId}`)
}
