function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function summarizeBillingDocumentLineAmounts(lines) {
  const summary = lines.reduce(
    (amounts, line) => {
      amounts.subtotalAmount += Number(line.subtotal_amount ?? 0)
      amounts.taxAmount += Number(line.tax_amount ?? 0)
      amounts.totalAmount += Number(line.total_amount ?? 0)
      return amounts
    },
    { subtotalAmount: 0, taxAmount: 0, totalAmount: 0 },
  )

  return {
    subtotalAmount: roundMoney(summary.subtotalAmount),
    taxAmount: roundMoney(summary.taxAmount),
    totalAmount: roundMoney(summary.totalAmount),
  }
}
