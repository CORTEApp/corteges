import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function PageHeader({
  title,
  subtitle,
  actions,
  icon,
  className,
  innerClassName,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  icon?: ReactNode
  className?: string
  innerClassName?: string
}) {
  return (
    <div className={cn("sticky top-0 z-20 px-4 py-4 sm:px-6", className)}>
      <div className={cn("mx-auto max-w-[var(--layout-max-width)]", innerClassName)}>
        <div className="relative overflow-hidden rounded-[var(--radius-shell)] border border-border/75 bg-[color:var(--surface-1)]/95 px-5 py-5 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent" aria-hidden />
          <div className="absolute -right-10 -top-10 h-28 w-28 rounded-[var(--radius-round)] bg-primary/10 blur-3xl" aria-hidden />
          <div className="absolute left-12 top-0 h-16 w-16 rounded-[var(--radius-round)] bg-accent/10 blur-2xl" aria-hidden />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radius-panel)] border border-primary/15 bg-primary/10 text-primary shadow-sm [&_svg]:size-[2.7rem]">
                {icon ?? <span className="text-2xl font-semibold">{title.slice(0, 1)}</span>}
              </div>
              <div className="space-y-1">
                <h1 className="text-[1.85rem] font-semibold leading-tight tracking-tight">{title}</h1>
                {subtitle ? <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{subtitle}</p> : null}
              </div>
            </div>
            {actions ? <div className="flex flex-wrap gap-2 lg:justify-end">{actions}</div> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
