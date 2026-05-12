import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { isValidElement } from "react"

import { cn } from "@/lib/utils"

function hasVisibleValue(value: ReactNode): boolean {
  if (value === null || value === undefined || value === false) return false
  if (typeof value === "string") return value.trim().length > 0
  if (typeof value === "number" || typeof value === "bigint") return true
  if (Array.isArray(value)) return value.some((item) => hasVisibleValue(item))
  if (isValidElement(value)) return true
  return Boolean(value)
}

export function MobileRecordCard({
  eyebrow,
  title,
  subtitle,
  headerSlot,
  footer,
  children,
  className,
  ...props
}: {
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  headerSlot?: ReactNode
  footer?: ReactNode
  children?: ReactNode
  className?: string
} & Omit<ComponentPropsWithoutRef<"article">, "children" | "title">) {
  return (
    <article
      {...props}
      className={cn(
        "rounded-[var(--radius-panel)] border border-border/70 bg-[color:var(--surface-2)]/58 px-4 py-4 shadow-[0_1px_0_rgba(15,23,42,0.03)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {hasVisibleValue(eyebrow) ? (
            <div className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-primary/75">{eyebrow}</div>
          ) : null}
          <div className="break-words font-semibold tracking-tight text-foreground">{title}</div>
          {hasVisibleValue(subtitle) ? <div className="text-sm text-muted-foreground">{subtitle}</div> : null}
        </div>
        {hasVisibleValue(headerSlot) ? <div className="shrink-0">{headerSlot}</div> : null}
      </div>

      {children ? <div className="mt-4 space-y-4">{children}</div> : null}
      {hasVisibleValue(footer) ? <div className="mt-4">{footer}</div> : null}
    </article>
  )
}

export function MobileRecordGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-3 text-sm text-foreground/85", className)}>{children}</div>
}

export function MobileRecordField({
  label,
  value,
  className,
  valueClassName,
}: {
  label: ReactNode
  value: ReactNode
  className?: string
  valueClassName?: string
}) {
  if (!hasVisibleValue(value)) return null

  return (
    <div className={className}>
      <div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className={cn("mt-1 break-words", valueClassName)}>{value}</div>
    </div>
  )
}

export function MobileRecordActions({ children, className }: { children: ReactNode; className?: string }) {
  if (!hasVisibleValue(children)) return null
  return <div className={cn("grid gap-2", className)}>{children}</div>
}
