"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarClock, History, Maximize2, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type FieldKind = "text" | "date" | "boolean"

export type ResourceHistoryEntry<TSnapshot> = {
  id: string
  effectiveDate: string | null
  sourceItemId: string | number | null
  current?: boolean
  snapshot: TSnapshot
}

export type ResourceHistoryField<TSnapshot> = {
  label: string
  kind?: FieldKind
  value: (snapshot: TSnapshot) => unknown
}

export type ResourceSnapshotSection<TSnapshot> = {
  title: string
  fields: ResourceHistoryField<TSnapshot>[]
}

type ChangeEvent = {
  field: string
  previous: string
  next: string
}

type TimelineEvent<TSnapshot> = {
  entry: ResourceHistoryEntry<TSnapshot>
  changes: ChangeEvent[]
  isInitial: boolean
}

const EMPTY_VALUE = "Sin dato"

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return EMPTY_VALUE
  }

  const normalized = value.length === 10 ? `${value}T00:00:00` : value
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

function formatBoolean(value: boolean | null | undefined): string {
  if (value === true) {
    return "Sí"
  }
  if (value === false) {
    return "No"
  }
  return EMPTY_VALUE
}

function formatValue(value: unknown, kind: FieldKind = "text"): string {
  if (kind === "boolean") {
    return formatBoolean(value as boolean | null | undefined)
  }
  if (kind === "date") {
    return formatDate(value as string | null | undefined)
  }
  if (value === null || value === undefined || value === "") {
    return EMPTY_VALUE
  }
  return String(value)
}

function sortedEntries<TSnapshot>(entries: ResourceHistoryEntry<TSnapshot>[]): ResourceHistoryEntry<TSnapshot>[] {
  return [...entries].sort((left, right) => {
    const dateCompare = String(left.effectiveDate || "").localeCompare(String(right.effectiveDate || ""))
    if (dateCompare !== 0) {
      return dateCompare
    }

    return String(left.sourceItemId || "").localeCompare(String(right.sourceItemId || ""), undefined, {
      numeric: true,
    })
  })
}

function compareSnapshots<TSnapshot>(
  previous: TSnapshot,
  next: TSnapshot,
  fields: ResourceHistoryField<TSnapshot>[],
): ChangeEvent[] {
  return fields
    .map((field) => {
      const previousValue = formatValue(field.value(previous), field.kind)
      const nextValue = formatValue(field.value(next), field.kind)
      if (previousValue === nextValue) {
        return null
      }
      return {
        field: field.label,
        previous: previousValue,
        next: nextValue,
      }
    })
    .filter(Boolean) as ChangeEvent[]
}

function buildTimeline<TSnapshot>(
  entries: ResourceHistoryEntry<TSnapshot>[],
  fields: ResourceHistoryField<TSnapshot>[],
): TimelineEvent<TSnapshot>[] {
  const sorted = sortedEntries(entries)
  return sorted.map((entry, index) => ({
    entry,
    changes: index === 0 ? [] : compareSnapshots(sorted[index - 1].snapshot, entry.snapshot, fields),
    isInitial: index === 0,
  }))
}

function sortTimelineEventsDesc<TSnapshot>(events: TimelineEvent<TSnapshot>[]): TimelineEvent<TSnapshot>[] {
  return [...events].sort((left, right) => {
    const dateCompare = String(right.entry.effectiveDate || "").localeCompare(String(left.entry.effectiveDate || ""))
    if (dateCompare !== 0) {
      return dateCompare
    }

    return String(right.entry.sourceItemId || "").localeCompare(String(left.entry.sourceItemId || ""), undefined, {
      numeric: true,
    })
  })
}

function SnapshotField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-[var(--radius-panel)] border border-border/70 bg-[color:var(--surface-2)]/80 px-3 py-2">
      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <strong className="break-words text-sm font-semibold text-foreground">{value}</strong>
    </div>
  )
}

function SnapshotModal<TSnapshot>({
  event,
  snapshotSections,
  modalTitle,
  sourceLabel,
  onClose,
}: {
  event: TimelineEvent<TSnapshot>
  snapshotSections: ResourceSnapshotSection<TSnapshot>[]
  modalTitle: string
  sourceLabel: string
  onClose: () => void
}) {
  const entry = event.entry

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4 py-6" role="presentation" onMouseDown={onClose}>
      <article
        aria-labelledby="resource-history-snapshot-title"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-[var(--radius-shell)] border border-border bg-[color:var(--surface-1)] shadow-2xl"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex flex-col gap-4 border-b border-border/75 bg-[color:var(--surface-2)]/70 px-5 py-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <Badge tone={entry.current ? "success" : "neutral"}>{entry.current ? "Vigente" : "Histórico"}</Badge>
              <Badge tone={event.isInitial ? "info" : event.changes.length ? "warning" : "neutral"}>
                {event.isInitial ? "Alta inicial" : `${event.changes.length} cambios`}
              </Badge>
            </div>
            <h2 className="mt-3 text-xl font-semibold tracking-tight" id="resource-history-snapshot-title">
              {modalTitle}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDate(entry.effectiveDate)} · {sourceLabel} {entry.sourceItemId || EMPTY_VALUE}
            </p>
          </div>
          <Button aria-label="Cerrar snapshot" onClick={onClose} size="icon" type="button" variant="ghost">
            <X size={18} />
          </Button>
        </header>

        <div className="grid max-h-[calc(90vh-8rem)] gap-6 overflow-y-auto p-5">
          {snapshotSections.map((section) => (
            <section className="grid gap-3" key={section.title}>
              <h3 className="text-sm font-semibold">{section.title}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {section.fields.map((field) => (
                  <SnapshotField
                    key={`${section.title}-${field.label}`}
                    label={field.label}
                    value={formatValue(field.value(entry.snapshot), field.kind)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    </div>
  )
}

export function ResourceHistoryTimeline<TSnapshot>({
  entries,
  compareFields,
  snapshotSections,
  emptyMessage = "Sin histórico disponible.",
  modalTitle = "Snapshot completo",
  sourceLabel = "Origen",
}: {
  entries: ResourceHistoryEntry<TSnapshot>[]
  compareFields: ResourceHistoryField<TSnapshot>[]
  snapshotSections: ResourceSnapshotSection<TSnapshot>[]
  emptyMessage?: string
  modalTitle?: string
  sourceLabel?: string
}) {
  const events = useMemo(() => sortTimelineEventsDesc(buildTimeline(entries, compareFields)), [compareFields, entries])
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent<TSnapshot> | null>(null)

  if (!events.length) {
    return (
      <div className="grid place-items-center gap-3 rounded-[var(--radius-panel)] border border-dashed border-border/80 p-8 text-center text-muted-foreground">
        <History size={26} />
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-3">
        {events.map((event) => (
          <button
            className={cn(
              "group grid w-full cursor-pointer gap-3 rounded-r-[var(--radius-shell)] border-l-4 bg-[color:var(--surface-2)]/75 p-4 text-left transition hover:-translate-y-0.5 hover:bg-accent/55 hover:shadow-sm",
              event.entry.current ? "border-l-primary" : "border-l-border",
            )}
            key={event.entry.id}
            onClick={() => setSelectedEvent(event)}
            type="button"
          >
            <span className="flex items-start justify-between gap-3 text-sm font-semibold">
              <span className="inline-flex items-center gap-2">
                <CalendarClock size={13} aria-hidden /> {formatDate(event.entry.effectiveDate)}
              </span>
              <span className="flex flex-wrap justify-end gap-2">
                {event.entry.current ? <Badge tone="success">Vigente</Badge> : null}
                <Badge tone={event.isInitial ? "info" : event.changes.length ? "warning" : "neutral"}>
                  {event.isInitial ? "Alta inicial" : event.changes.length ? `${event.changes.length} cambios` : "Sin cambios"}
                </Badge>
              </span>
            </span>

            <span className="grid gap-2">
              {event.isInitial ? (
                <span className="rounded-[var(--radius-panel)] border border-primary/15 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
                  Alta inicial del registro histórico
                </span>
              ) : event.changes.length ? (
                <span className="flex flex-wrap gap-2">
                  {event.changes.slice(0, 5).map((change) => (
                    <span
                      className="rounded-[var(--radius-panel)] border border-border/70 bg-[color:var(--surface-1)]/80 px-2.5 py-1.5 text-xs leading-5 text-muted-foreground"
                      key={`${event.entry.id}-${change.field}`}
                    >
                      <strong className="text-foreground">{change.field}:</strong> {change.previous} -&gt; {change.next}
                    </span>
                  ))}
                  {event.changes.length > 5 ? (
                    <span className="rounded-[var(--radius-panel)] border border-border/70 bg-[color:var(--surface-1)]/80 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">
                      +{event.changes.length - 5} más
                    </span>
                  ) : null}
                </span>
              ) : (
                <span className="rounded-[var(--radius-panel)] border border-border/70 bg-[color:var(--surface-1)]/80 px-3 py-2 text-xs text-muted-foreground">
                  Sin cambios materiales detectados
                </span>
              )}
            </span>

            <span className="inline-flex items-center gap-2 text-xs font-semibold text-primary opacity-80 transition group-hover:opacity-100">
              <Maximize2 size={12} /> Ver snapshot completo
            </span>
          </button>
        ))}
      </div>

      {selectedEvent ? (
        <SnapshotModal
          event={selectedEvent}
          modalTitle={modalTitle}
          onClose={() => setSelectedEvent(null)}
          snapshotSections={snapshotSections}
          sourceLabel={sourceLabel}
        />
      ) : null}
    </>
  )
}
