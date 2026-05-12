import { redirect } from "next/navigation"

import { requireExpenseUser } from "@/lib/expenses/data"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const { id, documentId } = await params
  const supabase = await createClient()
  await requireExpenseUser(supabase, `/gastos/individuales/${id}`)

  const { data, error } = await supabase
    .from("expense_individual_documents")
    .select("storage_bucket, storage_path")
    .eq("expense_id", id)
    .eq("id", documentId)
    .single()

  if (error || !data) {
    redirect(`/gastos/individuales/${id}#documentos`)
  }

  const document = data as { storage_bucket: string; storage_path: string }
  const { data: signed, error: signedError } = await supabase.storage
    .from(document.storage_bucket)
    .createSignedUrl(document.storage_path, 60)

  if (signedError || !signed?.signedUrl) {
    redirect(`/gastos/individuales/${id}#documentos`)
  }

  redirect(signed.signedUrl)
}
