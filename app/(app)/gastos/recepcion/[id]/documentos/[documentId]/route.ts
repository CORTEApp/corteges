import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { requireAdminAccess } from "@/lib/users/server"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const { id, documentId } = await params
  const supabase = await createClient()
  await requireAdminAccess(`/gastos/recepcion/${id}`)

  const { data, error } = await supabase
    .from("expense_invoice_intake_documents")
    .select("storage_bucket, storage_path")
    .eq("item_id", id)
    .eq("id", documentId)
    .single()

  if (error || !data) {
    redirect(`/gastos/recepcion/${id}`)
  }

  const document = data as { storage_bucket: string; storage_path: string }
  const { data: signed, error: signedError } = await supabase.storage
    .from(document.storage_bucket)
    .createSignedUrl(document.storage_path, 60)

  if (signedError || !signed?.signedUrl) {
    redirect(`/gastos/recepcion/${id}`)
  }

  redirect(signed.signedUrl)
}

