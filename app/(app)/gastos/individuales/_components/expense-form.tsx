"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Save } from "lucide-react"

import { saveExpenseIndividualAction } from "@/app/(app)/gastos/individuales/actions"
import { SectionTitle } from "@/app/(app)/clientes/_components/form-controls"
import { Button } from "@/components/ui/button"
import { FormSubmitButton } from "@/components/ui/form-submit-button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  expensePaymentMethodLabels,
  formatExpenseAmount,
  toExpenseNumber,
} from "@/lib/expenses/format"
import type {
  ExpenseIndividualRecord,
  ExpensePaymentMethod,
  ExpenseSupplierOption,
} from "@/lib/expenses/types"

const sectionClassName =
  "rounded-[var(--radius-shell)] border border-border/80 bg-[color:var(--surface-1)] p-5 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.24)] backdrop-blur-sm"
const paymentOptions: ExpensePaymentMethod[] = ["n26", "caixa", "other"]
const vatOptions = ["0", "21"]

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function numberFieldValue(value: number | string | null | undefined, fallback = 0) {
  return String(toExpenseNumber(value ?? fallback))
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function ExpenseIndividualForm({
  expense,
  suppliers,
  cancelHref = "/gastos/individuales",
}: {
  expense?: ExpenseIndividualRecord
  suppliers: ExpenseSupplierOption[]
  cancelHref?: string
}) {
  const initialSupplier = suppliers.find((supplier) => supplier.id === expense?.supplier_id) ?? suppliers[0]
  const [supplierId, setSupplierId] = useState(expense?.supplier_id ?? initialSupplier?.id ?? "")
  const [netAmount, setNetAmount] = useState(numberFieldValue(expense?.net_amount, 0))
  const [vatRate, setVatRate] = useState(numberFieldValue(expense?.vat_rate, 0))
  const supplierById = useMemo(() => new Map(suppliers.map((supplier) => [supplier.id, supplier])), [suppliers])
  const selectedSupplier = supplierById.get(supplierId)
  const calculatedTotal = roundMoney(toExpenseNumber(netAmount) * (1 + toExpenseNumber(vatRate) / 100))

  return (
    <form action={saveExpenseIndividualAction} className="grid gap-8">
      {expense ? <input type="hidden" name="expense_id" value={expense.id} /> : null}

      <section className={sectionClassName}>
        <SectionTitle
          title="Proveedor"
          note="Cada gasto individual queda vinculado a un proveedor del maestro y guarda snapshot fiscal."
        />
        <div className="mt-5 grid gap-4 md:grid-cols-6">
          <label className="grid gap-2 md:col-span-4">
            <span className="text-sm font-medium text-foreground">Proveedor</span>
            <Select
              name="supplier_id"
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
              required
              placeholder="Seleccionar proveedor"
              options={suppliers.map((supplier) => ({
                value: supplier.id,
                label: `${supplier.name} · ${supplier.tax_id}${supplier.active ? "" : " · inactivo"}`,
              }))}
            />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">CIF snapshot</span>
            <Input value={selectedSupplier?.tax_id ?? ""} readOnly />
          </label>
        </div>
      </section>

      <section className={sectionClassName}>
        <SectionTitle
          title="Factura"
          note="Titulo operativo, numero de factura del proveedor y fecha del gasto."
        />
        <div className="mt-5 grid gap-4 md:grid-cols-6">
          <label className="grid gap-2 md:col-span-3">
            <span className="text-sm font-medium text-foreground">Titulo</span>
            <Input name="title" required defaultValue={expense?.title ?? ""} placeholder="CargosCORTE.APP" />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Factura</span>
            <Input name="invoice_number" required defaultValue={expense?.invoice_number ?? ""} placeholder="ES-TI2600371748" />
          </label>
          <label className="grid gap-2 md:col-span-1">
            <span className="text-sm font-medium text-foreground">Fecha</span>
            <Input name="expense_date" type="date" required defaultValue={expense?.expense_date ?? todayISO()} />
          </label>
        </div>
      </section>

      <section className={sectionClassName}>
        <SectionTitle
          title="Pago e importes"
          note="En altas y ediciones el total se calcula desde base imponible e IVA."
        />
        <div className="mt-5 grid gap-4 md:grid-cols-6">
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Metodo de pago</span>
            <Select
              name="payment_method"
              defaultValue={expense?.payment_method ?? "n26"}
              options={paymentOptions.map((option) => ({
                value: option,
                label: expensePaymentMethodLabels[option],
              }))}
            />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Base</span>
            <Input
              name="net_amount"
              type="number"
              min="0"
              step="0.0001"
              inputMode="decimal"
              value={netAmount}
              onChange={(event) => setNetAmount(event.target.value)}
              required
            />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">IVA</span>
            <Select
              name="vat_rate"
              value={vatRate}
              onChange={(event) => setVatRate(event.target.value)}
              options={vatOptions.map((option) => ({
                value: option,
                label: `${option} %`,
              }))}
            />
          </label>
        </div>

        <div className="mt-5 grid gap-3 rounded-[var(--radius-panel)] border border-primary/15 bg-primary/8 p-4 md:grid-cols-3">
          <TotalPill label="Base" value={toExpenseNumber(netAmount)} />
          <TotalPill label="Total al guardar" value={calculatedTotal} strong />
          <TotalPill label="Total actual" value={toExpenseNumber(expense?.total_amount ?? calculatedTotal)} />
        </div>
      </section>

      <section className={sectionClassName}>
        <SectionTitle title="Observaciones" note="Notas internas o aclaraciones heredadas de SharePoint." />
        <div className="mt-5">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Observaciones</span>
            <Textarea
              name="notes"
              defaultValue={expense?.notes ?? ""}
              placeholder="Automatizado, credito, ajuste o contexto de contabilizacion..."
              data-filled={expense?.notes ? "true" : "false"}
            />
          </label>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-shell)] border border-border/80 bg-[color:var(--surface-1)] px-5 py-4 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.24)]">
        <Button asChild variant="outline">
          <Link href={cancelHref}>Volver</Link>
        </Button>
        <FormSubmitButton pendingLabel="Guardando...">
          <Save aria-hidden="true" />
          Guardar gasto
        </FormSubmitButton>
      </div>
    </form>
  )
}

function TotalPill({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[var(--radius-panel)] bg-[color:var(--surface-1)] px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={strong ? "text-base font-bold text-foreground" : "text-sm font-semibold text-foreground"}>
        {formatExpenseAmount(value)}
      </span>
    </div>
  )
}
