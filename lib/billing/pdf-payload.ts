import { redirect } from "next/navigation"

import type { ClientRecord } from "@/lib/clients/types"
import { createClient } from "@/lib/supabase/server"
import { requireBillingUser } from "@/lib/billing/data"
import type { BillingDocument, BillingDocumentLine, BillingDocumentType } from "@/lib/billing/types"
import {
  buildBillingDocumentPrintPayload,
  type BillingDocumentPrintPayload,
} from "@/lib/billing/pdf-template-html.mjs"

type BillingDocumentPrintResult = {
  user: Awaited<ReturnType<typeof requireBillingUser>>
  payload: BillingDocumentPrintPayload
}

function documentPath(documentType: BillingDocumentType, documentId?: string) {
  const base = documentType === "invoice" ? "/facturacion/facturas" : "/facturacion/proformas"
  return documentId ? `${base}/${documentId}` : base
}

export async function requireBillingDocumentPrintPayload(
  documentId: string,
  expectedType: BillingDocumentType,
): Promise<BillingDocumentPrintResult> {
  const supabase = await createClient()
  const user = await requireBillingUser(supabase, documentPath(expectedType, documentId))

  const { data: documentData, error: documentError } = await supabase
    .from("billing_documents")
    .select("*")
    .eq("id", documentId)
    .eq("document_type", expectedType)
    .maybeSingle()

  if (documentError) {
    throw documentError
  }

  if (!documentData) {
    redirect(documentPath(expectedType))
  }

  const document = documentData as BillingDocument

  const [
    { data: linesData, error: linesError },
    { data: clientData, error: clientError },
  ] = await Promise.all([
    supabase
      .from("billing_document_lines")
      .select("*")
      .eq("document_id", document.id)
      .order("line_index", { ascending: true }),
    document.client_id
      ? supabase.from("clients").select("*").eq("id", document.client_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (linesError) {
    throw linesError
  }

  if (clientError) {
    throw clientError
  }

  return {
    user,
    payload: buildBillingDocumentPrintPayload({
      document,
      lines: (linesData ?? []) as BillingDocumentLine[],
      client: (clientData as ClientRecord | null) ?? null,
    }),
  }
}
