import Link from "next/link"
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, ShieldCheck, Trash2 } from "lucide-react"

import {
  approveExpenseInvoiceIntakeAction,
  rejectExpenseInvoiceIntakeAction,
} from "@/app/(app)/gastos/recepcion/actions"
import { IntakeAmountFields } from "@/app/(app)/gastos/recepcion/_components/intake-amount-fields"
import { StatusBadge } from "@/app/(app)/gastos/recepcion/_components/intake-list"
import { SectionTitle } from "@/app/(app)/clientes/_components/form-controls"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FormSubmitButton } from "@/components/ui/form-submit-button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { currencyOptions, normalizeCurrencyCode } from "@/lib/currency-options"
import { formatExpenseAmountCompact, formatExpenseDate, formatExpenseFileSize } from "@/lib/expenses/format"
import { invoiceIntakeSourceLabels } from "@/lib/expenses/invoice-intake/format"
import type { ExpenseInvoiceIntakeDetail, ExpenseInvoiceIntakeDocument } from "@/lib/expenses/invoice-intake/types"
import { expensePaymentMethodLabels } from "@/lib/expenses/format"
import { formatDateTime } from "@/lib/utils"

function inputValue(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return ""
  }

  return String(value)
}

function hasDuplicateInvoiceWarning(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false
  }

  const duplicateInvoice = (value as Record<string, unknown>).duplicate_invoice
  return Boolean(
    duplicateInvoice &&
      typeof duplicateInvoice === "object" &&
      !Array.isArray(duplicateInvoice) &&
      (duplicateInvoice as Record<string, unknown>).detected,
  )
}

function eventActorLabel(event: ExpenseInvoiceIntakeDetail["events"][number]) {
  if (!event.actor_user_id) {
    return "Sistema"
  }

  const displayName = event.actor_profile?.display_name?.trim()
  const email = event.actor_profile?.email?.trim()

  if (displayName && email && displayName !== email) {
    return `${displayName} · ${email}`
  }

  return displayName || email || "Usuario no disponible"
}

export function ExpenseInvoiceIntakeReview({ detail }: { detail: ExpenseInvoiceIntakeDetail }) {
  const { item, documents, suppliers, events } = detail
  const primaryDocument = documents[0]
  const approved = item.status === "aprobada"
  const duplicateInvoiceWarning = hasDuplicateInvoiceWarning(item.extraction_data)
  const selectedCurrency = normalizeCurrencyCode(item.currency) ?? (item.currency ? "" : "EUR")

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]" data-surface-id="expense_invoice_intake_detail">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Revision</CardTitle>
            <CardDescription>Corrige los campos antes de crear el gasto individual.</CardDescription>
          </CardHeader>
          <CardContent>
            {approved ? (
              <div className="rounded-[var(--radius-panel)] border border-primary/15 bg-primary/10 p-4 text-sm leading-6 text-primary">
                Factura aprobada. El gasto individual ya fue creado.
                {item.approved_expense_id ? (
                  <Button asChild className="mt-3" size="sm">
                    <Link href={`/gastos/individuales/${item.approved_expense_id}`}>
                      <ExternalLink aria-hidden="true" />
                      Abrir gasto
                    </Link>
                  </Button>
                ) : null}
              </div>
            ) : (
              <form action={approveExpenseInvoiceIntakeAction} className="space-y-5">
                <input type="hidden" name="item_id" value={item.id} />

                {duplicateInvoiceWarning ? (
                  <div className="rounded-[var(--radius-panel)] border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertTriangle className="size-4" aria-hidden="true" />
                      Posible factura duplicada
                    </div>
                    <p className="mt-1">
                      Ya existe una factura con este proveedor y numero. Revisa exhaustivamente el PDF y los datos antes de aprobar.
                    </p>
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Proveedor" htmlFor="supplier_id" className="sm:col-span-2">
                    <Select
                      id="supplier_id"
                      name="supplier_id"
                      required
                      defaultValue={item.supplier_id ?? ""}
                      placeholder="Seleccionar proveedor"
                      options={suppliers.map((supplier) => ({
                        value: supplier.id,
                        label: `${supplier.name} - ${supplier.tax_id}`,
                      }))}
                    />
                  </Field>

                  <Field label="Numero factura" htmlFor="invoice_number">
                    <Input id="invoice_number" name="invoice_number" required defaultValue={item.invoice_number ?? ""} />
                  </Field>

                  <Field label="Fecha" htmlFor="invoice_date">
                    <Input id="invoice_date" name="invoice_date" type="date" required defaultValue={item.invoice_date ?? ""} />
                  </Field>

                  <IntakeAmountFields initialNetAmount={inputValue(item.net_amount)} initialVatRate={inputValue(item.vat_rate ?? 21)} />

                  <Field label="Moneda" htmlFor="currency">
                    <Select
                      id="currency"
                      name="currency"
                      required
                      defaultValue={selectedCurrency}
                      placeholder="Seleccionar moneda"
                      options={currencyOptions}
                    />
                  </Field>

                  <Field label="Pago" htmlFor="payment_method">
                    <Select
                      id="payment_method"
                      name="payment_method"
                      defaultValue={item.payment_method ?? "n26"}
                      options={Object.entries(expensePaymentMethodLabels).map(([value, label]) => ({ value, label }))}
                    />
                  </Field>

                  <Field label="Titulo" htmlFor="title" className="sm:col-span-2">
                    <Input id="title" name="title" required defaultValue={item.title ?? ""} />
                  </Field>

                  <Field label="Notas" htmlFor="review_notes" className="sm:col-span-2">
                    <Textarea id="review_notes" name="review_notes" defaultValue={item.review_notes ?? ""} />
                  </Field>
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t border-border/70 pt-5">
                  <FormSubmitButton pendingLabel="Creando gasto...">
                    <CheckCircle2 aria-hidden="true" />
                    Aprobar y crear gasto
                  </FormSubmitButton>
                  <Button asChild type="button" variant="outline">
                    <Link href="/gastos/recepcion">Volver</Link>
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {!approved ? (
          <Card>
            <CardHeader>
              <CardTitle>Rechazo</CardTitle>
              <CardDescription>Marca el PDF como descartado sin borrar el registro.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={rejectExpenseInvoiceIntakeAction} className="space-y-4">
                <input type="hidden" name="item_id" value={item.id} />
                <Field label="Motivo" htmlFor="reject_notes">
                  <Textarea id="reject_notes" name="review_notes" defaultValue={item.review_notes ?? ""} />
                </Field>
                <FormSubmitButton pendingLabel="Rechazando..." variant="ghost" className="text-destructive hover:bg-destructive/10">
                  <Trash2 aria-hidden="true" />
                  Rechazar
                </FormSubmitButton>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Documento</CardTitle>
            <CardDescription>Original recibido y texto extraido del PDF.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Estado" value={<StatusBadge status={item.status} />} />
              <Info label="Origen" value={invoiceIntakeSourceLabels[item.source_kind]} />
              <Info label="Factura" value={item.invoice_number ?? "-"} />
              <Info label="Fecha" value={formatExpenseDate(item.invoice_date)} />
              <Info label="Base" value={formatExpenseAmountCompact(item.net_amount)} />
              <Info label="Total" value={formatExpenseAmountCompact(item.total_amount)} />
            </div>

            {item.last_error ? (
              <div className="rounded-[var(--radius-panel)] border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                {item.last_error}
              </div>
            ) : null}

            <div className="space-y-3">
              {documents.map((document) => (
                <DocumentRow key={document.id} itemId={item.id} document={document} />
              ))}
            </div>

            <section className="rounded-[var(--radius-panel)] border border-border/80 bg-[color:var(--surface-2)]/50">
              <div className="border-b border-border/70 px-4 py-3">
                <SectionTitle title="Texto extraido" note="Fuente usada para aprender la plantilla del proveedor." />
              </div>
              <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap px-4 py-4 text-xs leading-5 text-foreground/80">
                {primaryDocument?.extracted_text ?? primaryDocument?.extraction_error ?? "Sin texto extraido."}
              </pre>
            </section>

            {primaryDocument ? (
              <section className="overflow-hidden rounded-[var(--radius-panel)] border border-border/80 bg-[color:var(--surface-2)]/50">
                <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <SectionTitle title="Previsualizacion PDF" note={primaryDocument.file_name} />
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/gastos/recepcion/${item.id}/documentos/${primaryDocument.id}`} target="_blank">
                      <ExternalLink aria-hidden="true" />
                      Abrir
                    </Link>
                  </Button>
                </div>
                <iframe
                  title={`Previsualizacion de ${primaryDocument.file_name}`}
                  src={`/gastos/recepcion/${item.id}/documentos/${primaryDocument.id}`}
                  className="h-[34rem] w-full border-0 bg-white md:h-[42rem]"
                />
              </section>
            ) : (
              <div className="rounded-[var(--radius-panel)] border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                No hay PDF asociado a esta recepcion.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actividad</CardTitle>
            <CardDescription>Eventos de entrada, extraccion y decision.</CardDescription>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin eventos registrados.</p>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <div key={event.id} className="rounded-[var(--radius-panel)] border border-border/75 bg-[color:var(--surface-2)]/45 p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
                      {event.event_type}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(event.created_at, "es-ES")}
                      {event.from_status || event.to_status ? ` · ${event.from_status ?? "-"} -> ${event.to_status ?? "-"}` : ""}
                    </div>
                    <div className="mt-1 break-all text-xs text-muted-foreground">
                      Usuario: <span className="font-medium text-foreground/80">{eventActorLabel(event)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function DocumentRow({ itemId, document }: { itemId: string; document: ExpenseInvoiceIntakeDocument }) {
  return (
    <div className="grid gap-3 rounded-[var(--radius-panel)] border border-border/80 bg-[color:var(--surface-1)] p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <Link
          href={`/gastos/recepcion/${itemId}/documentos/${document.id}`}
          className="flex min-w-0 items-center gap-2 font-semibold text-foreground no-underline hover:underline"
        >
          <FileText className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate">{document.file_name}</span>
        </Link>
        <div className="mt-1 text-xs text-muted-foreground">
          {formatExpenseFileSize(document.file_size)}
          {document.sender_email ? ` · ${document.sender_email}` : ""}
        </div>
      </div>
      {document.extracted_pages != null ? <Badge tone="info">{document.extracted_pages} pag.</Badge> : null}
    </div>
  )
}

function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string
  htmlFor?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={`grid gap-2 ${className ?? ""}`} htmlFor={htmlFor}>
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  )
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-border/70 bg-[color:var(--surface-2)]/45 px-3 py-2">
      <div className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
    </div>
  )
}
