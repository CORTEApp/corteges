import Link from "next/link"
import { FileUp, Trash2 } from "lucide-react"

import { FormSubmitButton } from "@/components/ui/form-submit-button"
import { deleteClientDocumentAction, uploadClientDocumentAction } from "@/app/(app)/clientes/actions"
import { formatDate, formatFileSize } from "@/lib/clients/format"
import type { ClientDocument } from "@/lib/clients/types"

import { SectionTitle } from "./form-controls"

export function DocumentSection({
  clientId,
  documents,
  mode = "manage",
}: {
  clientId: string
  documents: ClientDocument[]
  mode?: "read" | "manage"
}) {
  const canManage = mode === "manage"

  return (
    <section id="documentos" className="rounded-[var(--radius-shell)] border border-border/80 bg-[color:var(--surface-1)] p-5 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.24)]">
      <SectionTitle
        title="Documentos"
        note={canManage ? "Contratos, requisitos y soporte documental en Storage privado por cliente." : "Lectura de documentos asociados; las altas y borrados se realizan desde edición."}
      />

      {canManage ? (
        <form action={uploadClientDocumentAction} className="mt-5 grid gap-3 rounded-[var(--radius-panel)] border border-dashed border-border bg-[color:var(--surface-2)]/70 p-4 md:grid-cols-[1fr_auto]">
          <input type="hidden" name="client_id" value={clientId} />
          <label className="grid gap-2">
            <span className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Subir archivo</span>
            <input
              type="file"
              name="file"
              required
              className="rounded-[var(--radius-panel)] border border-input/85 bg-[color:var(--surface-1)] px-3 py-2 text-sm text-foreground"
            />
          </label>
          <FormSubmitButton className="self-end" pendingLabel="Subiendo documento...">
            <FileUp aria-hidden="true" />
            Subir
          </FormSubmitButton>
        </form>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-[var(--radius-panel)] border border-border/80">
        {documents.length === 0 ? (
          <div className="bg-[color:var(--surface-1)] p-6 text-sm text-muted-foreground">No hay documentos subidos para este cliente.</div>
        ) : (
          <div className="divide-y divide-border/80">
            {documents.map((document) => (
              <div
                key={document.id}
                className={`grid gap-3 bg-[color:var(--surface-1)] p-4 transition hover:bg-[color:var(--surface-2)]/70 ${canManage ? "md:grid-cols-[1fr_120px_120px_auto]" : "md:grid-cols-[1fr_120px_120px]"} md:items-center`}
              >
                <div className="min-w-0">
                  <Link
                    href={`/clientes/${clientId}/documentos/${document.id}`}
                    className="block truncate font-semibold text-foreground no-underline hover:underline"
                  >
                    {document.file_name}
                  </Link>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {document.source_kind === "sharepoint" ? "Archivo disponible" : "Subido a CORTE.Ges"}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">{formatFileSize(document.file_size)}</div>
                <div className="text-sm text-muted-foreground">{formatDate(document.created_at)}</div>
                {canManage ? (
                  <form action={deleteClientDocumentAction} className="justify-self-start md:justify-self-end">
                    <input type="hidden" name="client_id" value={clientId} />
                    <input type="hidden" name="document_id" value={document.id} />
                    <FormSubmitButton pendingLabel="Borrando..." variant="ghost" size="sm">
                      <Trash2 aria-hidden="true" />
                      Borrar
                    </FormSubmitButton>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
