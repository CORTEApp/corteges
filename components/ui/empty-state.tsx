export function EmptyState({
  title,
  description,
  actions,
}: {
  title: string
  description: string
  actions?: React.ReactNode
}) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-dashed border-border bg-card p-10 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      {actions ? <div className="mt-4 flex justify-center">{actions}</div> : null}
    </div>
  )
}
