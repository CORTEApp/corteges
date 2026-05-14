export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function calculateInvoiceTotal(netAmount: number, vatRate: number) {
  return roundMoney(netAmount * (1 + vatRate / 100))
}

export function amountMatchesTotal(netAmount: number, vatRate: number, totalAmount: number) {
  return Math.abs(calculateInvoiceTotal(netAmount, vatRate) - roundMoney(totalAmount)) <= 0.03
}
