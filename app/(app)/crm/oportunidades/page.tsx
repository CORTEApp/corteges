import Link from "next/link"
import type { ReactNode } from "react"
import { Activity, CircleDollarSign, Plus, Target, UsersRound } from "lucide-react"

import {
  OpportunityBoard,
  OpportunityFiltersBar,
} from "@/app/(app)/crm/oportunidades/_components/opportunity-board"
import { ResourceListScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"
import {
  formatOpportunityMoney,
  isOpportunityClosed,
  opportunityStatuses,
} from "@/lib/crm/format"
import { listCRMOpportunities } from "@/lib/crm/data"
import type { CRMOpportunityFilters } from "@/lib/crm/types"

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function CRMOpportunitiesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const rawStatus = one(params.status)
  const filters: CRMOpportunityFilters = {
    q: one(params.q),
    status: rawStatus && opportunityStatuses.includes(rawStatus as never) ? (rawStatus as CRMOpportunityFilters["status"]) : "all",
    owner: one(params.owner) ?? "all",
    source: one(params.source) ?? "all",
    upcoming: (one(params.upcoming) as CRMOpportunityFilters["upcoming"]) ?? "all",
    closed: (one(params.closed) as CRMOpportunityFilters["closed"]) ?? "open",
  }
  const { opportunities, owners, sources } = await listCRMOpportunities(filters)
  const openCount = opportunities.filter((opportunity) => !isOpportunityClosed(opportunity.status)).length
  const proposalCount = opportunities.filter((opportunity) => opportunity.status === "proposal_sent").length
  const diagnosisCount = opportunities.filter((opportunity) => opportunity.status.startsWith("diagnosis")).length
  const visiblePipeline = opportunities.reduce((sum, opportunity) => sum + (opportunity.initial_price ?? 0), 0)
  const metrics = [
    { label: "Visibles", value: String(opportunities.length), detail: "Filtro actual", icon: <Target className="size-4" aria-hidden="true" /> },
    { label: "Abiertas", value: String(openCount), icon: <Activity className="size-4" aria-hidden="true" /> },
    { label: "Diag. / Prop.", value: `${diagnosisCount} / ${proposalCount}`, icon: <UsersRound className="size-4" aria-hidden="true" /> },
    { label: "Pipeline", value: formatOpportunityMoney(visiblePipeline), tone: "success" as const, icon: <CircleDollarSign className="size-4" aria-hidden="true" /> },
  ]

  return (
    <ResourceListScreen
      header={{
        icon: <Target className="size-6" aria-hidden="true" />,
        title: "Oportunidades",
        subtitle: "Pipeline comercial con oportunidades de Potenciales y contactos historicos de Prospectos.",
        actions: (
          <Button asChild>
            <Link href="/crm/oportunidades/nuevo">
              <Plus aria-hidden="true" />
              Nueva oportunidad
            </Link>
          </Button>
        ),
      }}
      className="px-4 sm:px-6"
      contentClassName="max-w-[min(100%,132rem)] gap-5"
      headerInnerClassName="max-w-[min(100%,132rem)]"
    >
      <div className="grid gap-5">
        <OpportunityMetricsStrip metrics={metrics} />
        <div className="grid gap-5 xl:grid-cols-[18.5rem_minmax(0,1fr)]">
          <OpportunityFiltersBar filters={filters} owners={owners} sources={sources} />
          <OpportunityBoard opportunities={opportunities} />
        </div>
      </div>
    </ResourceListScreen>
  )
}

function OpportunityMetricsStrip({
  metrics,
}: {
  metrics: {
    label: string
    value: ReactNode
    detail?: ReactNode
    icon?: ReactNode
    tone?: "success"
  }[]
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="grid min-h-20 grid-cols-[1fr_auto] items-start gap-2 rounded-[var(--radius-panel)] border border-border/75 bg-[color:var(--surface-1)] px-4 py-3 shadow-[0_14px_32px_-28px_rgba(15,23,42,0.28)]"
        >
          <div className="min-w-0">
            <div className="truncate text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {metric.label}
            </div>
            <div className={metric.tone === "success" ? "mt-2 text-xl font-bold text-primary" : "mt-2 text-xl font-bold text-foreground"}>
              {metric.value}
            </div>
            {metric.detail ? <div className="mt-1 text-xs text-muted-foreground">{metric.detail}</div> : null}
          </div>
          {metric.icon ? <div className="text-primary/85">{metric.icon}</div> : null}
        </div>
      ))}
    </div>
  )
}
