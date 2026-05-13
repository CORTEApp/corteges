import Link from "next/link"
import { Banknote, FileCheck2, FileText, ReceiptText } from "lucide-react"

import {
  issueInvoiceFromProformaAction,
  registerProformaPaymentAction,
} from "@/app/(app)/facturacion/proformas/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FormSubmitButton } from "@/components/ui/form-submit-button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  billingDocumentStatusLabels,
  billingDocumentStatusTone,
  billingPaymentMethodLabels,
  billingPaymentStatusLabels,
  billingPaymentStatusTone,
  formatAmount,
  formatDate,
  formatFileSize,
} from "@/lib/billing/format"
import type { BillingDocumentDetail } from "@/lib/billing/types"

const paymentMethodOptions = [
  { value: "stripe", label: "Stripe" },
  { value: "sepa", label: "SEPA" },
  { value: "transfer", label: "Transferencia" },
  { value: "other", label: "Otro" },
]

export function BillingDocumentDetailView({
  detail,
  today,
}: {
  detail: BillingDocumentDetail
  today: string
}) {
  const { document, lines, payments, files, sourceProforma, generatedInvoice } = detail
  const isProforma = document.document_type === "proforma"
  const canRegisterPayment = isProforma && document.payment_status === "unpaid" && document.status === "issued"
  const canIssueInvoice = isProforma && document.payment_status === "paid" && document.status === "paid" && !generatedInvoice

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
            <CardDescription>
              {isProforma ? "Documento comercial no fiscal." : "Factura fiscal emitida desde serie F."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <DetailField label="Cliente" value={document.client_name} />
            <DetailField label="CIF" value={document.client_tax_id ?? "-"} />
            <DetailField label="Correo" value={document.billing_email ?? "-"} />
            <DetailField label="Fecha" value={formatDate(document.issue_date)} />
            <DetailField label="Vencimiento" value={formatDate(document.due_date)} />
            <DetailField label="Pago" value={formatDate(document.paid_date)} />
            <DetailField label="Proyecto" value={document.project ?? "-"} className="md:col-span-3" />
            {document.observations ? (
              <DetailField label="Observaciones" value={document.observations} className="md:col-span-3" />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lineas</CardTitle>
            <CardDescription>{lines.length} conceptos asociados al documento.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Concepto</th>
                    <th className="px-4 py-3 text-right font-medium">Cantidad</th>
                    <th className="px-4 py-3 text-right font-medium">Precio</th>
                    <th className="px-4 py-3 text-right font-medium">IVA</th>
                    <th className="px-4 py-3 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.id} className="border-t border-border/80">
                      <td className="max-w-[34rem] px-4 py-4 align-top">
                        <span className="font-semibold text-foreground">{line.code ?? `Linea ${line.line_index}`}</span>
                        <span className="mt-1 block text-foreground/80">{line.description}</span>
                      </td>
                      <td className="px-4 py-4 text-right align-top text-foreground/80">
                        {formatAmount(line.quantity)}
                      </td>
                      <td className="px-4 py-4 text-right align-top text-foreground/80">
                        {formatAmount(line.unit_price)} €
                      </td>
                      <td className="px-4 py-4 text-right align-top text-foreground/80">
                        {formatAmount(line.vat_rate)} %
                      </td>
                      <td className="px-4 py-4 text-right align-top font-semibold text-foreground">
                        {formatAmount(line.total_amount)} €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {files.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Documentos</CardTitle>
              <CardDescription>Adjuntos historicos y PDFs generados del documento.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {files.map((file) => (
                <Link
                  key={file.id}
                  href={`/facturacion/${isProforma ? "proformas" : "facturas"}/${document.id}/documentos/${file.id}`}
                  className="grid gap-2 rounded-[var(--radius-panel)] border border-border/80 bg-[color:var(--surface-2)] p-4 no-underline transition hover:bg-[color:var(--surface-3)] md:grid-cols-[1fr_auto_auto] md:items-center"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 font-semibold text-foreground">
                      <FileText className="size-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{file.file_name}</span>
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {billingFileSourceLabel(file.source_kind)}
                      {file.source_sha256 ? ` · ${file.source_sha256.slice(0, 12)}` : ""}
                    </span>
                  </span>
                  <span className="text-sm text-muted-foreground">{formatFileSize(file.file_size)}</span>
                  <span className="text-sm text-muted-foreground">{formatDate(file.created_at)}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <aside className="grid content-start gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Estado</CardTitle>
            <CardDescription>Trazabilidad comercial y fiscal.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge tone={billingDocumentStatusTone(document.status)}>
                {billingDocumentStatusLabels[document.status]}
              </Badge>
              <Badge tone={billingPaymentStatusTone(document.payment_status)}>
                {billingPaymentStatusLabels[document.payment_status]}
              </Badge>
            </div>
            {sourceProforma ? (
              <Button asChild variant="outline">
                <Link href={`/facturacion/proformas/${sourceProforma.id}`}>
                  <ReceiptText aria-hidden="true" />
                  Abrir {sourceProforma.document_number}
                </Link>
              </Button>
            ) : null}
            {generatedInvoice ? (
              <Button asChild variant="outline">
                <Link href={`/facturacion/facturas/${generatedInvoice.id}`}>
                  <FileCheck2 aria-hidden="true" />
                  Abrir {generatedInvoice.document_number}
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Totales</CardTitle>
            <CardDescription>Base, IVA y total del documento.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <AmountRow label="Base" value={document.subtotal_amount} />
            <AmountRow label="IVA" value={document.tax_amount} />
            <AmountRow label="Total" value={document.total_amount} strong />
          </CardContent>
        </Card>

        {payments.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Pago registrado</CardTitle>
              <CardDescription>Pago completo asociado a la proforma.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {payments.map((payment) => (
                <div key={payment.id} className="rounded-[var(--radius-panel)] border border-border/70 bg-[color:var(--surface-2)] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">{formatDate(payment.payment_date)}</span>
                    <span className="font-semibold">{formatAmount(payment.amount)} €</span>
                  </div>
                  <p className="mt-2 text-sm text-foreground/80">
                    {billingPaymentMethodLabels[payment.payment_method]}
                  </p>
                  {payment.notes ? <p className="mt-1 text-sm text-muted-foreground">{payment.notes}</p> : null}
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {canRegisterPayment ? <PaymentForm documentId={document.id} totalAmount={document.total_amount} today={today} /> : null}
        {canIssueInvoice ? <IssueInvoiceForm documentId={document.id} today={today} /> : null}
      </aside>
    </div>
  )
}

function billingFileSourceLabel(sourceKind: BillingDocumentDetail["files"][number]["source_kind"]) {
  if (sourceKind === "sharepoint") {
    return "Origen SharePoint"
  }

  if (sourceKind === "generated") {
    return "PDF generado"
  }

  return "Subido a CORTE.Ges"
}

function PaymentForm({
  documentId,
  totalAmount,
  today,
}: {
  documentId: string
  totalAmount: number | string
  today: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrar pago</CardTitle>
        <CardDescription>V1 solo acepta pago completo antes de emitir factura.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={registerProformaPaymentAction} className="grid gap-4">
          <input type="hidden" name="proforma_id" value={documentId} />
          <input type="hidden" name="amount" value={String(totalAmount)} />
          <div className="rounded-[var(--radius-panel)] border border-primary/15 bg-primary/8 px-4 py-3">
            <span className="text-sm text-muted-foreground">Importe a registrar</span>
            <p className="mt-1 text-lg font-bold text-foreground">{formatAmount(totalAmount)} €</p>
          </div>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Fecha de pago</span>
            <Input name="payment_date" type="date" required defaultValue={today} />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Metodo</span>
            <Select name="payment_method" defaultValue="transfer" options={paymentMethodOptions} />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Notas</span>
            <Textarea name="notes" placeholder="Referencia bancaria, Stripe, SEPA..." />
          </label>
          <FormSubmitButton pendingLabel="Registrando...">
            <Banknote aria-hidden="true" />
            Registrar pago completo
          </FormSubmitButton>
        </form>
      </CardContent>
    </Card>
  )
}

function IssueInvoiceForm({ documentId, today }: { documentId: string; today: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Emitir factura</CardTitle>
        <CardDescription>Genera una factura F independiente y enlazada a esta proforma.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={issueInvoiceFromProformaAction} className="grid gap-4">
          <input type="hidden" name="proforma_id" value={documentId} />
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Fecha de factura</span>
            <Input name="issue_date" type="date" required defaultValue={today} />
          </label>
          <FormSubmitButton pendingLabel="Emitiendo...">
            <FileCheck2 aria-hidden="true" />
            Emitir factura
          </FormSubmitButton>
        </form>
      </CardContent>
    </Card>
  )
}

function AmountRow({
  label,
  value,
  strong,
}: {
  label: string
  value: number | string
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[var(--radius-panel)] border border-border/70 bg-[color:var(--surface-2)] px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={strong ? "text-lg font-bold text-foreground" : "text-sm font-semibold text-foreground"}>
        {formatAmount(value)} €
      </span>
    </div>
  )
}

function DetailField({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}
