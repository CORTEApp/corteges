import { createClient } from "@/lib/supabase/server"
import { requireAdminAccess } from "@/lib/users/server"

function contentDispositionFileName(fileName: string) {
  const fallback = fileName.replace(/[^\w.\- ]+/g, "").trim() || "factura.pdf"
  return `inline; filename="${fallback.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const { id, documentId } = await params
  const supabase = await createClient()
  await requireAdminAccess(`/gastos/recepcion/${id}`)

  const { data, error } = await supabase
    .from("expense_invoice_intake_documents")
    .select("file_name, mime_type, storage_bucket, storage_path")
    .eq("item_id", id)
    .eq("id", documentId)
    .single()

  if (error || !data) {
    return new Response("Documento no encontrado.", { status: 404 })
  }

  const document = data as { file_name: string; mime_type: string | null; storage_bucket: string; storage_path: string }
  const { data: file, error: downloadError } = await supabase.storage
    .from(document.storage_bucket)
    .download(document.storage_path)

  if (downloadError || !file) {
    return new Response("No se pudo abrir el documento.", { status: 404 })
  }

  return new Response(file, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": contentDispositionFileName(document.file_name),
      "Content-Type": document.mime_type || "application/pdf",
    },
  })
}
