export const EXPENSE_INVOICE_INTAKE_MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024
export const EXPENSE_INVOICE_INTAKE_PDF_MIME_TYPE = "application/pdf"

export type PdfValidationResult =
  | { ok: true }
  | { ok: false; reason: "empty" | "too_large" | "invalid_signature" }

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d] as const

export function hasPdfFileExtension(fileName: string | null | undefined) {
  return String(fileName ?? "").trim().toLowerCase().endsWith(".pdf")
}

export function hasPdfMimeType(mimeType: string | null | undefined) {
  return String(mimeType ?? "").toLowerCase().includes("pdf")
}

export function isLikelyPdfAttachment(fileName: string | null | undefined, mimeType: string | null | undefined) {
  return hasPdfFileExtension(fileName) || hasPdfMimeType(mimeType)
}

export function hasPdfSignature(data: Uint8Array) {
  if (data.byteLength < PDF_SIGNATURE.length) {
    return false
  }

  for (let index = 0; index < PDF_SIGNATURE.length; index += 1) {
    if (data[index] !== PDF_SIGNATURE[index]) {
      return false
    }
  }

  return true
}

export function validatePdfBuffer(
  data: Uint8Array,
  maxBytes = EXPENSE_INVOICE_INTAKE_MAX_PDF_SIZE_BYTES,
): PdfValidationResult {
  if (data.byteLength === 0) {
    return { ok: false, reason: "empty" }
  }

  if (data.byteLength > maxBytes) {
    return { ok: false, reason: "too_large" }
  }

  if (!hasPdfSignature(data)) {
    return { ok: false, reason: "invalid_signature" }
  }

  return { ok: true }
}
