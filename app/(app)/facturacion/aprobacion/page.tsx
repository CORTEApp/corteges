import Link from "next/link"
import {
  CalendarDays,
  Check,
  ClipboardCheck,
  CircleAlert,
  Euro,
  FileCheck2,
  MailWarning,
  RefreshCw,
  Send,
  XCircle,
} from "lucide-react"

import {
  approveInvoiceApprovalCandidateAction,
  approveSelectedInvoiceApprovalCandidatesAction,
  cancelInvoiceApprovalCandidateAction,
  generateInvoiceApprovalCandidatesAction,
} from "@/app/(app)/facturacion/aprobacion/actions"
import { ResourceContentTabs } from "@/components/resource-content-tabs"
import { ResourceListScreen } from "@/components/resource-screens"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { FormSection } from "@/components/ui/form-section"
import { FormSectionTabPanel } from "@/components/ui/form-section-tabs"
import { FormSubmitButton } from "@/components/ui/form-submit-button"
import { Input } from "@/components/ui/input"
import {
  billingPeriodLabel,
  billingPeriodMonthValue,
  listInvoiceApprovalPageData,
  normalizeBillingPeriodStart,
} from "@/lib/billing/approval"
import {
  billingInvoiceApprovalStatusLabels,
  billingInvoiceApprovalStatusTone,
  formatAmount,
  formatDate,
  toNumber,
} from "@/lib/billing/format"
import type { BillingInvoiceApprovalCandidateDetail } from "@/lib/billing/types"
import { cn } from "@/lib/utils"
import { requireAdminAccess } from "@/lib/users/server"

export const runtime = "nodejs"
export const maxDuration = 60

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function canApprove(candidate: BillingInvoiceApprovalCandidateDetail) {
  return candidate.status === "pending" || candidate.status === "failed"
}

function canCancel(candidate: BillingInvoiceApprovalCandidateDetail) {
  return (candidate.status === "pending" || candidate.status === "failed") && !candidate.invoice_id
}

function statusBadge(candidate: BillingInvoiceApprovalCandidateDetail) {
  return (
    <Badge tone={billingInvoiceApprovalStatusTone(candidate.status)}>
      {billingInvoiceApprovalStatusLabels[candidate.status]}
    </Badge>
  )
}

function QueryNotice({
  generated,
  skipped,
  approved,
  failed,
  cancelled,
  selected,
}: {
  generated?: string
  skipped?: string
  approved?: string
  failed?: string
  cancelled?: string
  selected?: string
}) {
  if (selected === "0") {
    return (
      <div className="rounded-[var(--radius-panel)] border border-amber-200/70 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Selecciona al menos un candidato pendiente para aprobar en lote.
      </div>
    )
  }

  if (generated || skipped) {
    return (
      <div className="rounded-[var(--radius-panel)] border border-primary/15 bg-primary/10 px-4 py-3 text-sm text-primary">
        Candidatos preparados: <strong>{generated ?? "0"}</strong>. Sin tocar: <strong>{skipped ?? "0"}</strong>.
      </div>
    )
  }

  if (approved || failed) {
    return (
      <div className="rounded-[var(--radius-panel)] border border-border/80 bg-[color:var(--surface-2)] px-4 py-3 text-sm text-foreground">
        Aprobadas: <strong>{approved ?? "0"}</strong>. Fallidas: <strong>{failed ?? "0"}</strong>.
      </div>
    )
  }

  if (cancelled) {
    return (
      <div className="rounded-[var(--radius-panel)] border border-border/80 bg-[color:var(--surface-2)] px-4 py-3 text-sm text-foreground">
        Candidatos cancelados: <strong>{cancelled}</strong>.
      </div>
    )
  }

  return null
}

function CandidateWarnings({
  candidate,
  showMissingEmail = true,
}: {
  candidate: BillingInvoiceApprovalCandidateDetail
  showMissingEmail?: boolean
}) {
  const warnings = [
    showMissingEmail && !candidate.billing_email ? "Sin correo de facturacion: la aprobacion fallara antes de consumir numero F." : null,
    candidate.last_error ? candidate.last_error : null,
  ].filter((warning): warning is string => Boolean(warning))

  if (!warnings.length) {
    return null
  }

  return (
    <div className="grid gap-2">
      {warnings.map((warning) => (
        <div key={warning} className="flex gap-2 rounded-[var(--radius-panel)] border border-red-200/70 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800">
          <MailWarning className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{warning}</span>
        </div>
      ))}
    </div>
  )
}

function CandidateLines({ candidate }: { candidate: BillingInvoiceApprovalCandidateDetail }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-panel)] border border-border/70 bg-[color:var(--surface-2)]">
      <div className="overflow-x-auto">
        <table className="min-w-[48rem] border-collapse text-sm">
          <thead className="bg-[color:var(--surface-3)] text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium">Codigo</th>
              <th className="px-3 py-2.5 text-left font-medium">Concepto</th>
              <th className="px-3 py-2.5 text-right font-medium">Cant.</th>
              <th className="px-3 py-2.5 text-right font-medium">Base</th>
              <th className="px-3 py-2.5 text-right font-medium">IVA</th>
              <th className="px-3 py-2.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {candidate.lines.map((line) => (
              <tr key={line.id} className="border-t border-border/70 bg-[color:var(--surface-1)]">
                <td className="px-3 py-2.5 align-top font-semibold text-foreground">{line.code ?? "-"}</td>
                <td className="max-w-[30rem] px-3 py-2.5 align-top text-foreground/80">{line.description}</td>
                <td className="px-3 py-2.5 text-right align-top text-foreground/80">{formatAmount(line.quantity)}</td>
                <td className="px-3 py-2.5 text-right align-top text-foreground/80">{formatAmount(line.subtotal_amount)} €</td>
                <td className="px-3 py-2.5 text-right align-top text-foreground/80">
                  {formatAmount(line.tax_amount)} € · {formatAmount(line.vat_rate)}%
                </td>
                <td className="px-3 py-2.5 text-right align-top font-semibold text-foreground">{formatAmount(line.total_amount)} €</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CandidateRow({
  candidate,
  periodMonth,
  mode = "manage",
}: {
  candidate: BillingInvoiceApprovalCandidateDetail
  periodMonth: string
  mode?: "manage" | "read"
}) {
  const editable = mode === "manage"
  const approvable = editable && canApprove(candidate)
  const cancellable = editable && canCancel(candidate)

  return (
    <article className="grid gap-4 rounded-[var(--radius-panel)] border border-border/80 bg-[color:var(--surface-1)] p-4 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.26)] md:p-5">
      <div
        className={cn(
          "grid gap-4 xl:items-start",
          editable ? "xl:grid-cols-[2rem_minmax(0,1.15fr)_minmax(20rem,0.85fr)]" : "xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]",
        )}
      >
        {editable ? (
          <label className="flex h-10 items-center xl:justify-center" title="Seleccionar para aprobar en lote">
            <input
              form="bulk-approve-form"
              type="checkbox"
              name="candidate_id"
              value={candidate.id}
              disabled={!approvable}
              className="size-4 accent-[color:var(--primary)] disabled:opacity-40"
              aria-label={`Seleccionar ${candidate.client_name}`}
            />
          </label>
        ) : null}

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{candidate.client_name}</h3>
            {statusBadge(candidate)}
            {candidate.invoice_id ? <Badge tone="info">Factura creada</Badge> : null}
          </div>
          <div className="mt-1 grid gap-1 text-sm text-muted-foreground md:grid-cols-2">
            <span className="truncate">{candidate.client_tax_id ?? "Sin CIF"}</span>
            <span className="truncate">{candidate.billing_email ?? "Sin correo"}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-[var(--radius-pill)] border border-border/70 px-2.5 py-1">
              {formatDate(candidate.period_start)} - {formatDate(candidate.period_end)}
            </span>
            <span className="rounded-[var(--radius-pill)] border border-border/70 px-2.5 py-1">
              {candidate.lines.length} lineas
            </span>
            {candidate.invoice_id ? (
              <Link
                href={`/facturacion/facturas/${candidate.invoice_id}`}
                className="rounded-[var(--radius-pill)] border border-primary/15 px-2.5 py-1 font-semibold text-primary no-underline"
              >
                Abrir factura
              </Link>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3">
          <div className="grid grid-cols-3 gap-2 rounded-[var(--radius-panel)] border border-border/80 bg-[color:var(--surface-2)] px-3 py-3 text-sm">
            <Amount label="Base" value={candidate.subtotal_amount} />
            <Amount label="IVA" value={candidate.tax_amount} />
            <Amount label="Total" value={candidate.total_amount} strong />
          </div>
          {editable ? <div className="flex flex-wrap justify-end gap-2">
            {approvable ? (
              <form action={approveInvoiceApprovalCandidateAction}>
                <input type="hidden" name="period" value={periodMonth} />
                <input type="hidden" name="candidate_id" value={candidate.id} />
                <FormSubmitButton pendingLabel="Procesando..." size="sm">
                  <Send className="size-3.5" aria-hidden="true" />
                  {candidate.invoice_id ? "Reintentar envio" : "Aprobar"}
                </FormSubmitButton>
              </form>
            ) : null}
            {cancellable ? (
              <form action={cancelInvoiceApprovalCandidateAction}>
                <input type="hidden" name="period" value={periodMonth} />
                <input type="hidden" name="candidate_id" value={candidate.id} />
                <FormSubmitButton pendingLabel="Cancelando..." variant="outline" size="sm">
                  <XCircle className="size-3.5" aria-hidden="true" />
                  Cancelar
                </FormSubmitButton>
              </form>
            ) : null}
          </div> : null}
        </div>
      </div>

      <CandidateWarnings candidate={candidate} showMissingEmail={editable} />
      <CandidateLines candidate={candidate} />
    </article>
  )
}

function Amount({
  label,
  value,
  strong,
}: {
  label: string
  value: number | string
  strong?: boolean
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={strong ? "truncate text-base font-bold text-foreground" : "truncate text-sm font-semibold text-foreground"}>
        {formatAmount(value)} €
      </div>
    </div>
  )
}

function CandidateList({
  candidates,
  periodMonth,
  mode,
  emptyTitle,
  emptyDescription,
  emptyActions,
}: {
  candidates: BillingInvoiceApprovalCandidateDetail[]
  periodMonth: string
  mode: "manage" | "read"
  emptyTitle: string
  emptyDescription: string
  emptyActions?: React.ReactNode
}) {
  if (!candidates.length) {
    return (
      <div className="px-5 py-5">
        <EmptyState title={emptyTitle} description={emptyDescription} actions={emptyActions} />
      </div>
    )
  }

  return (
    <div className="grid gap-3 p-4 md:p-5">
      {candidates.map((candidate) => (
        <CandidateRow key={candidate.id} candidate={candidate} periodMonth={periodMonth} mode={mode} />
      ))}
    </div>
  )
}

export default async function BillingInvoiceApprovalPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  await requireAdminAccess("/facturacion/aprobacion")
  const periodStart = normalizeBillingPeriodStart(firstParam(params.period))
  const periodMonth = billingPeriodMonthValue(periodStart)
  const { batch, candidates } = await listInvoiceApprovalPageData(periodStart)
  const workCandidates = candidates.filter((candidate) =>
    candidate.status === "pending" || candidate.status === "failed" || candidate.status === "processing"
  )
  const approvedCandidates = candidates.filter((candidate) => candidate.status === "sent")
  const cancelledCandidates = candidates.filter((candidate) => candidate.status === "cancelled")
  const pendingCount = workCandidates.filter((candidate) => candidate.status === "pending").length
  const processingCount = workCandidates.filter((candidate) => candidate.status === "processing").length
  const sentCount = approvedCandidates.length
  const failedCount = workCandidates.filter((candidate) => candidate.status === "failed").length
  const manageableTotalAmount = workCandidates
    .reduce((total, candidate) => total + toNumber(candidate.total_amount), 0)
  const approvalTabs = [
    {
      id: "gestion",
      label: `Por gestionar (${workCandidates.length})`,
      icon: <CircleAlert className="size-4" aria-hidden="true" />,
    },
    {
      id: "aprobadas",
      label: `Aprobadas (${approvedCandidates.length})`,
      icon: <Check className="size-4" aria-hidden="true" />,
    },
    ...(cancelledCandidates.length
      ? [
          {
            id: "canceladas",
            label: `Canceladas (${cancelledCandidates.length})`,
            icon: <XCircle className="size-4" aria-hidden="true" />,
          },
        ]
      : []),
  ]
  const workSummary = [
    pendingCount ? `${pendingCount} pendientes` : null,
    failedCount ? `${failedCount} fallidas` : null,
    processingCount ? `${processingCount} procesando` : null,
  ].filter(Boolean).join(" · ")

  return (
    <ResourceListScreen
      header={{
        icon: <ClipboardCheck className="size-6" aria-hidden="true" />,
        title: "Aprobacion de facturas",
        subtitle: "Candidatos mensuales por cliente. Aprobar crea factura F, PDF y envio inmediato.",
        actions: (
          <div className="flex flex-wrap gap-2">
            <form className="flex flex-wrap gap-2">
              <Input name="period" type="month" defaultValue={periodMonth} className="h-10 w-[10.5rem]" />
              <Button type="submit" variant="outline">
                <CalendarDays className="size-4" aria-hidden="true" />
                Ver periodo
              </Button>
            </form>
            <form action={generateInvoiceApprovalCandidatesAction}>
              <input type="hidden" name="period" value={periodMonth} />
              <FormSubmitButton pendingLabel="Generando...">
                <RefreshCw className="size-4" aria-hidden="true" />
                Generar candidatos ahora
              </FormSubmitButton>
            </form>
          </div>
        ),
      }}
      metrics={[
        {
          label: "Periodo",
          value: billingPeriodLabel(periodStart),
          description: batch ? `Preparado ${new Date(batch.updated_at).toLocaleString("es-ES")}` : "Sin lote generado",
          icon: <CalendarDays className="size-4" aria-hidden="true" />,
        },
        {
          label: "Por gestionar",
          value: String(workCandidates.length),
          description: workSummary || "Sin trabajo pendiente",
          tone: workCandidates.length ? "warning" : "neutral",
          icon: <CircleAlert className="size-4" aria-hidden="true" />,
        },
        {
          label: "Enviadas",
          value: String(sentCount),
          tone: sentCount ? "success" : "neutral",
          icon: <Check className="size-4" aria-hidden="true" />,
        },
        {
          label: "Total por gestionar",
          value: `${formatAmount(manageableTotalAmount)} €`,
          description: failedCount ? `${failedCount} fallidas` : "Sin fallos visibles",
          tone: failedCount ? "danger" : "info",
          icon: <Euro className="size-4" aria-hidden="true" />,
        },
      ]}
    >
      <QueryNotice
        generated={firstParam(params.generated)}
        skipped={firstParam(params.skipped)}
        approved={firstParam(params.approved)}
        failed={firstParam(params.failed)}
        cancelled={firstParam(params.cancelled)}
        selected={firstParam(params.selected)}
      />

      <ResourceContentTabs defaultTab="gestion" tabs={approvalTabs}>
        <FormSectionTabPanel tabId="gestion">
          <FormSection
            title="Por gestionar"
            description="Candidatos pendientes, fallidos o en proceso. La numeracion F se consume al aprobar."
            action={
              workCandidates.some(canApprove) ? (
                <form id="bulk-approve-form" action={approveSelectedInvoiceApprovalCandidatesAction}>
                  <input type="hidden" name="period" value={periodMonth} />
                  <FormSubmitButton pendingLabel="Aprobando seleccionadas..." variant="outline">
                    <FileCheck2 className="size-4" aria-hidden="true" />
                    Aprobar seleccionadas
                  </FormSubmitButton>
                </form>
              ) : null
            }
            contentClassName="p-0"
          >
            <CandidateList
              candidates={workCandidates}
              periodMonth={periodMonth}
              mode="manage"
              emptyTitle="No hay candidatos por gestionar."
              emptyDescription="Genera candidatos ahora o cambia de mes para revisar otro lote."
              emptyActions={
                <form action={generateInvoiceApprovalCandidatesAction}>
                  <input type="hidden" name="period" value={periodMonth} />
                  <FormSubmitButton pendingLabel="Generando...">
                    <RefreshCw className="size-4" aria-hidden="true" />
                    Generar candidatos ahora
                  </FormSubmitButton>
                </form>
              }
            />
          </FormSection>
        </FormSectionTabPanel>

        <FormSectionTabPanel tabId="aprobadas">
          <FormSection
            title="Aprobadas"
            description="Facturas creadas y enviadas. Quedan fuera del flujo de aprobacion diaria."
            contentClassName="p-0"
          >
            <CandidateList
              candidates={approvedCandidates}
              periodMonth={periodMonth}
              mode="read"
              emptyTitle="No hay facturas aprobadas para este periodo."
              emptyDescription="Cuando se aprueben y envien, apareceran aqui sin mezclarse con el trabajo pendiente."
            />
          </FormSection>
        </FormSectionTabPanel>

        {cancelledCandidates.length ? (
          <FormSectionTabPanel tabId="canceladas">
            <FormSection
              title="Canceladas"
              description="Candidatos retirados del lote mensual sin emitir factura."
              contentClassName="p-0"
            >
              <CandidateList
                candidates={cancelledCandidates}
                periodMonth={periodMonth}
                mode="read"
                emptyTitle="No hay candidatos cancelados."
                emptyDescription="Las cancelaciones del periodo apareceran aqui."
              />
            </FormSection>
          </FormSectionTabPanel>
        ) : null}
      </ResourceContentTabs>
    </ResourceListScreen>
  )
}
