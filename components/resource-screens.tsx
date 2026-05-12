import type { ReactNode } from "react"

import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"
import { cn } from "@/lib/utils"

type ResourceMetric = {
  label: string
  value: ReactNode
  description?: ReactNode
  icon?: ReactNode
  tone?: "neutral" | "info" | "success" | "warning" | "danger"
}

type ResourceHeader = {
  title: string
  subtitle?: string
  icon?: ReactNode
  actions?: ReactNode
}

type ResourceScreenProps = {
  header: ResourceHeader
  metrics?: ResourceMetric[]
  children: ReactNode
  className?: string
  contentClassName?: string
  headerInnerClassName?: string
}

function ResourceShell({
  metrics,
  children,
  className,
  contentClassName,
}: {
  metrics?: ResourceMetric[]
  children: ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <main className={cn("space-y-6 p-6", className)}>
      <div className={cn("mx-auto grid max-w-[var(--layout-max-width)] gap-6", contentClassName)}>
        {metrics?.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <StatCard
                key={metric.label}
                description={metric.description}
                icon={metric.icon}
                label={metric.label}
                tone={metric.tone}
                value={metric.value}
              />
            ))}
          </div>
        ) : null}
        {children}
      </div>
    </main>
  )
}

export function ResourceListScreen({ header, metrics, children, className, contentClassName, headerInnerClassName }: ResourceScreenProps) {
  return (
    <>
      <PageHeader {...header} innerClassName={headerInnerClassName} />
      <ResourceShell className={className} contentClassName={contentClassName} metrics={metrics}>
        {children}
      </ResourceShell>
    </>
  )
}

export function ResourceDetailScreen({ header, metrics, children, className, contentClassName, headerInnerClassName }: ResourceScreenProps) {
  return (
    <>
      <PageHeader {...header} innerClassName={headerInnerClassName} />
      <ResourceShell className={className} contentClassName={contentClassName} metrics={metrics}>
        {children}
      </ResourceShell>
    </>
  )
}

export function ResourceEditScreen({ header, metrics, children, className, contentClassName, headerInnerClassName }: ResourceScreenProps) {
  return (
    <>
      <PageHeader {...header} innerClassName={headerInnerClassName} />
      <ResourceShell className={className} contentClassName={contentClassName} metrics={metrics}>
        {children}
      </ResourceShell>
    </>
  )
}
