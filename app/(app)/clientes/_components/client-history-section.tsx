import { History } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { ClientHistoryEntry } from "@/lib/clients/types"

import { ClientHistoryTimeline } from "./client-history-timeline"
import { SectionTitle } from "./form-controls"

export function ClientHistorySection({
  history,
  currentHistoryEntryId,
}: {
  history: ClientHistoryEntry[]
  currentHistoryEntryId: string | null
}) {
  return (
    <section
      id="historial"
      className="rounded-[var(--radius-shell)] border border-border/80 bg-[color:var(--surface-1)] p-5 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.24)]"
    >
      <SectionTitle
        title="Histórico"
        note="Cada fila conserva un snapshot completo; la línea vigente gobierna la ficha operativa."
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge tone="info">{`${history.length} entradas`}</Badge>
        <Badge tone="neutral">
          {`${history.filter((entry) => entry.tax_id).length} con CIF`}
        </Badge>
        {currentHistoryEntryId ? (
          <Badge tone="success">
            <History className="size-3" aria-hidden="true" />
            Línea vigente
          </Badge>
        ) : null}
      </div>

      <div className="mt-5">
        <ClientHistoryTimeline history={history} currentHistoryEntryId={currentHistoryEntryId} />
      </div>
    </section>
  )
}
