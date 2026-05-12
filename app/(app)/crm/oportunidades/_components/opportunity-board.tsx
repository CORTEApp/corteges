"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, CalendarClock, Mail, Phone, UserRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { FilterSidebarCard } from "@/components/ui/filter-sidebar-card"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import {
  formatOpportunityDateTime,
  formatOpportunityMoney,
  closedOpportunityBoardColumns,
  openOpportunityBoardColumns,
  opportunityStatusLabels,
  opportunityStatuses,
  opportunityStatusTone,
} from "@/lib/crm/format"
import type { CRMOpportunityFilters, CRMOpportunityListItem } from "@/lib/crm/types"
import { cn } from "@/lib/utils"

type BoardMode = "open" | "closed"

const compactStatusLabels = {
  new: "Nueva",
  contacted: "Contact.",
  qualified: "Cualif.",
  diagnosis_booked: "Diag. ag.",
  diagnosis_attended: "Diag. hecho",
  proposal_sent: "Propuesta",
  closed_won: "Ganada",
  closed_lost: "Perdida",
  disqualified: "Desc.",
} satisfies Record<CRMOpportunityListItem["status"], string>

export function OpportunityFiltersBar({
  filters,
  owners,
  sources,
}: {
  filters: CRMOpportunityFilters
  owners: string[]
  sources: string[]
}) {
  return (
    <FilterSidebarCard
      title="Filtros"
      description="Busqueda, responsables, origen y proximos contactos."
    >
      <form className="space-y-4" method="get">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-foreground">Buscar</span>
          <Input name="q" defaultValue={filters.q ?? ""} placeholder="Empresa, contacto, telefono..." />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-foreground">Estado</span>
          <Select
            name="status"
            defaultValue={filters.status ?? "all"}
            options={[
              { value: "all", label: "Todos" },
              ...opportunityStatuses.map((status) => ({
                value: status,
                label: opportunityStatusLabels[status],
              })),
            ]}
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-foreground">Responsable</span>
          <Select
            name="owner"
            defaultValue={filters.owner ?? "all"}
            options={[
              { value: "all", label: "Todos" },
              ...owners.map((owner) => ({ value: owner, label: owner })),
            ]}
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-foreground">Origen</span>
          <Select
            name="source"
            defaultValue={filters.source ?? "all"}
            options={[
              { value: "all", label: "Todos" },
              ...sources.map((source) => ({ value: source, label: source })),
            ]}
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-foreground">Proximos contactos</span>
          <Select
            name="upcoming"
            defaultValue={filters.upcoming ?? "all"}
            options={[
              { value: "all", label: "Todos" },
              { value: "overdue", label: "Vencidos" },
              { value: "today", label: "Hoy" },
              { value: "next7", label: "Proximos 7 dias" },
              { value: "none", label: "Sin fecha" },
            ]}
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-foreground">Tipo</span>
          <Select
            name="closed"
            defaultValue={filters.closed ?? "open"}
            options={[
              { value: "open", label: "Abiertas" },
              { value: "closed", label: "Cerradas" },
              { value: "all", label: "Todas" },
            ]}
          />
        </label>

        <div className="flex gap-2 pt-1">
          <Button className="flex-1" type="submit">
            Aplicar
          </Button>
          <Button asChild className="flex-1" variant="outline">
            <Link href="/crm/oportunidades">Limpiar</Link>
          </Button>
        </div>
      </form>
    </FilterSidebarCard>
  )
}

export function OpportunityBoard({
  opportunities,
}: {
  opportunities: CRMOpportunityListItem[]
}) {
  const [mode, setMode] = useState<BoardMode>("open")
  const openStatuses = useMemo(
    () => new Set(openOpportunityBoardColumns.flatMap((column) => column.statuses)),
    [],
  )
  const closedStatuses = useMemo(
    () => new Set(closedOpportunityBoardColumns.flatMap((column) => column.statuses)),
    [],
  )
  const openCount = opportunities.filter((opportunity) => openStatuses.has(opportunity.status)).length
  const closedCount = opportunities.filter((opportunity) => closedStatuses.has(opportunity.status)).length
  const activeColumns = mode === "open" ? openOpportunityBoardColumns : closedOpportunityBoardColumns

  return (
    <div className="rounded-[var(--radius-shell)] border border-border/70 bg-[color:var(--surface-1)]/60 p-2 shadow-[0_20px_54px_-42px_rgba(15,23,42,0.22)]">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-1 pb-2">
        <div className="inline-flex rounded-[var(--radius-panel)] border border-border/75 bg-[color:var(--surface-2)]/70 p-1">
          <BoardModeButton
            count={openCount}
            label="Abiertas"
            mode="open"
            selected={mode === "open"}
            onSelect={setMode}
          />
          <BoardModeButton
            count={closedCount}
            label="Cerradas"
            mode="closed"
            selected={mode === "closed"}
            onSelect={setMode}
          />
        </div>
        <div className="text-xs text-muted-foreground">
          {mode === "open" ? "Pipeline activo" : "Historico cerrado"}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div
          className={cn(
            "grid gap-3",
            mode === "open"
              ? "min-w-[calc(5*17.5rem+4*0.75rem)] grid-cols-[repeat(5,minmax(17.5rem,1fr))]"
              : "min-w-[calc(2*17.5rem+1*0.75rem)] grid-cols-[repeat(2,minmax(17.5rem,1fr))] xl:max-w-[42rem]",
          )}
        >
        {activeColumns.map((column) => {
          const columnItems = opportunities.filter((opportunity) => column.statuses.includes(opportunity.status))
          return (
            <section
              key={column.id}
              className="grid min-h-[32rem] grid-rows-[auto_1fr] overflow-hidden rounded-[var(--radius-panel)] border border-border/75 bg-[color:var(--surface-2)]/35"
            >
              <header className="flex min-h-16 items-center justify-between gap-3 border-b border-border/65 bg-[color:var(--surface-1)]/85 px-3.5 py-3">
                <div className="min-w-0">
                  <h2 className="truncate text-[0.86rem] font-bold text-foreground">{column.label}</h2>
                  <p className="text-[0.72rem] text-muted-foreground">{columnItems.length} oportunidades</p>
                </div>
                <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-border/75 bg-[color:var(--surface-2)] text-[0.7rem] font-semibold text-foreground/75">
                  {columnItems.length}
                </span>
              </header>
              <div className="space-y-3 p-2.5">
                {columnItems.length ? (
                  columnItems.map((opportunity) => (
                    <OpportunityCard key={opportunity.id} opportunity={opportunity} />
                  ))
                ) : (
                  <div className="rounded-[var(--radius-panel)] border border-dashed border-border/65 bg-[color:var(--surface-1)]/45 px-3 py-8 text-center text-sm text-muted-foreground">
                    Sin oportunidades
                  </div>
                )}
              </div>
            </section>
          )
        })}
        </div>
      </div>
    </div>
  )
}

function BoardModeButton({
  count,
  label,
  mode,
  selected,
  onSelect,
}: {
  count: number
  label: string
  mode: BoardMode
  selected: boolean
  onSelect: (mode: BoardMode) => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(mode)}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-[var(--radius-control)] px-3 text-sm font-semibold transition",
        selected
          ? "bg-primary text-white shadow-sm shadow-primary/20"
          : "text-foreground/70 hover:bg-[color:var(--surface-1)] hover:text-foreground",
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[0.68rem]",
          selected ? "bg-white/20 text-white" : "bg-[color:var(--surface-1)] text-foreground/70",
        )}
      >
        {count}
      </span>
    </button>
  )
}

function OpportunityCard({ opportunity }: { opportunity: CRMOpportunityListItem }) {
  const contact = opportunity.contact_name ?? opportunity.contact_email ?? opportunity.contact_phone
  const hasNext = Boolean(opportunity.next_contact_at)

  return (
    <Card className="overflow-hidden rounded-[var(--radius-panel)] border-border/75 bg-[color:var(--surface-1)] shadow-[0_12px_28px_-26px_rgba(15,23,42,0.35)] transition-colors hover:border-primary/20">
      <CardContent className="space-y-3 p-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
          <div className="min-w-0 pr-1">
            <Link
              href={`/crm/oportunidades/${opportunity.id}`}
              className="line-clamp-2 text-[0.92rem] font-bold leading-5 text-foreground hover:text-primary"
            >
              {opportunity.company_name}
            </Link>
            {contact ? (
              <p className="mt-1 truncate text-xs text-muted-foreground" title={contact}>
                {contact}
              </p>
            ) : null}
          </div>
          <BoardStatusPill status={opportunity.status} />
        </div>

        <div className="grid gap-1.5 text-xs text-muted-foreground">
          {opportunity.contact_phone ? (
            <a className="inline-flex min-w-0 items-center gap-1.5 hover:text-primary" href={`tel:${opportunity.contact_phone}`} title={opportunity.contact_phone}>
              <Phone className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{opportunity.contact_phone}</span>
            </a>
          ) : null}
          {opportunity.contact_email ? (
            <a className="inline-flex min-w-0 items-center gap-1.5 hover:text-primary" href={`mailto:${opportunity.contact_email}`} title={opportunity.contact_email}>
              <Mail className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate break-all">{opportunity.contact_email}</span>
            </a>
          ) : null}
          <span className={cn("inline-flex items-center gap-1.5", hasNext ? "text-foreground" : "")}>
            <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{hasNext ? formatOpportunityDateTime(opportunity.next_contact_at) : "Sin proximo contacto"}</span>
          </span>
          {opportunity.owner ? (
            <span className="inline-flex min-w-0 items-center gap-1.5" title={opportunity.owner}>
              <UserRound className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{opportunity.owner}</span>
            </span>
          ) : null}
        </div>

        {opportunity.request ? (
          <p className="line-clamp-2 rounded-[var(--radius-panel)] bg-[color:var(--surface-2)]/55 px-3 py-2 text-xs leading-5 text-foreground/80">
            {opportunity.request}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-foreground">{formatOpportunityMoney(opportunity.initial_price)}</span>
          <span className="text-muted-foreground">{opportunity.activity_count} contactos</span>
        </div>

        <Button asChild className="w-full" size="sm" variant="outline">
          <Link href={`/crm/oportunidades/${opportunity.id}`}>
            Gestionar
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function BoardStatusPill({ status }: { status: CRMOpportunityListItem["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-24 shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-2 py-1 text-[0.68rem] font-semibold leading-none",
        opportunityStatusTone(status) === "danger" && "border-red-200/75 bg-red-50 text-red-700",
        opportunityStatusTone(status) === "warning" && "border-amber-200/75 bg-amber-50 text-amber-700",
        opportunityStatusTone(status) === "success" && "border-primary/20 bg-primary/10 text-primary",
        opportunityStatusTone(status) === "info" && "border-primary/20 bg-primary/10 text-primary",
        opportunityStatusTone(status) === "neutral" && "border-border/75 bg-[color:var(--surface-2)] text-foreground/75",
      )}
      title={opportunityStatusLabels[status]}
    >
      {compactStatusLabels[status]}
    </span>
  )
}

