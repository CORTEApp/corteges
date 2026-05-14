"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Loader2 } from "lucide-react"

export function FullScreenLoading({
  active = true,
  label = "Cargando...",
  description = "Preparando datos y permisos.",
  delayMs = 300,
}: {
  active?: boolean
  label?: string
  description?: string
  delayMs?: number
}) {
  if (!active) {
    return null
  }

  return <DelayedFullScreenLoading key={delayMs} delayMs={delayMs} description={description} label={label} />
}

function DelayedFullScreenLoading({
  label,
  description,
  delayMs,
}: {
  label: string
  description: string
  delayMs: number
}) {
  const [visible, setVisible] = useState(delayMs <= 0)

  useEffect(() => {
    if (delayMs <= 0) {
      return
    }

    const timer = window.setTimeout(() => {
      setVisible(true)
    }, delayMs)

    return () => {
      window.clearTimeout(timer)
    }
  }, [delayMs])

  if (!visible) {
    return null
  }

  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="fixed inset-0 z-[1000] flex min-h-screen items-center justify-center bg-background/90 px-4 text-foreground backdrop-blur-md"
      role="status"
    >
      <div className="relative grid w-full max-w-sm justify-items-center gap-5 rounded-[var(--radius-shell)] border border-border/80 bg-[color:var(--surface-1)]/95 px-6 py-7 text-center shadow-[0_24px_70px_-38px_rgba(15,23,42,0.44)]">
        <span className="flex size-16 items-center justify-center rounded-[var(--radius-shell)] border border-primary/15 bg-primary/10">
          <Image
            alt=""
            aria-hidden="true"
            className="h-11 w-11 object-contain"
            height={44}
            priority
            src="/brand/corteges/logo-mark.svg"
            width={44}
          />
        </span>

        <span className="grid justify-items-center gap-3">
          <Loader2 className="size-6 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
          <span className="grid gap-1">
            <span className="text-base font-semibold leading-tight tracking-tight">{label}</span>
            <span className="text-sm leading-6 text-muted-foreground">{description}</span>
          </span>
        </span>
      </div>
    </div>
  )
}
