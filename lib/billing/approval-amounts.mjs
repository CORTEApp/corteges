function toNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }

  const parsed = Number.parseFloat(String(value ?? "").replace(",", "."))
  return Number.isFinite(parsed) ? parsed : 0
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function roundUnit(value) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000
}

function clampVatRate(value) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(100, Math.max(0, value))
}

export function calculateApprovalLineAmounts({
  recurringTotalAmount,
  quantity,
  applyVat,
  vatRate,
}) {
  const normalizedQuantity = Math.max(toNumber(quantity), 0.0001)
  const totalAmount = roundMoney(toNumber(recurringTotalAmount))
  const normalizedVatRate = applyVat ? clampVatRate(toNumber(vatRate ?? 21)) : 0
  const subtotalAmount = normalizedVatRate > 0
    ? roundMoney(totalAmount / (1 + normalizedVatRate / 100))
    : totalAmount
  const taxAmount = roundMoney(totalAmount - subtotalAmount)
  const unitPrice = roundUnit(subtotalAmount / normalizedQuantity)

  return {
    quantity: normalizedQuantity,
    unitPrice,
    vatRate: normalizedVatRate,
    subtotalAmount,
    taxAmount,
    totalAmount,
  }
}
