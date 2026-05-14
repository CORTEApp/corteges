"use client"

import type { ReactNode } from "react"
import { useMemo, useState } from "react"
import { FilePlus2, Plus, Trash2 } from "lucide-react"

import { createProformaAction } from "@/app/(app)/facturacion/proformas/actions"
import { Button } from "@/components/ui/button"
import { FormPendingScreen } from "@/components/ui/form-pending-screen"
import { FormSubmitButton } from "@/components/ui/form-submit-button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { formatAmount, toNumber } from "@/lib/billing/format"
import type { BillingClientOption, BillingFacturableOption } from "@/lib/billing/types"

type ProformaLineRow = {
  id: number
  facturableId: string
  quantity: string
  vatRate: string
}

const sectionClassName =
  "rounded-[var(--radius-shell)] border border-border/80 bg-[color:var(--surface-1)] p-5 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.24)] backdrop-blur-sm"

export function ProformaForm({
  clients,
  facturables,
  nextNumberPreview,
  today,
  defaultDueDate,
  formId = "proforma-form",
  actionsPlacement = "section",
}: {
  clients: BillingClientOption[]
  facturables: BillingFacturableOption[]
  nextNumberPreview: string
  today: string
  defaultDueDate: string
  formId?: string
  actionsPlacement?: "page" | "section"
}) {
  const firstFacturableId = facturables[0]?.id ?? ""
  const [rows, setRows] = useState<ProformaLineRow[]>([
    { id: 1, facturableId: firstFacturableId, quantity: "1", vatRate: "21" },
  ])

  const facturableById = useMemo(
    () => new Map(facturables.map((facturable) => [facturable.id, facturable])),
    [facturables],
  )

  const totals = rows.reduce(
    (acc, row) => {
      const facturable = facturableById.get(row.facturableId)
      const quantity = toNumber(row.quantity)
      const unitPrice = toNumber(facturable?.unit_price)
      const vatRate = toNumber(row.vatRate)
      const subtotal = unitPrice * quantity
      const tax = subtotal * (vatRate / 100)
      acc.subtotal += subtotal
      acc.tax += tax
      acc.total += subtotal + tax
      return acc
    },
    { subtotal: 0, tax: 0, total: 0 },
  )
  const pendingLabel = "Creando..."
  const sectionAction = actionsPlacement === "section"
    ? (
        <FormSubmitButton fullscreenPending={false} pendingLabel={pendingLabel}>
          <FilePlus2 aria-hidden="true" />
          Crear proforma
        </FormSubmitButton>
      )
    : null

  function addRow() {
    setRows((current) => [
      ...current,
      {
        id: (current.at(-1)?.id ?? 0) + 1,
        facturableId: firstFacturableId,
        quantity: "1",
        vatRate: "21",
      },
    ])
  }

  function updateRow(rowId: number, patch: Partial<ProformaLineRow>) {
    setRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)))
  }

  function removeRow(rowId: number) {
    setRows((current) => (current.length === 1 ? current : current.filter((row) => row.id !== rowId)))
  }

  return (
    <form id={formId} action={createProformaAction} className="grid gap-8">
      <FormPendingScreen label={pendingLabel} />
      <input type="hidden" name="line_count" value={rows.length} />

      <section className={sectionClassName}>
        <SectionTitle
          title="Cabecera"
          note={`La siguiente proforma se reservara al guardar como ${nextNumberPreview}.`}
          action={sectionAction}
        />
        <div className="mt-5 grid gap-4 md:grid-cols-6">
          <label className="grid gap-2 md:col-span-3">
            <span className="text-sm font-medium text-foreground">Cliente</span>
            <Select
              name="client_id"
              required
              placeholder="Seleccionar cliente"
              options={clients.map((client) => ({
                value: client.id,
                label: `${client.name} · ${client.tax_id}`,
              }))}
            />
          </label>
          <label className="grid gap-2 md:col-span-3">
            <span className="text-sm font-medium text-foreground">Proyecto</span>
            <Input name="project" placeholder="Proyecto o referencia interna" />
          </label>
          <label className="grid gap-2 md:col-span-3">
            <span className="text-sm font-medium text-foreground">Fecha</span>
            <Input name="issue_date" type="date" required defaultValue={today} />
          </label>
          <label className="grid gap-2 md:col-span-3">
            <span className="text-sm font-medium text-foreground">Vencimiento</span>
            <Input name="due_date" type="date" defaultValue={defaultDueDate} />
          </label>
          <label className="grid gap-2 md:col-span-6">
            <span className="text-sm font-medium text-foreground">Observaciones</span>
            <Textarea name="observations" placeholder="Notas internas o condiciones comerciales" />
          </label>
        </div>
      </section>

      <section className={sectionClassName}>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/70 pb-3">
          <SectionTitleBlock title="Lineas" note="Cada linea toma precio y unidad desde Facturables; el IVA se fija por linea." />
          <Button type="button" variant="outline" onClick={addRow} disabled={facturables.length === 0}>
            <Plus aria-hidden="true" />
            Anadir linea
          </Button>
        </div>

        <div className="mt-5 grid gap-3">
          {rows.map((row, index) => {
            const facturable = facturableById.get(row.facturableId)
            const quantity = toNumber(row.quantity)
            const unitPrice = toNumber(facturable?.unit_price)
            const vatRate = toNumber(row.vatRate)
            const lineTotal = unitPrice * quantity * (1 + vatRate / 100)
            const position = index + 1

            return (
              <div
                key={row.id}
                className="grid gap-3 rounded-[var(--radius-panel)] border border-border/70 bg-[color:var(--surface-2)]/55 p-3 md:grid-cols-[minmax(16rem,1fr)_7rem_7rem_8rem_2.5rem]"
              >
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Concepto
                  </span>
                  <Select
                    name={`line_facturable_id_${position}`}
                    value={row.facturableId}
                    onChange={(event) => updateRow(row.id, { facturableId: event.target.value })}
                    required
                    options={facturables.map((item) => ({
                      value: item.id,
                      label: `${item.code} · ${item.description}`,
                    }))}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Cantidad
                  </span>
                  <Input
                    name={`line_quantity_${position}`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    value={row.quantity}
                    onChange={(event) => updateRow(row.id, { quantity: event.target.value })}
                    required
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    IVA
                  </span>
                  <Input
                    name={`line_vat_rate_${position}`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    inputMode="decimal"
                    value={row.vatRate}
                    onChange={(event) => updateRow(row.id, { vatRate: event.target.value })}
                    required
                  />
                </label>
                <div className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Total
                  </span>
                  <div className="flex h-11 items-center justify-end rounded-[var(--radius-panel)] border border-border/70 bg-[color:var(--surface-1)] px-3 text-sm font-semibold">
                    {formatAmount(lineTotal)} €
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="self-end"
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length === 1}
                  aria-label="Eliminar linea"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            )
          })}
        </div>

        <div className="mt-5 grid gap-3 rounded-[var(--radius-panel)] border border-primary/15 bg-primary/8 p-4 md:grid-cols-3">
          <TotalPill label="Base" value={totals.subtotal} />
          <TotalPill label="IVA" value={totals.tax} />
          <TotalPill label="Total" value={totals.total} strong />
        </div>
      </section>

    </form>
  )
}

function TotalPill({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[var(--radius-panel)] bg-[color:var(--surface-1)] px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={strong ? "text-base font-bold text-foreground" : "text-sm font-semibold text-foreground"}>
        {formatAmount(value)} €
      </span>
    </div>
  )
}

function SectionTitle({ title, note, action }: { title: string; note?: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-border/70 pb-3">
      <SectionTitleBlock title={title} note={note} />
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

function SectionTitleBlock({ title, note }: { title: string; note?: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
      {note ? <p className="mt-1 text-sm leading-5 text-muted-foreground">{note}</p> : null}
    </div>
  )
}
