import type { BillingDocumentPrintPayload } from "@/lib/billing/pdf-template-html.mjs"
import { buildBillingDocumentPrintHtml } from "@/lib/billing/pdf-template-html.mjs"

export function BillingDocumentPrintTemplate({ payload }: { payload: BillingDocumentPrintPayload }) {
  return <div dangerouslySetInnerHTML={{ __html: buildBillingDocumentPrintHtml(payload) }} />
}
