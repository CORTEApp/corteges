export type ApprovalLineAmountInput = {
  recurringTotalAmount: number | string | null | undefined
  quantity: number | string | null | undefined
  applyVat: boolean
  vatRate?: number | string | null | undefined
}

export type ApprovalLineAmountResult = {
  quantity: number
  unitPrice: number
  vatRate: number
  subtotalAmount: number
  taxAmount: number
  totalAmount: number
}

export function calculateApprovalLineAmounts(input: ApprovalLineAmountInput): ApprovalLineAmountResult
