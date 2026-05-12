"use client"

import { useFormStatus } from "react-dom"

export function FormLoadingOverlay({ label = "Guardando..." }: { label?: string }) {
  const { pending } = useFormStatus()

  if (!pending) {
    return null
  }

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[var(--radius-panel)] bg-[color:var(--surface-1)]/70 text-sm font-medium text-foreground shadow-inner backdrop-blur-sm">
      {label}
    </div>
  )
}
