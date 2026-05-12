"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireAppUser } from "@/lib/clients/data"
import { disconnectMicrosoftConnection } from "@/lib/microsoft/graph"
import { createClient } from "@/lib/supabase/server"

function textValue(formData: FormData, key: string) {
  const value = formData.get(key)
  if (typeof value !== "string") {
    return null
  }
  const trimmed = value.trim()
  return trimmed || null
}

function redirectTarget(formData: FormData) {
  const target = textValue(formData, "redirect_to")
  if (!target || !target.startsWith("/") || target.startsWith("//")) {
    return "/perfil"
  }
  return target
}

export async function disconnectMicrosoftAction(formData: FormData) {
  const target = redirectTarget(formData)
  const supabase = await createClient()
  const user = await requireAppUser(supabase, target)

  await disconnectMicrosoftConnection(user.id)
  revalidatePath("/perfil")
  revalidatePath("/crm/oportunidades")
  redirect(target)
}
