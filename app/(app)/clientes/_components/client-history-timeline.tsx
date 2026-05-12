"use client"

import { useMemo } from "react"

import {
  ResourceHistoryTimeline,
  type ResourceHistoryEntry,
  type ResourceHistoryField,
  type ResourceSnapshotSection,
} from "@/components/resource-history-timeline"
import { paymentMethodLabels } from "@/lib/clients/format"
import type { ClientHistoryEntry } from "@/lib/clients/types"

const compareFields: ResourceHistoryField<ClientHistoryEntry>[] = [
  { label: "Activo", kind: "boolean", value: (entry) => entry.active },
  { label: "Estado", value: (entry) => entry.active_label },
  { label: "Método de pago", value: (entry) => paymentMethodLabels[entry.payment_method] },
  { label: "Nombre", value: (entry) => entry.name },
  { label: "Dirección", value: (entry) => entry.address },
  { label: "Contacto", value: (entry) => entry.contact_name },
  { label: "Teléfono", value: (entry) => entry.contact_phone },
  { label: "Correo contacto", value: (entry) => entry.contact_email },
  { label: "Correo de cobro", value: (entry) => entry.billing_email },
  { label: "Fecha inicio", kind: "date", value: (entry) => entry.start_date },
  { label: "Calificación", value: (entry) => entry.customer_rating },
  { label: "Línea vigente", value: (entry) => entry.current_line },
  { label: "Lead", value: (entry) => entry.lead_id },
  { label: "Comentarios", value: (entry) => entry.comments },
  { label: "Origen", value: (entry) => entry.source_kind === "manual" ? "Manual" : "SharePoint" },
]

const snapshotSections: ResourceSnapshotSection<ClientHistoryEntry>[] = [
  {
    title: "Identidad",
    fields: [
      { label: "CIF", value: (entry) => entry.tax_id },
      { label: "Nombre", value: (entry) => entry.name },
      { label: "Lead", value: (entry) => entry.lead_id },
      { label: "Calificación", value: (entry) => entry.customer_rating },
    ],
  },
  {
    title: "Contacto",
    fields: [
      { label: "Dirección", value: (entry) => entry.address },
      { label: "Contacto", value: (entry) => entry.contact_name },
      { label: "Teléfono", value: (entry) => entry.contact_phone },
      { label: "Correo contacto", value: (entry) => entry.contact_email },
      { label: "Correo de cobro", value: (entry) => entry.billing_email },
    ],
  },
  {
    title: "Pago",
    fields: [
      { label: "Método", value: (entry) => paymentMethodLabels[entry.payment_method] },
      { label: "Stripe", value: (entry) => entry.stripe_reference },
      { label: "SEPA", value: (entry) => entry.sepa_reference },
      { label: "Fecha inicio", kind: "date", value: (entry) => entry.start_date },
    ],
  },
  {
    title: "Estado",
    fields: [
      { label: "Activo", kind: "boolean", value: (entry) => entry.active },
      { label: "Etiqueta estado", value: (entry) => entry.active_label },
      { label: "Línea vigente", value: (entry) => entry.current_line },
      { label: "Comentarios", value: (entry) => entry.comments },
    ],
  },
  {
    title: "Origen",
    fields: [
      { label: "Tipo", value: (entry) => entry.source_kind === "manual" ? "Manual" : "SharePoint" },
      { label: "Clave", value: (entry) => entry.source_key },
      { label: "List ID", value: (entry) => entry.sharepoint_list_id },
      { label: "Item ID", value: (entry) => entry.sharepoint_item_id },
      { label: "Unique ID", value: (entry) => entry.sharepoint_unique_id },
      { label: "ETag", value: (entry) => entry.sharepoint_etag },
      { label: "Creado", kind: "date", value: (entry) => entry.source_created_at },
      { label: "Modificado", kind: "date", value: (entry) => entry.source_modified_at },
      { label: "Importado", kind: "date", value: (entry) => entry.imported_at },
    ],
  },
]

function effectiveDate(entry: ClientHistoryEntry): string | null {
  return entry.start_date || entry.source_modified_at || entry.source_created_at || entry.imported_at
}

export function ClientHistoryTimeline({
  history,
  currentHistoryEntryId,
}: {
  history: ClientHistoryEntry[]
  currentHistoryEntryId: string | null
}) {
  const entries = useMemo<ResourceHistoryEntry<ClientHistoryEntry>[]>(
    () =>
      history.map((entry) => ({
        id: entry.id,
        effectiveDate: effectiveDate(entry),
        sourceItemId: entry.source_kind === "manual" ? "manual" : entry.sharepoint_item_id,
        current: entry.is_current || (currentHistoryEntryId != null && entry.id === currentHistoryEntryId),
        snapshot: entry,
      })),
    [currentHistoryEntryId, history],
  )

  return (
    <ResourceHistoryTimeline
      compareFields={compareFields}
      emptyMessage="No hay líneas históricas importadas para este cliente."
      entries={entries}
      modalTitle="Snapshot completo de cliente"
      snapshotSections={snapshotSections}
      sourceLabel="Origen"
    />
  )
}
