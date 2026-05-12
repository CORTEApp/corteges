import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowRight, Building2, CalendarDays, FileText, Plus, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { FilterSidebarCard } from "@/components/ui/filter-sidebar-card"
import { Input } from "@/components/ui/input"
import {
  MobileRecordActions,
  MobileRecordCard,
  MobileRecordField,
  MobileRecordGrid,
} from "@/components/ui/mobile-record-card"
import { Select } from "@/components/ui/select"
import {
  expensePaymentMethodLabels,
  formatExpenseAmountCompact,
  formatExpenseDate,
} from "@/lib/expenses/format"
import type {
  ExpenseIndividualFilters,
  ExpenseIndividualListItem,
  ExpensePaymentMethod,
  ExpenseSupplierOption,
} from "@/lib/expenses/types"

const paymentOptions: Array<[ExpensePaymentMethod | "all", string]> = [
  ["all", "Todos"],
  ["n26", "N26"],
  ["caixa", "Caixa"],
  ["other", "Otro"],
]

const monthOptions = [
  ["all", "Todos"],
  ["01", "Enero"],
  ["02", "Febrero"],
  ["03", "Marzo"],
  ["04", "Abril"],
  ["05", "Mayo"],
  ["06", "Junio"],
  ["07", "Julio"],
  ["08", "Agosto"],
  ["09", "Septiembre"],
  ["10", "Octubre"],
  ["11", "Noviembre"],
  ["12", "Diciembre"],
]

function yearOptions() {
  const current = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, index) => String(current - index))
  return [["all", "Todos"], ...years.map((year) => [year, year])]
}

export function ExpenseIndividualFiltersBar({
  filters,
  suppliers,
}: {
  filters: ExpenseIndividualFilters
  suppliers: ExpenseSupplierOption[]
}) {
  return (
    <FilterSidebarCard
      title="Filtros"
      description="Localiza gastos por proveedor, factura, fecha y forma de pago."
      contentClassName="space-y-5 pt-5"
    >
      <div className="space-y-3 rounded-[var(--radius-panel)] border border-border/70 bg-[color:var(--surface-2)]/45 p-3.5">
        <Button asChild type="button" className="w-full" variant="secondary">
          <Link href="/gastos/individuales">Borrar todo</Link>
        </Button>
        <p className="text-xs leading-5 text-muted-foreground">
          Por defecto se muestra el año actual. La busqueda cubre titulo, factura, proveedor, CIF y observaciones.
        </p>
      </div>

      <form className="space-y-5">
        <SidebarField label="Buscar" htmlFor="expense-individuals-q">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="expense-individuals-q"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Microsoft, Kodare, factura..."
              className="pl-9"
            />
          </div>
        </SidebarField>

        <SidebarField label="Proveedor" htmlFor="expense-individuals-supplier">
          <Select
            id="expense-individuals-supplier"
            name="supplier"
            defaultValue={filters.supplier ?? "all"}
            options={[
              { value: "all", label: "Todos" },
              ...suppliers.map((supplier) => ({
                value: supplier.id,
                label: `${supplier.name} · ${supplier.tax_id}`,
              })),
            ]}
          />
        </SidebarField>

        <SidebarField label="Pago" htmlFor="expense-individuals-payment">
          <Select
            id="expense-individuals-payment"
            name="payment"
            defaultValue={filters.payment ?? "all"}
            options={paymentOptions.map(([value, label]) => ({ value, label }))}
          />
        </SidebarField>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <SidebarField label="Año" htmlFor="expense-individuals-year">
            <Select
              id="expense-individuals-year"
              name="year"
              defaultValue={filters.year ?? String(new Date().getFullYear())}
              options={yearOptions().map(([value, label]) => ({ value, label }))}
            />
          </SidebarField>

          <SidebarField label="Mes" htmlFor="expense-individuals-month">
            <Select
              id="expense-individuals-month"
              name="month"
              defaultValue={filters.month ?? "all"}
              options={monthOptions.map(([value, label]) => ({ value, label }))}
            />
          </SidebarField>
        </div>

        <Button type="submit" className="w-full">
          Filtrar
        </Button>
      </form>
    </FilterSidebarCard>
  )
}

export function ExpenseIndividualsTable({ expenses }: { expenses: ExpenseIndividualListItem[] }) {
  if (expenses.length === 0) {
    return (
      <EmptyState
        title="No hay gastos para este filtro."
        description="Crea un gasto individual o cambia el año para revisar historicos."
        actions={
          <Button asChild>
            <Link href="/gastos/individuales/nuevo">
              <Plus aria-hidden="true" />
              Nuevo gasto
            </Link>
          </Button>
        }
      />
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gastos individuales</CardTitle>
        <CardDescription>Facturas puntuales con proveedor obligatorio, importes y soporte documental.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-3 lg:hidden">
          {expenses.map((expense) => (
            <MobileRecordCard
              key={`mobile-${expense.id}`}
              eyebrow={expense.invoice_number}
              title={expense.title}
              subtitle={expense.supplier_name}
              headerSlot={<DocumentBadge expense={expense} />}
              footer={
                <MobileRecordActions>
                  <Button asChild type="button" variant="outline" size="sm" className="w-full justify-center">
                    <Link href={`/gastos/individuales/${expense.id}`}>Abrir</Link>
                  </Button>
                </MobileRecordActions>
              }
            >
              <MobileRecordGrid className="grid-cols-2">
                <MobileRecordField label="Fecha" value={formatExpenseDate(expense.expense_date)} />
                <MobileRecordField label="Pago" value={expensePaymentMethodLabels[expense.payment_method]} />
                <MobileRecordField label="Base" value={formatExpenseAmountCompact(expense.net_amount)} />
                <MobileRecordField label="Total" value={formatExpenseAmountCompact(expense.total_amount)} />
              </MobileRecordGrid>
            </MobileRecordCard>
          ))}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Gasto</th>
                <th className="px-4 py-3 text-left font-medium">Proveedor</th>
                <th className="px-4 py-3 text-left font-medium">Fecha</th>
                <th className="px-4 py-3 text-left font-medium">Pago</th>
                <th className="px-4 py-3 text-right font-medium">Base</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-left font-medium">Docs</th>
                <th className="px-4 py-3 text-right font-medium">Ficha</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id} className="border-t border-border/80">
                  <td className="max-w-[28rem] px-4 py-4 align-top">
                    <Link
                      href={`/gastos/individuales/${expense.id}`}
                      className="font-semibold text-foreground no-underline"
                    >
                      {expense.title}
                    </Link>
                    <div className="mt-1 text-xs text-muted-foreground">{expense.invoice_number}</div>
                  </td>
                  <td className="max-w-[18rem] px-4 py-4 align-top text-foreground/85">
                    <span className="inline-flex items-center gap-2 font-semibold text-foreground">
                      <Building2 className="size-3.5 text-primary" aria-hidden="true" />
                      {expense.supplier_name}
                    </span>
                    <div className="mt-1 text-xs text-muted-foreground">{expense.supplier_tax_id}</div>
                  </td>
                  <td className="px-4 py-4 align-top text-foreground/85">
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays className="size-3.5 text-primary" aria-hidden="true" />
                      {formatExpenseDate(expense.expense_date)}
                    </span>
                  </td>
                  <td className="px-4 py-4 align-top text-foreground/85">
                    {expensePaymentMethodLabels[expense.payment_method]}
                  </td>
                  <td className="px-4 py-4 text-right align-top text-foreground/85">
                    {expense.net_amount == null ? "-" : formatExpenseAmountCompact(expense.net_amount)}
                  </td>
                  <td className="px-4 py-4 text-right align-top font-semibold text-foreground">
                    {formatExpenseAmountCompact(expense.total_amount)}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <DocumentBadge expense={expense} />
                  </td>
                  <td className="px-4 py-4 text-right align-top">
                    <Button asChild size="icon-sm" variant="ghost" aria-label={`Abrir ${expense.invoice_number}`}>
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

function SidebarField({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2.5">
      <label className="text-sm font-medium text-foreground" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  )
}

function DocumentBadge({ expense }: { expense: ExpenseIndividualListItem }) {
  if (expense.document_count > 0) {
    return (
      <Badge tone="success">
        <span className="inline-flex items-center gap-1.5">
          <FileText className="size-3" aria-hidden="true" />
          {expense.document_count}
        </span>
      </Badge>
    )
  }

  if (expense.legacy_has_attachment) {
    return <Badge tone="warning">Historico</Badge>
  }

  return <Badge tone="neutral">Sin doc.</Badge>
}
