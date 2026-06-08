"use client"

import type { ReactNode } from "react"
import { useMemo, useState } from "react"
import { Save } from "lucide-react"

import { saveSubscriptionAction } from "@/app/(app)/facturacion/suscripciones/actions"
import { FormPendingScreen } from "@/components/ui/form-pending-screen"
import { FormSubmitButton } from "@/components/ui/form-submit-button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { formatAmount, toNumber } from "@/lib/billing/format"
import { calculateSubscriptionRecurringAmounts } from "@/lib/billing/subscription-amounts.mjs"
import type {
  BillingClientOption,
  BillingFacturableOption,
  BillingSubscription,
} from "@/lib/billing/types"

const sectionClassName =
  "rounded-[var(--radius-shell)] border border-border/80 bg-[color:var(--surface-1)] p-5 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.24)] backdrop-blur-sm"

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function numberFieldValue(value: number | string | null | undefined, fallback = 0) {
  return String(toNumber(value ?? fallback))
}

export function SubscriptionForm({
  subscription,
  clients,
  facturables,
  formId = "subscription-form",
  actionsPlacement = "section",
}: {
  subscription?: BillingSubscription
  clients: BillingClientOption[]
  facturables: BillingFacturableOption[]
  formId?: string
  actionsPlacement?: "page" | "section"
}) {
  const initialClient = clients.find((client) => client.id === subscription?.client_id) ?? clients[0]
  const initialFacturable = facturables.find((facturable) => facturable.id === subscription?.facturable_id) ?? facturables[0]
  const initialQuantity = numberFieldValue(subscription?.quantity, 1)
  const initialApplyVat = subscription?.apply_vat ?? true
  const initialVatRate = numberFieldValue(subscription?.vat_rate, 21)
  const [clientId, setClientId] = useState(subscription?.client_id ?? initialClient?.id ?? "")
  const [facturableId, setFacturableId] = useState(subscription?.facturable_id ?? initialFacturable?.id ?? "")
  const [email, setEmail] = useState(subscription?.billing_email ?? initialClient?.billing_email ?? "")
  const [description, setDescription] = useState(subscription?.description ?? initialFacturable?.description ?? "")
  const [quantity, setQuantity] = useState(initialQuantity)
  const [applyVat, setApplyVat] = useState(initialApplyVat)
  const [vatRate, setVatRate] = useState(initialVatRate)

  const clientById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients])
  const facturableById = useMemo(() => new Map(facturables.map((facturable) => [facturable.id, facturable])), [facturables])
  const selectedFacturable = facturableById.get(facturableId)
  const amounts = calculateSubscriptionRecurringAmounts({
    unitPrice: selectedFacturable?.unit_price,
    quantity,
    applyVat,
    vatRate,
  })
  const totalValue = String(amounts.totalAmount)
  const pendingLabel = "Guardando..."
  const sectionAction = actionsPlacement === "section"
    ? (
        <FormSubmitButton fullscreenPending={false} pendingLabel={pendingLabel}>
          <Save aria-hidden="true" />
          Guardar suscripcion
        </FormSubmitButton>
      )
    : null

  return (
    <form id={formId} action={saveSubscriptionAction} className="grid gap-8">
      <FormPendingScreen label={pendingLabel} />
      {subscription ? <input type="hidden" name="subscription_id" value={subscription.id} /> : null}

      <section className={sectionClassName}>
        <SectionTitle
          title="Cliente y concepto"
          note="La suscripcion guarda snapshot de cliente, correo y concepto para conservar el historico comercial."
          action={sectionAction}
        />
        <div className="mt-5 grid gap-4 md:grid-cols-6">
          <label className="grid gap-2 md:col-span-3">
            <span className="text-sm font-medium text-foreground">Cliente</span>
            <Select
              name="client_id"
              value={clientId}
              onChange={(event) => {
                const nextClient = clientById.get(event.target.value)
                setClientId(event.target.value)
                setEmail(nextClient?.billing_email ?? "")
              }}
              required
              placeholder="Seleccionar cliente"
              options={clients.map((client) => ({
                value: client.id,
                label: `${client.name} · ${client.tax_id}`,
              }))}
            />
          </label>
          <label className="grid gap-2 md:col-span-3">
            <span className="text-sm font-medium text-foreground">Correo de facturacion</span>
            <Input
              name="billing_email"
              type="text"
              inputMode="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
              }}
              placeholder="facturacion@cliente.es; admon@cliente.es"
              data-filled={email ? "true" : "false"}
            />
          </label>
          <label className="grid gap-2 md:col-span-3">
            <span className="text-sm font-medium text-foreground">Facturable</span>
            <Select
              name="facturable_id"
              value={facturableId}
              onChange={(event) => {
                const nextFacturable = facturableById.get(event.target.value)
                setFacturableId(event.target.value)
                setDescription(nextFacturable?.description ?? "")
              }}
              required
              placeholder="Seleccionar facturable"
              options={facturables.map((facturable) => ({
                value: facturable.id,
                label: `${facturable.code} · ${facturable.description}`,
              }))}
            />
          </label>
          <label className="grid gap-2 md:col-span-3">
            <span className="text-sm font-medium text-foreground">Cantidad</span>
            <Input
              name="quantity"
              type="number"
              min="0.0001"
              step="0.0001"
              inputMode="decimal"
              value={quantity}
              onChange={(event) => {
                const nextQuantity = event.target.value
                setQuantity(nextQuantity)
              }}
              required
            />
          </label>
          <label className="grid gap-2 md:col-span-6">
            <span className="text-sm font-medium text-foreground">Descripcion</span>
            <Textarea
              name="description"
              value={description}
              onChange={(event) => {
                setDescription(event.target.value)
              }}
              placeholder="Plan, mantenimiento o acuerdo recurrente"
              required
              data-filled={description ? "true" : "false"}
            />
          </label>
        </div>
      </section>

      <section className={sectionClassName}>
        <SectionTitle
          title="Vigencia e importe"
          note="El total recurrente se calcula desde precio base, cantidad e IVA."
        />
        <div className="mt-5 grid gap-4 md:grid-cols-6">
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Fecha inicio</span>
            <Input name="start_date" type="date" required defaultValue={subscription?.start_date ?? todayISO()} />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Fecha fin</span>
            <Input name="end_date" type="date" defaultValue={subscription?.end_date ?? ""} />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Total recurrente</span>
            <Input
              name="recurring_total_amount"
              type="number"
              min="0"
              step="0.0001"
              inputMode="decimal"
              value={totalValue}
              readOnly
              required
            />
          </label>
          <label
            htmlFor="apply_vat"
            className="flex min-h-11 items-center gap-3 rounded-[var(--radius-panel)] border border-border/80 bg-[color:var(--surface-2)] px-3.5 py-2.5 text-sm font-medium md:col-span-2"
          >
            <input
              id="apply_vat"
              name="apply_vat"
              type="checkbox"
              checked={applyVat}
              onChange={(event) => {
                setApplyVat(event.target.checked)
              }}
              className="size-4 accent-[color:var(--primary)]"
            />
            Aplica IVA
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">IVA %</span>
            <Input
              name="vat_rate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              inputMode="decimal"
              value={applyVat ? vatRate : "0"}
              onChange={(event) => {
                setVatRate(event.target.value)
              }}
              disabled={!applyVat}
              required={applyVat}
            />
          </label>
        </div>

        <div className="mt-5 grid gap-3 rounded-[var(--radius-panel)] border border-primary/15 bg-primary/8 p-4 md:grid-cols-2 xl:grid-cols-4">
          <TotalPill label="Precio base" value={amounts.unitPrice} />
          <TotalPill label="Base calculada" value={amounts.baseAmount} />
          <TotalPill label="IVA calculado" value={amounts.taxAmount} />
          <TotalPill label="Total recurrente" value={amounts.totalAmount} strong />
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
      <div>
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        {note ? <p className="mt-1 text-sm leading-5 text-muted-foreground">{note}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
