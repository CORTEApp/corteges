import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type StatTone = "neutral" | "info" | "success" | "warning" | "danger"

const toneClassName: Record<StatTone, string> = {
  neutral: "border-border/80 bg-[color:var(--surface-1)]",
  info: "border-primary/15 bg-primary/10",
  success: "border-primary/15 bg-primary/10",
  warning: "border-amber-200/70 bg-amber-50",
  danger: "border-red-200/70 bg-red-50",
}

const valueClassName: Record<StatTone, string> = {
  neutral: "text-foreground",
  info: "text-primary",
  success: "text-primary",
  warning: "text-amber-800",
  danger: "text-red-800",
}

export function StatCard({
  label,
  value,
  description,
  icon,
  tone = "neutral",
  className,
}: {
  label: string
  value: ReactNode
  description?: ReactNode
  icon?: ReactNode
  tone?: StatTone
  className?: string
}) {
  return (
    <div
      className={cn(
        "grid min-h-28 gap-3 rounded-[var(--radius-shell)] border p-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.24)]",
        toneClassName[tone],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </div>
        {icon ? <div className="text-primary">{icon}</div> : null}
      </div>
      <div className={cn("text-2xl font-semibold leading-tight tracking-tight", valueClassName[tone])}>
        {value}
      </div>
      {description ? <div className="text-xs leading-5 text-muted-foreground">{description}</div> : null}
    </div>
  )
}
