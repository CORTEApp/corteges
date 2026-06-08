function toNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }

  const parsed = Number.parseFloat(String(value ?? "").replace(",", "."))
  return Number.isFinite(parsed) ? parsed : 0
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000
}

function clampVatRate(value) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(100, Math.max(0, value))
}

export function calculateSubscriptionRecurringAmounts({
  unitPrice,
  quantity,
  applyVat,
  vatRate,
}) {
  const normalizedUnitPrice = toNumber(unitPrice)
  const normalizedQuantity = Math.max(toNumber(quantity), 0)
  const normalizedVatRate = applyVat ? clampVatRate(toNumber(vatRate ?? 21)) : 0
  const baseAmount = roundMoney(normalizedUnitPrice * normalizedQuantity)
  const taxAmount = roundMoney(baseAmount * (normalizedVatRate / 100))
  const totalAmount = roundMoney(baseAmount + taxAmount)

  return {
    unitPrice: normalizedUnitPrice,
    quantity: normalizedQuantity,
    vatRate: normalizedVatRate,
    baseAmount,
    taxAmount,
    totalAmount,
  }
}
