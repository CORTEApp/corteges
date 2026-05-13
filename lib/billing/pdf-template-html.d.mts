import type { ClientRecord } from "@/lib/clients/types"
import type { BillingDocument, BillingDocumentLine } from "@/lib/billing/types"

export type BillingDocumentPrintClient = {
  name: string
  taxId: string
  address: string
  contactName: string
  contactPhone: string
  email: string
}

export type BillingDocumentPrintIssuer = {
  name: string
  taxId: string
  email: string
  website: string
}

export type BillingDocumentPrintLabels = {
  title: string
  dateLabel: string
  numberLabel: string
  paymentDateLabel: string
  paymentMethodLabel: string
  taxIdLabel: string
  conceptLabel: string
}

export type BillingDocumentPrintPayload = {
  issuer: BillingDocumentPrintIssuer
  labels: BillingDocumentPrintLabels
  document: BillingDocument
  lines: BillingDocumentLine[]
  client: BillingDocumentPrintClient
  concept: string
  paymentMethodLabel: string
  generatedFileName: string
  generatedStoragePath: string
}

export const BILLING_PDF_ISSUER: BillingDocumentPrintIssuer
export const billingDocumentPrintStyles: string

export function toPdfNumber(value: number | string | null | undefined): number
export function formatPdfCurrency(value: number | string | null | undefined): string
export function formatPdfQuantity(value: number | string | null | undefined): string
export function formatPdfPercent(value: number | string | null | undefined): string
export function formatPdfDate(value?: string | null): string
export function sanitizeBillingPdfFilePart(value: unknown): string
export function buildGeneratedPdfFileName(document: BillingDocument): string
export function buildGeneratedPdfStoragePath(document: BillingDocument): string
export function billingDocumentPdfLabels(documentType: BillingDocument["document_type"]): BillingDocumentPrintLabels
export function buildBillingDocumentPrintPayload(input: {
  document: BillingDocument
  lines: BillingDocumentLine[]
  client?: ClientRecord | null
  issuer?: BillingDocumentPrintIssuer
}): BillingDocumentPrintPayload
export function buildBillingDocumentPrintHtml(
  payload: BillingDocumentPrintPayload,
  options?: { fullDocument?: boolean; assetBaseUrl?: string },
): string
