import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function FormSection({
  title,
  description,
  action,
  children,
  footer,
  id,
  className,
  contentClassName,
}: {
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
  children: ReactNode
  footer?: ReactNode
  id?: string
  className?: string
  contentClassName?: string
}) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-shell)] border border-border/80 bg-[color:var(--surface-1)] shadow-[0_18px_40px_-28px_rgba(15,23,42,0.24)] backdrop-blur-sm",
        className,
      )}
      id={id}
    >
      {title || description || action ? (
        <header className="flex flex-col gap-3 border-b border-border/70 px-5 py-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 space-y-1">
            {title ? <h2 className="text-base font-semibold leading-tight tracking-tight">{title}</h2> : null}
            {description ? <p className="text-sm leading-6 text-muted-foreground">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      <div className={cn("px-5 py-5", contentClassName)}>{children}</div>
      {footer ? <footer className="border-t border-border/70 px-5 py-4">{footer}</footer> : null}
    </section>
  )
}
