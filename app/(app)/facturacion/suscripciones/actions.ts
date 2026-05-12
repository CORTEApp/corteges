"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireBillingUser } from "@/lib/billing/data"
import { toNumber } from "@/lib/billing/format"
import { createClient } from "@/lib/supabase/server"

function textValue(formData: FormData, key: string) {
  const value = formData.get(key)
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function requiredText(formData: FormData, key: string) {
  const value = textValue(formData, key)
  if (!value) {
    throw new Error(`Falta el campo obligatorio: ${key}`)
  }
  return value
}

function numberValue(formData: FormData, key: string, fallback: number) {
  const value = textValue(formData, key)
  if (!value) {
    return fallback
  }

  const parsed = Number.parseFloat(value.replace(",", "."))
  if (!Number.isFinite(parsed)) {
    throw new Error(`Valor numerico invalido: ${key}`)
  }

  return parsed
}

function dateValue(formData: FormData, key: string, fallback = new Date().toISOString().slice(0, 10)) {
  const value = textValue(formData, key)
  if (!value) {
    return fallback
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Fecha invalida: ${key}`)
  }

  return value
}

function optionalDateValue(formData: FormData, key: string) {
  const value = textValue(formData, key)
  if (!value) {
    return null
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Fecha invalida: ${key}`)
  }

  return value
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000
}

async function getActionContext(nextPath: string) {
  const supabase = await createClient()
  const user = await requireBillingUser(supabase, nextPath)
  return { supabase, userId: user.id }
}

export async function saveSubscriptionAction(formData: FormData) {
  const subscriptionId = textValue(formData, "subscription_id")
  const { supabase, userId } = await getActionContext(
    subscriptionId ? `/facturacion/suscripciones/${subscriptionId}/edit` : "/facturacion/suscripciones/nuevo",
  )
  const clientId = requiredText(formData, "client_id")
  const facturableId = requiredText(formData, "facturable_id")
  const quantity = numberValue(formData, "quantity", 1)

  if (quantity <= 0) {
    throw new Error("La cantidad debe ser mayor que cero.")
  }

  const [{ data: client, error: clientError }, { data: facturable, error: facturableError }] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, name, tax_id, billing_email")
        .eq("id", clientId)
        .maybeSingle(),
      supabase
        .from("billing_facturables")
        .select("id, code, description, unit_price")
        .eq("id", facturableId)
        .maybeSingle(),
    ])

  if (clientError) {
    throw clientError
  }

  if (facturableError) {
    throw facturableError
  }

  if (!client) {
    throw new Error("Cliente no encontrado.")
  }

  if (!facturable) {
    throw new Error("Facturable no encontrado.")
  }

  const startDate = dateValue(formData, "start_date")
  const endDate = optionalDateValue(formData, "end_date")
  if (endDate && endDate < startDate) {
    throw new Error("La fecha fin no puede ser anterior al inicio.")
  }

  const fallbackTotal = roundMoney(toNumber(facturable.unit_price) * quantity)
  const recurringTotal = numberValue(formData, "recurring_total_amount", fallbackTotal)
  if (recurringTotal < 0) {
    throw new Error("El total recurrente no puede ser negativo.")
  }

  const payload = {
    client_id: client.id,
    client_tax_id: client.tax_id,
    client_name: client.name,
    billing_email: textValue(formData, "billing_email") ?? client.billing_email,
    facturable_id: facturable.id,
    subscription_code: String(facturable.code ?? "").trim().toUpperCase(),
    description: textValue(formData, "description") ?? facturable.description,
    start_date: startDate,
    end_date: endDate,
    quantity,
    recurring_total_amount: roundMoney(recurringTotal),
    currency: "EUR",
    updated_by: userId,
  }

  if (subscriptionId) {
    const { error } = await supabase
      .from("billing_subscriptions")
      .update(payload)
      .eq("id", subscriptionId)

    if (error) {
      throw error
    }

    revalidatePath("/facturacion/suscripciones")
    revalidatePath(`/facturacion/suscripciones/${subscriptionId}`)
    revalidatePath(`/facturacion/suscripciones/${subscriptionId}/edit`)
    redirect(`/facturacion/suscripciones/${subscriptionId}`)
  }

  const { data, error } = await supabase
    .from("billing_subscriptions")
    .insert({ ...payload, created_by: userId })
    .select("id")
    .single()

  if (error) {
    throw error
  }

  const created = data as { id: string }
  revalidatePath("/facturacion/suscripciones")
  redirect(`/facturacion/suscripciones/${created.id}`)
}

export async function finishSubscriptionAction(formData: FormData) {
  const subscriptionId = requiredText(formData, "subscription_id")
  const endDate = dateValue(formData, "end_date")
  const { supabase, userId } = await getActionContext(`/facturacion/suscripciones/${subscriptionId}`)

  const { data: subscription, error: subscriptionError } = await supabase
    .from("billing_subscriptions")
    .select("id, start_date")
    .eq("id", subscriptionId)
    .maybeSingle()

  if (subscriptionError) {
    throw subscriptionError
  }

  if (!subscription) {
    throw new Error("Suscripcion no encontrada.")
  }

  if (endDate < subscription.start_date) {
    throw new Error("La fecha fin no puede ser anterior al inicio.")
  }

  const { error } = await supabase
    .from("billing_subscriptions")
    .update({ end_date: endDate, updated_by: userId })
    .eq("id", subscriptionId)

  if (error) {
    throw error
  }

  revalidatePath("/facturacion/suscripciones")
  revalidatePath(`/facturacion/suscripciones/${subscriptionId}`)
  redirect(`/facturacion/suscripciones/${subscriptionId}`)
}
