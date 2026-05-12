import { redirect } from "next/navigation"

import { requireBillingUser } from "@/lib/billing/data"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const { id, documentId } = await params
  const supabase = await createClient()
  await requireBillingUser(supabase, `/facturacion/facturas/${id}`)

  const { data, error } = await supabase
    .from("billing_document_files")
    .select("storage_bucket, storage_path")
    .eq("document_id", id)
    .eq("id", documentId)
    .single()

  if (error || !data) {
    redirect(`/facturacion/facturas/${id}`)
  }

  const document = data as { storage_bucket: string; storage_path: string }
  const { data: signed, error: signedError } = await supabase.storage
    .from(document.storage_bucket)
    .createSignedUrl(document.storage_path, 60)

  if (signedError || !signed?.signedUrl) {
    redirect(`/facturacion/facturas/${id}`)
  }

  redirect(signed.signedUrl)
}
