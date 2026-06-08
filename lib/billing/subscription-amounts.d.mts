export type SubscriptionRecurringAmountInput = {
  unitPrice: number | string | null | undefined
  quantity: number | string | null | undefined
  applyVat: boolean
  vatRate?: number | string | null | undefined
}

export type SubscriptionRecurringAmountResult = {
  unitPrice: number
  quantity: number
  vatRate: number
  baseAmount: number
  taxAmount: number
  totalAmount: number
}

export function calculateSubscriptionRecurringAmounts(
  input: SubscriptionRecurringAmountInput,
): SubscriptionRecurringAmountResult
