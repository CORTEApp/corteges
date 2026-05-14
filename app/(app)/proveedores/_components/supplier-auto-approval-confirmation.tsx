"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, ShieldCheck } from "lucide-react"

import { approveSupplierExtractedInvoicesAction } from "@/app/(app)/proveedores/actions"
import { Button } from "@/components/ui/button"
import { FormSubmitButton } from "@/components/ui/form-submit-button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FormSection } from "@/components/ui/form-section"

export function SupplierAutoApprovalConfirmation({
  supplierId,
  candidateCount,
  cancelHref,
}: {
  supplierId: string
  candidateCount: number
  cancelHref: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(candidateCount > 0)

  const closeAndCleanUrl = useCallback(() => {
    setOpen(false)
    router.replace(cancelHref, { scroll: false })
  }, [cancelHref, router])

  if (candidateCount <= 0) {
    return null
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeAndCleanUrl()
        }
      }}
    >
      <DialogContent className="border-border/80 bg-[color:var(--surface-1)] sm:max-w-xl">
        <DialogHeader className="pr-8">
          <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
            <DialogTitle>Aprobación automática activada</DialogTitle>
            <span className="inline-flex rounded-[var(--radius-pill)] border border-primary/15 bg-primary/10 px-2.5 py-1 text-[0.72rem] font-semibold text-primary">
              {candidateCount} extraída{candidateCount === 1 ? "" : "s"}
            </span>
          </div>
          <DialogDescription>
            Hay facturas extraídas de este proveedor listas para crear gasto individual.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-3 rounded-[var(--radius-panel)] border border-primary/15 bg-primary/5 px-4 py-3 text-sm leading-6 text-muted-foreground">
          <ShieldCheck className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>
            Se aprobarán solo las facturas completas, con moneda válida y sin duplicados fiscales en el momento de confirmar.
          </span>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={closeAndCleanUrl}>
            No aprobar ahora
          </Button>
          <form action={approveSupplierExtractedInvoicesAction}>
            <input type="hidden" name="supplier_id" value={supplierId} />
            <FormSubmitButton pendingLabel="Aprobando facturas...">
              <CheckCircle2 aria-hidden="true" />
              Aprobar facturas extraídas
            </FormSubmitButton>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function SupplierAutoApprovalResult({
  approved,
  failed,
  visible,
}: {
  approved: number
  failed: number
  visible: boolean
}) {
  if (!visible) {
    return null
  }

  return (
    <FormSection
      className="border-l-4 border-l-primary/55"
      title="Aprobación automática procesada"
      description={`Aprobadas: ${approved}. Pendientes de revisión: ${failed}.`}
      contentClassName="text-sm leading-6 text-muted-foreground"
    >
      Las facturas aprobadas ya están en gastos individuales. Las que no hayan podido completarse quedan registradas en recepción.
    </FormSection>
  )
}
