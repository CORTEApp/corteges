"use client"

import { useFormStatus } from "react-dom"

import { FullScreenLoading } from "@/components/ui/full-screen-loading"

export function FormPendingScreen({
  label = "Procesando...",
  description = "Guardando cambios y actualizando la ficha.",
  delayMs = 300,
}: {
  label?: string
  description?: string
  delayMs?: number
}) {
  const { pending } = useFormStatus()

  return <FullScreenLoading active={pending} delayMs={delayMs} description={description} label={label} />
}
