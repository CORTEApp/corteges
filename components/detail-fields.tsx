import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function DetailFieldGrid({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <dl className={cn("grid gap-3 md:grid-cols-2 xl:grid-cols-3", className)}>{children}</dl>
}

export function DetailField({
  label,
  value,
  className,
}: {
  label: string
  value: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "grid gap-1 rounded-[var(--radius-panel)] border border-border/70 bg-[color:var(--surface-2)]/70 px-3 py-3",
        className,
      )}
    >
      <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-semibold text-foreground">{value || "-"}</dd>
    </div>
  )
}

export function DetailTextBlock({
  label,
  value,
  className,
}: {
  label: string
  value: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "grid gap-2 rounded-[var(--radius-panel)] border border-border/70 bg-[color:var(--surface-2)]/70 px-4 py-4",
        className,
      )}
    >
      <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{value || "-"}</div>
    </div>
  )
}
