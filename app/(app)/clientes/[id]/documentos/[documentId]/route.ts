import { redirect } from "next/navigation"

import { requireAppUser } from "@/lib/clients/data"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const { id, documentId } = await params
  const supabase = await createClient()
  await requireAppUser(supabase, `/clientes/${id}`)

  const { data, error } = await supabase
    .from("client_documents")
    .select("storage_bucket, storage_path")
    .eq("client_id", id)
    .eq("id", documentId)
    .single()

  if (error || !data) {
    redirect(`/clientes/${id}#documentos`)
  }

  const document = data as { storage_bucket: string; storage_path: string }
  const { data: signed, error: signedError } = await supabase.storage
    .from(document.storage_bucket)
    .createSignedUrl(document.storage_path, 60)

  if (signedError || !signed?.signedUrl) {
    redirect(`/clientes/${id}#documentos`)
  }

  redirect(signed.signedUrl)
}
