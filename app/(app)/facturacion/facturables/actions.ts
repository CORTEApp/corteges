"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import {
  BILLING_FACTURABLE_TYPES,
  BILLING_FACTURABLE_UNITS,
  type BillingFacturableType,
  type BillingFacturableUnit,
} from "@/lib/billing/types"
import { requireBillingUser } from "@/lib/billing/data"
import { createClient } from "@/lib/supabase/server"

const TYPE_VALUES = new Set<string>(BILLING_FACTURABLE_TYPES)
const UNIT_VALUES = new Set<string>(BILLING_FACTURABLE_UNITS)

function normalizeCode(value: string) {
  return value.trim().toUpperCase()
}

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
    throw new Error(`Valor numérico inválido: ${key}`)
  }

  return parsed
}

function facturableTypeValue(formData: FormData): BillingFacturableType {
  const value = textValue(formData, "type") ?? "Otro"
  return TYPE_VALUES.has(value) ? (value as BillingFacturableType) : "Otro"
}

function unitTypeValue(formData: FormData): BillingFacturableUnit {
  const value = textValue(formData, "unit_type") ?? "Unidad"
  return UNIT_VALUES.has(value) ? (value as BillingFacturableUnit) : "Unidad"
}

async function getActionContext(nextPath: string) {
  const supabase = await createClient()
  const user = await requireBillingUser(supabase, nextPath)
  return { supabase, userId: user.id }
}

async function assertUniqueFacturableCode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  code: string,
  facturableId: string | null,
) {
  let query = supabase
    .from("billing_facturables")
    .select("id, code")
    .limit(1000)

  if (facturableId) {
    query = query.neq("id", facturableId)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  const normalizedCode = normalizeCode(code)
  const duplicate = (data ?? []).some((row) => normalizeCode(row.code ?? "") === normalizedCode)

  if (duplicate) {
    throw new Error(`Ya existe un facturable con la denominación ${code}.`)
  }
}

export async function saveFacturableAction(formData: FormData) {
  const facturableId = textValue(formData, "facturable_id")
  const { supabase, userId } = await getActionContext(
    facturableId ? `/facturacion/facturables/${facturableId}/edit` : "/facturacion/facturables/nuevo",
  )

  const code = normalizeCode(requiredText(formData, "code"))
  await assertUniqueFacturableCode(supabase, code, facturableId)

  const payload = {
    code,
    description: requiredText(formData, "description"),
    type: facturableTypeValue(formData),
    unit_price: numberValue(formData, "unit_price", 0),
    unit_type: unitTypeValue(formData),
    comments: textValue(formData, "comments"),
    active: formData.get("active") === "on",
    is_current: formData.get("is_current") === "on",
    updated_by: userId,
  }

  if (facturableId) {
    const { error } = await supabase
      .from("billing_facturables")
      .update(payload)
      .eq("id", facturableId)

    if (error) {
      throw error
    }

    revalidatePath("/facturacion/facturables")
    revalidatePath(`/facturacion/facturables/${facturableId}`)
    revalidatePath(`/facturacion/facturables/${facturableId}/edit`)
    redirect(`/facturacion/facturables/${facturableId}`)
  }

  const { data, error } = await supabase
    .from("billing_facturables")
    .insert({ ...payload, created_by: userId })
    .select("id")
    .single()

  if (error) {
    throw error
  }

  const created = data as { id: string }
  revalidatePath("/facturacion/facturables")
  redirect(`/facturacion/facturables/${created.id}`)
}

export async function deactivateFacturableAction(formData: FormData) {
  const facturableId = requiredText(formData, "facturable_id")
  const { supabase, userId } = await getActionContext(`/facturacion/facturables/${facturableId}`)

  const { error } = await supabase
    .from("billing_facturables")
    .update({ active: false, updated_by: userId })
    .eq("id", facturableId)

  if (error) {
    throw error
  }

  revalidatePath("/facturacion/facturables")
  revalidatePath(`/facturacion/facturables/${facturableId}`)
  redirect(`/facturacion/facturables/${facturableId}`)
}
