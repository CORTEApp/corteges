import Link from "next/link"
import { FileUp, Trash2 } from "lucide-react"

import {
  deleteExpenseIndividualDocumentAction,
  uploadExpenseIndividualDocumentAction,
} from "@/app/(app)/gastos/individuales/actions"
import { SectionTitle } from "@/app/(app)/clientes/_components/form-controls"
import { FormSubmitButton } from "@/components/ui/form-submit-button"
import { formatExpenseDate, formatExpenseFileSize } from "@/lib/expenses/format"
import type { ExpenseIndividualDocument } from "@/lib/expenses/types"

export function ExpenseDocumentSection({
  expenseId,
  documents,
  legacyHasAttachment,
  mode = "manage",
}: {
  expenseId: string
  documents: ExpenseIndividualDocument[]
  legacyHasAttachment: boolean
  mode?: "read" | "manage"
}) {
  const canManage = mode === "manage"
  const recoveredDocuments = documents.filter((document) => document.source_kind === "sharepoint").length

  return (
    <section
      id="documentos"
      className="rounded-[var(--radius-shell)] border border-border/80 bg-[color:var(--surface-1)] p-5 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.24)]"
    >
      <SectionTitle
        title="Documentos"
        note={canManage ? "Facturas y soporte documental en Storage privado por gasto." : "Lectura de documentos asociados; las altas y borrados se realizan desde edicion."}
      />

      {legacyHasAttachment ? (
        <div className="mt-5 rounded-[var(--radius-panel)] border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          {recoveredDocuments > 0
            ? `Hay ${recoveredDocuments} archivo${recoveredDocuments === 1 ? "" : "s"} disponible${recoveredDocuments === 1 ? "" : "s"} para este gasto.`
            : "Este gasto tiene adjuntos pendientes de estar disponibles en la app."}
        </div>
      ) : null}

      {canManage ? (
        <form
          action={uploadExpenseIndividualDocumentAction}
          className="mt-5 grid gap-3 rounded-[var(--radius-panel)] border border-dashed border-border bg-[color:var(--surface-2)]/70 p-4 md:grid-cols-[1fr_auto]"
        >
          <input type="hidden" name="expense_id" value={expenseId} />
          <label className="grid gap-2">
            <span className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Subir factura</span>
            <input
              type="file"
              name="files"
              multiple
              required
              className="rounded-[var(--radius-panel)] border border-input/85 bg-[color:var(--surface-1)] px-3 py-2 text-sm text-foreground"
            />
          </label>
          <FormSubmitButton className="self-end" pendingLabel="Subiendo factura...">
            <FileUp aria-hidden="true" />
            Subir
          </FormSubmitButton>
        </form>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-[var(--radius-panel)] border border-border/80">
        {documents.length === 0 ? (
          <div className="bg-[color:var(--surface-1)] p-6 text-sm text-muted-foreground">No hay documentos subidos para este gasto.</div>
        ) : (
          <div className="divide-y divide-border/80">
            {documents.map((document) => (
              <div
                key={document.id}
                className={`grid gap-3 bg-[color:var(--surface-1)] p-4 transition hover:bg-[color:var(--surface-2)]/70 ${canManage ? "md:grid-cols-[1fr_120px_120px_auto]" : "md:grid-cols-[1fr_120px_120px]"} md:items-center`}
              >
                <div className="min-w-0">
                  <Link
                    href={`/gastos/individuales/${expenseId}/documentos/${document.id}`}
                    className="block truncate font-semibold text-foreground no-underline hover:underline"
                  >
                    {document.file_name}
                  </Link>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {document.source_kind === "sharepoint" ? "Archivo disponible" : "Subido a CORTE.Ges"}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">{formatExpenseFileSize(document.file_size)}</div>
                <div className="text-sm text-muted-foreground">{formatExpenseDate(document.created_at)}</div>
                {canManage ? (
                  <details className="justify-self-start md:justify-self-end">
                    <summary className="cursor-pointer rounded-[var(--radius-panel)] px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10">
                      Borrar
                    </summary>
                    <form action={deleteExpenseIndividualDocumentAction} className="mt-2 grid gap-2 rounded-[var(--radius-panel)] border border-destructive/25 bg-destructive/5 p-2">
                      <input type="hidden" name="expense_id" value={expenseId} />
                      <input type="hidden" name="document_id" value={document.id} />
                      <FormSubmitButton pendingLabel="Borrando..." variant="ghost" size="sm">
                        <Trash2 aria-hidden="true" />
                        Confirmar
                      </FormSubmitButton>
                    </form>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
