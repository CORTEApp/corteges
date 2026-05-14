"use client"

import { useMemo, useState } from "react"

import { Input } from "@/components/ui/input"
import { calculateInvoiceTotal } from "@/lib/expenses/invoice-intake/amounts"

type IntakeAmountFieldsProps = {
  initialNetAmount: string
  initialVatRate: string
}

function parseDecimal(value: string) {
  const parsed = Number.parseFloat(value.replace(",", "."))
  return Number.isFinite(parsed) ? parsed : null
}

export function IntakeAmountFields({ initialNetAmount, initialVatRate }: IntakeAmountFieldsProps) {
  const [netAmount, setNetAmount] = useState(initialNetAmount)
  const [vatRate, setVatRate] = useState(initialVatRate)
  const totalAmount = useMemo(() => {
    const net = parseDecimal(netAmount)
    const vat = parseDecimal(vatRate)

    if (net == null || vat == null) {
      return ""
    }

    return calculateInvoiceTotal(net, vat).toFixed(2)
  }, [netAmount, vatRate])

  return (
    <>
      <AmountField label="Base" htmlFor="net_amount">
        <Input
          id="net_amount"
          name="net_amount"
          type="number"
          step="0.01"
          min="0"
          required
          value={netAmount}
          onChange={(event) => setNetAmount(event.target.value)}
        />
      </AmountField>

      <AmountField label="IVA %" htmlFor="vat_rate">
        <Input
          id="vat_rate"
          name="vat_rate"
          type="number"
          step="0.01"
          min="0"
          max="100"
          required
          value={vatRate}
          onChange={(event) => setVatRate(event.target.value)}
        />
      </AmountField>

      <AmountField label="Total" htmlFor="total_amount">
        <Input id="total_amount" name="total_amount" type="number" step="0.01" min="0" readOnly value={totalAmount} />
      </AmountField>
    </>
  )
}

function AmountField({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <label className="grid gap-2" htmlFor={htmlFor}>
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  )
}
