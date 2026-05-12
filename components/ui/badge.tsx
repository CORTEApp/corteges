export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "warning" | "danger" | "info"
  children: React.ReactNode
}) {
  const map = {
    neutral: "border border-border/70 bg-[color:var(--surface-2)] text-foreground/80",
    success: "border border-primary/15 bg-primary/10 text-primary",
    warning: "border border-amber-200/70 bg-amber-50 text-amber-700",
    danger: "border border-red-200/70 bg-red-50 text-red-700",
    info: "border border-primary/15 bg-primary/10 text-primary",
  } as const

  return (
    <span className={`inline-flex items-center rounded-[var(--radius-pill)] px-2.5 py-1 text-[0.72rem] font-semibold tracking-wide ${map[tone]}`}>
      {children}
    </span>
  )
}
