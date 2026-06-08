export type DuplicateInvoiceReference = {
  checkedAt: string | null
  existingExpenseId: string | null
  existingIntakeItemId: string | null
}

export type DuplicateInvoiceMatch = {
  expenseId: string | null
  intakeItemId: string | null
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export function duplicateInvoiceExtractionData(
  extractionData: unknown,
  duplicate: DuplicateInvoiceMatch,
  checkedAt = new Date().toISOString(),
) {
  return {
    ...objectValue(extractionData),
    duplicate_invoice: {
      detected: true,
      checked_at: checkedAt,
      existing_expense_id: duplicate.expenseId,
      existing_intake_item_id: duplicate.intakeItemId,
    },
  }
}

export function parseDuplicateInvoiceReference(value: unknown): DuplicateInvoiceReference | null {
  const duplicateInvoice = objectValue(objectValue(value).duplicate_invoice)

  if (duplicateInvoice.detected !== true) {
    return null
  }

  const existingExpenseId = textValue(duplicateInvoice.existing_expense_id)
  const existingIntakeItemId = textValue(duplicateInvoice.existing_intake_item_id)

  if (!existingExpenseId && !existingIntakeItemId) {
    return null
  }

  return {
    checkedAt: textValue(duplicateInvoice.checked_at),
    existingExpenseId,
    existingIntakeItemId,
  }
}
