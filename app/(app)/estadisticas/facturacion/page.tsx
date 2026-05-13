import Link from "next/link"
import {
  ArrowRight,
  Calculator,
  CalendarRange,
  ChartColumnIncreasing,
  Download,
  Euro,
  FileText,
  Landmark,
  ReceiptText,
  Settings2,
  WalletCards,
} from "lucide-react"

import { ResourceListScreen } from "@/components/resource-screens"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { FilterSidebarCard, FILTERS_LAYOUT_CLASS } from "@/components/ui/filter-sidebar-card"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import {
  MobileRecordActions,
  MobileRecordCard,
  MobileRecordField,
  MobileRecordGrid,
} from "@/components/ui/mobile-record-card"
import { cn } from "@/lib/utils"
import {
  FISCAL_PERIODS,
  FISCAL_VIEWS,
  fiscalExportUrl,
  fiscalUrl,
  formatFiscalAmount,
  formatFiscalDate,
  formatFiscalPercent,
  listFiscalBillingStatistics,
  normalizeFiscalPeriod,
  normalizeFiscalView,
  normalizeFiscalYear,
  type FiscalBillingStatistics,
  type FiscalExpenseRow,
  type FiscalIncomeRow,
  type FiscalPeriodId,
  type FiscalViewId,
} from "@/lib/statistics/fiscal"

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function yearOptions(selectedYear: number) {
  const current = new Date().getFullYear()
  const years = new Set<number>([selectedYear])
  for (let offset = -1; offset <= 4; offset += 1) {
    years.add(current - offset)
  }

  return [...years]
    .filter((year) => year >= 2000 && year <= 2200)
    .sort((a, b) => b - a)
    .map((year) => ({ value: String(year), label: String(year) }))
}

function paymentMethodLabel(value: string) {
  const labels: Record<string, string> = {
    n26: "N26",
    caixa: "Caixa",
    other: "Otro",
  }

  return labels[value] ?? value
}

function documentStatusLabel(value: string) {
  const labels: Record<string, string> = {
    issued: "Emitida",
    paid: "Pagada",
    invoiced: "Facturada",
    unpaid: "Sin pago",
    legacy_partial: "Pago parcial historico",
  }

  return labels[value] ?? value
}

function PeriodTabs({
  selectedPeriod,
  selectedView,
  selectedYear,
}: {
  selectedPeriod: FiscalPeriodId
  selectedView: FiscalViewId
  selectedYear: number
}) {
  return (
    <div className="flex gap-2 overflow-x-auto rounded-[var(--radius-shell)] border border-border/80 bg-[color:var(--surface-1)] p-2 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.22)]">
      {FISCAL_PERIODS.map((period) => {
        const selected = period.id === selectedPeriod
        return (
          <Link
            key={period.id}
            href={fiscalUrl({ view: selectedView, period: period.id, year: selectedYear })}
            className={cn(
              "inline-flex min-h-12 shrink-0 flex-col justify-center rounded-[var(--radius-control)] border px-4 py-2 text-sm font-semibold no-underline transition",
              selected
                ? "border-primary/20 bg-primary text-white shadow-sm shadow-primary/20"
                : "border-transparent text-foreground/75 hover:border-border hover:bg-accent/60 hover:text-foreground",
            )}
          >
            <span>{period.label}</span>
            <span className={cn("text-[0.72rem] font-medium", selected ? "text-white/78" : "text-muted-foreground")}>
              {period.description}
            </span>
          </Link>
        )
      })}
    </div>
  )
}

function ViewTabs({
  selectedPeriod,
  selectedView,
  selectedYear,
}: {
  selectedPeriod: FiscalPeriodId
  selectedView: FiscalViewId
  selectedYear: number
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {FISCAL_VIEWS.map((view) => {
        const selected = view.id === selectedView
        return (
          <Button asChild key={view.id} variant={selected ? "default" : "outline"} size="sm">
            <Link href={fiscalUrl({ view: view.id, period: selectedPeriod, year: selectedYear })}>
              {view.id === "gastos" ? <ReceiptText className="size-3.5" aria-hidden="true" /> : null}
              {view.id === "ingresos" ? <Euro className="size-3.5" aria-hidden="true" /> : null}
              {view.id === "impuestos" ? <Landmark className="size-3.5" aria-hidden="true" /> : null}
              {view.label}
            </Link>
          </Button>
        )
      })}
    </div>
  )
}

function FiscalSidebar({
  data,
  selectedPeriod,
  selectedView,
}: {
  data: FiscalBillingStatistics
  selectedPeriod: FiscalPeriodId
  selectedView: FiscalViewId
}) {
  return (
    <FilterSidebarCard
      title="Periodo fiscal"
      description="Consulta por trimestre o por ejercicio completo."
      contentClassName="space-y-5 pt-5"
    >
      <form className="space-y-5">
        <input type="hidden" name="vista" value={selectedView} />
        <input type="hidden" name="periodo" value={selectedPeriod} />
        <div className="space-y-2.5">
          <Label htmlFor="fiscal-year">Año</Label>
          <Select
            id="fiscal-year"
            name="year"
            defaultValue={String(data.taxYear)}
            options={yearOptions(data.taxYear)}
          />
        </div>
        <Button type="submit" className="w-full">
          <CalendarRange className="size-4" aria-hidden="true" />
          Aplicar año
        </Button>
      </form>

      <div className="rounded-[var(--radius-panel)] border border-border/80 bg-[color:var(--surface-2)] px-4 py-3">
        <div className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Rango</div>
        <div className="mt-2 text-sm font-semibold">
          {formatFiscalDate(data.range.start)} - {formatFiscalDate(data.range.end)}
        </div>
      </div>

      <div className="rounded-[var(--radius-panel)] border border-primary/15 bg-primary/10 px-4 py-3">
        <div className="flex items-start gap-3">
          <Calculator className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-primary">{data.settings.profileLabel}</p>
            <p className="mt-1 text-xs leading-5 text-primary/80">
              {data.settings.sourceNote ?? "Estimacion fiscal configurable."}
            </p>
          </div>
        </div>
      </div>

      <Button asChild variant="outline" className="w-full">
        <Link href="/settings#fiscalidad">
          <Settings2 className="size-4" aria-hidden="true" />
          Config fiscal
        </Link>
      </Button>
    </FilterSidebarCard>
  )
}

function ExportButton({ data }: { data: FiscalBillingStatistics }) {
  return (
    <Button asChild>
      <Link href={fiscalExportUrl({ view: data.view.id, period: data.period.id, year: data.taxYear })}>
        <Download className="size-4" aria-hidden="true" />
        Exportar CSV
      </Link>
    </Button>
  )
}

function ExpensesTable({ expenses }: { expenses: FiscalExpenseRow[] }) {
  if (expenses.length === 0) {
    return (
      <EmptyState
        title="No hay gastos en este periodo."
        description="Cambia de trimestre o revisa el ejercicio anual para preparar el export fiscal."
      />
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gastos</CardTitle>
        <CardDescription>Facturas de gasto con base, IVA soportado y total del periodo seleccionado.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 lg:hidden">
          {expenses.map((expense) => (
            <MobileRecordCard
              key={`mobile-expense-${expense.id}`}
              eyebrow={expense.invoiceNumber}
              title={expense.title}
              subtitle={expense.supplierName}
              headerSlot={<Badge tone="neutral">{paymentMethodLabel(expense.paymentMethod)}</Badge>}
              footer={
                <MobileRecordActions>
                  <Button asChild type="button" variant="outline" size="sm" className="w-full justify-center">
                    <Link href={`/gastos/individuales/${expense.id}`}>Abrir</Link>
                  </Button>
                </MobileRecordActions>
              }
            >
              <MobileRecordGrid className="grid-cols-2">
                <MobileRecordField label="Fecha" value={formatFiscalDate(expense.expenseDate)} />
                <MobileRecordField label="Base" value={formatFiscalAmount(expense.netAmount)} />
                <MobileRecordField label="IVA" value={formatFiscalAmount(expense.taxAmount)} />
                <MobileRecordField label="Total" value={formatFiscalAmount(expense.totalAmount)} />
              </MobileRecordGrid>
            </MobileRecordCard>
          ))}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Fecha</th>
                <th className="px-4 py-3 text-left font-medium">Proveedor</th>
                <th className="px-4 py-3 text-left font-medium">Factura</th>
                <th className="px-4 py-3 text-right font-medium">Base</th>
                <th className="px-4 py-3 text-right font-medium">IVA</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-left font-medium">Pago</th>
                <th className="px-4 py-3 text-right font-medium">Ficha</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id} className="border-t border-border/80">
                  <td className="px-4 py-4 align-top text-foreground/85">{formatFiscalDate(expense.expenseDate)}</td>
                  <td className="max-w-[22rem] px-4 py-4 align-top">
                    <span className="line-clamp-2 font-semibold text-foreground">{expense.supplierName}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{expense.supplierTaxId}</span>
                  </td>
                  <td className="max-w-[24rem] px-4 py-4 align-top">
                    <Link href={`/gastos/individuales/${expense.id}`} className="font-semibold text-foreground no-underline">
                      {expense.invoiceNumber}
                    </Link>
                    <span className="mt-1 block text-xs text-muted-foreground">{expense.title}</span>
                  </td>
                  <td className="px-4 py-4 text-right align-top text-foreground/85">{formatFiscalAmount(expense.netAmount)}</td>
                  <td className="px-4 py-4 text-right align-top text-foreground/85">
                    {formatFiscalAmount(expense.taxAmount)}
                    <span className="mt-1 block text-xs text-muted-foreground">{formatFiscalPercent(expense.vatRate)}</span>
                  </td>
                  <td className="px-4 py-4 text-right align-top font-semibold">{formatFiscalAmount(expense.totalAmount)}</td>
                  <td className="px-4 py-4 align-top">{paymentMethodLabel(expense.paymentMethod)}</td>
                  <td className="px-4 py-4 text-right align-top">
                    <Button asChild size="icon-sm" variant="ghost" aria-label={`Abrir ${expense.invoiceNumber}`}>
                      <Link href={`/gastos/individuales/${expense.id}`}>
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function IncomesTable({ incomes }: { incomes: FiscalIncomeRow[] }) {
  if (incomes.length === 0) {
    return (
      <EmptyState
        title="No hay ingresos facturados en este periodo."
        description="Las facturas canceladas o descartadas quedan fuera de la lectura fiscal por defecto."
      />
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingresos</CardTitle>
        <CardDescription>Facturas fiscales emitidas, sin canceladas ni descartadas.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 lg:hidden">
          {incomes.map((income) => (
            <MobileRecordCard
              key={`mobile-income-${income.id}`}
              eyebrow={income.documentNumber}
              title={income.clientName}
              subtitle={formatFiscalDate(income.issueDate)}
              headerSlot={<Badge tone="info">{documentStatusLabel(income.status)}</Badge>}
              footer={
                <MobileRecordActions>
                  <Button asChild type="button" variant="outline" size="sm" className="w-full justify-center">
                    <Link href={`/facturacion/facturas/${income.id}`}>Abrir</Link>
                  </Button>
                </MobileRecordActions>
              }
            >
              <MobileRecordGrid className="grid-cols-2">
                <MobileRecordField label="Base" value={formatFiscalAmount(income.subtotalAmount)} />
                <MobileRecordField label="IVA" value={formatFiscalAmount(income.taxAmount)} />
                <MobileRecordField label="Total" value={formatFiscalAmount(income.totalAmount)} />
                <MobileRecordField label="Pago" value={documentStatusLabel(income.paymentStatus)} />
              </MobileRecordGrid>
            </MobileRecordCard>
          ))}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Fecha</th>
                <th className="px-4 py-3 text-left font-medium">Cliente</th>
                <th className="px-4 py-3 text-left font-medium">Factura</th>
                <th className="px-4 py-3 text-right font-medium">Base</th>
                <th className="px-4 py-3 text-right font-medium">IVA</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-left font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Ficha</th>
              </tr>
            </thead>
            <tbody>
              {incomes.map((income) => (
                <tr key={income.id} className="border-t border-border/80">
                  <td className="px-4 py-4 align-top text-foreground/85">{formatFiscalDate(income.issueDate)}</td>
                  <td className="max-w-[24rem] px-4 py-4 align-top">
                    <span className="line-clamp-2 font-semibold text-foreground">{income.clientName}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{income.clientTaxId ?? "Sin CIF"}</span>
                  </td>
                  <td className="max-w-[22rem] px-4 py-4 align-top">
                    <Link href={`/facturacion/facturas/${income.id}`} className="font-semibold text-foreground no-underline">
                      {income.documentNumber}
                    </Link>
                    {income.project ? <span className="mt-1 block text-xs text-muted-foreground">{income.project}</span> : null}
                  </td>
                  <td className="px-4 py-4 text-right align-top text-foreground/85">{formatFiscalAmount(income.subtotalAmount)}</td>
                  <td className="px-4 py-4 text-right align-top text-foreground/85">{formatFiscalAmount(income.taxAmount)}</td>
                  <td className="px-4 py-4 text-right align-top font-semibold">{formatFiscalAmount(income.totalAmount)}</td>
                  <td className="px-4 py-4 align-top">
                    <span className="inline-flex flex-wrap gap-2">
                      <Badge tone="info">{documentStatusLabel(income.status)}</Badge>
                      <Badge tone="neutral">{documentStatusLabel(income.paymentStatus)}</Badge>
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right align-top">
                    <Button asChild size="icon-sm" variant="ghost" aria-label={`Abrir ${income.documentNumber}`}>
                      <Link href={`/facturacion/facturas/${income.id}`}>
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function TaxesTable({ data }: { data: FiscalBillingStatistics }) {
  const rows = [
    ["IVA repercutido", formatFiscalAmount(data.totals.incomeTax), "Facturas emitidas del periodo"],
    ["IVA soportado", formatFiscalAmount(data.totals.expenseTax), "Gastos registrados del periodo"],
    ["IVA neto", formatFiscalAmount(data.totals.vatNet), "Repercutido menos soportado"],
    ["Beneficio estimado", formatFiscalAmount(data.totals.profit), "Base ingresos menos base gastos"],
    ["Tramo IRPF aplicado", data.totals.appliedIrpfBracketLabel, data.settings.profileLabel],
    ["IRPF estimado", formatFiscalAmount(data.totals.irpfEstimate), "Calculo progresivo sobre beneficio positivo"],
    ["Total estimado", formatFiscalAmount(data.totals.reserveEstimate), "IVA neto positivo mas IRPF estimado"],
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Declaracion de impuestos</CardTitle>
        <CardDescription>Estimacion operativa exportable. No sustituye la presentacion oficial ante AEAT.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[var(--radius-panel)] border border-border/80 bg-[color:var(--surface-2)] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Facturas</div>
            <div className="mt-3 text-2xl font-semibold">{data.incomes.length}</div>
          </div>
          <div className="rounded-[var(--radius-panel)] border border-border/80 bg-[color:var(--surface-2)] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Gastos</div>
            <div className="mt-3 text-2xl font-semibold">{data.expenses.length}</div>
          </div>
          <div className="rounded-[var(--radius-panel)] border border-primary/15 bg-primary/10 p-4 text-primary">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/75">IRPF</div>
            <div className="mt-3 text-2xl font-semibold">{formatFiscalAmount(data.totals.irpfEstimate)}</div>
          </div>
          <div className="rounded-[var(--radius-panel)] border border-primary/15 bg-primary/10 p-4 text-primary">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/75">Reserva</div>
            <div className="mt-3 text-2xl font-semibold">{formatFiscalAmount(data.totals.reserveEstimate)}</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Concepto</th>
                <th className="px-4 py-3 text-right font-medium">Valor</th>
                <th className="px-4 py-3 text-left font-medium">Criterio</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, value, note]) => (
                <tr key={label} className="border-t border-border/80">
                  <td className="px-4 py-4 align-top font-semibold">{label}</td>
                  <td className="px-4 py-4 text-right align-top font-semibold">{value}</td>
                  <td className="max-w-[34rem] px-4 py-4 align-top text-muted-foreground">{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-[var(--radius-panel)] border border-amber-200/70 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          La estimacion de IRPF depende de los tramos configurados en Ajustes. Para trimestres se calcula sobre el beneficio del periodo seleccionado.
        </div>
      </CardContent>
    </Card>
  )
}

function ActiveView({ data }: { data: FiscalBillingStatistics }) {
  if (data.view.id === "ingresos") {
    return <IncomesTable incomes={data.incomes} />
  }

  if (data.view.id === "impuestos") {
    return <TaxesTable data={data} />
  }

  return <ExpensesTable expenses={data.expenses} />
}

export default async function FiscalBillingStatisticsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const selectedYear = normalizeFiscalYear(one(params.year))
  const selectedPeriod = normalizeFiscalPeriod(one(params.periodo))
  const selectedView = normalizeFiscalView(one(params.vista))
  const data = await listFiscalBillingStatistics({
    taxYear: selectedYear,
    periodId: selectedPeriod,
    viewId: selectedView,
    nextPath: fiscalUrl({ view: selectedView, period: selectedPeriod, year: selectedYear }),
  })

  return (
    <ResourceListScreen
      header={{
        icon: <ChartColumnIncreasing className="size-6" aria-hidden="true" />,
        title: "Estadisticas de facturacion",
        subtitle: "Lectura fiscal por trimestres y ejercicio anual, con export CSV para gestoria.",
        actions: <ExportButton data={data} />,
      }}
      metrics={[
        { label: "Ingresos base", value: formatFiscalAmount(data.totals.incomeSubtotal), icon: <Euro className="size-4" aria-hidden="true" /> },
        { label: "Gastos base", value: formatFiscalAmount(data.totals.expenseSubtotal), icon: <ReceiptText className="size-4" aria-hidden="true" /> },
        {
          label: "IVA neto",
          value: formatFiscalAmount(data.totals.vatNet),
          tone: data.totals.vatNet > 0 ? "warning" : "success",
          icon: <FileText className="size-4" aria-hidden="true" />,
        },
        {
          label: "Beneficio",
          value: formatFiscalAmount(data.totals.profit),
          tone: data.totals.profit > 0 ? "info" : "neutral",
          icon: <WalletCards className="size-4" aria-hidden="true" />,
        },
        {
          label: "IRPF estimado",
          value: formatFiscalAmount(data.totals.irpfEstimate),
          icon: <Landmark className="size-4" aria-hidden="true" />,
        },
      ]}
    >
      <div className={FILTERS_LAYOUT_CLASS}>
        <FiscalSidebar data={data} selectedPeriod={selectedPeriod} selectedView={selectedView} />
        <div className="grid min-w-0 content-start gap-6">
          <PeriodTabs selectedPeriod={selectedPeriod} selectedView={selectedView} selectedYear={selectedYear} />
          <div className="flex flex-col gap-3 rounded-[var(--radius-shell)] border border-border/80 bg-[color:var(--surface-1)] px-4 py-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.22)] lg:flex-row lg:items-center lg:justify-between">
            <ViewTabs selectedPeriod={selectedPeriod} selectedView={selectedView} selectedYear={selectedYear} />
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">{data.period.label}</Badge>
              <Badge tone="info">{data.taxYear}</Badge>
              <Badge tone={data.settings.source === "database" ? "success" : "warning"}>
                {data.settings.source === "database" ? "Config guardada" : "Config por defecto"}
              </Badge>
            </div>
          </div>
          <ActiveView data={data} />
        </div>
      </div>
    </ResourceListScreen>
  )
}
