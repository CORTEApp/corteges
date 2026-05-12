import Link from "next/link"
import type { HTMLAttributes } from "react"
import { Save } from "lucide-react"

import { saveFacturableAction } from "@/app/(app)/facturacion/facturables/actions"
import { FacturableCodeField } from "@/app/(app)/facturacion/facturables/_components/facturable-code-field"
import { Button } from "@/components/ui/button"
import { FormSubmitButton } from "@/components/ui/form-submit-button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { BILLING_FACTURABLE_TYPES, BILLING_FACTURABLE_UNITS, type BillingFacturable } from "@/lib/billing/types"

const sectionClassName =
  "rounded-[var(--radius-shell)] border border-border/80 bg-[color:var(--surface-1)] p-5 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.24)] backdrop-blur-sm"

export function FacturableForm({
  facturable,
  existingCodes = [],
  cancelHref = "/facturacion/facturables",
}: {
  facturable?: BillingFacturable
  existingCodes?: string[]
  cancelHref?: string
}) {
  return (
    <form action={saveFacturableAction} className="grid gap-8">
      {facturable ? <input type="hidden" name="facturable_id" value={facturable.id} /> : null}

      <section className={sectionClassName}>
        <SectionTitle
          title="Concepto"
          note="Identifica el producto, licencia, servicio o descuento que puede entrar en presupuestos o facturación futura."
        />
        <div className="mt-5 grid gap-4 md:grid-cols-6">
          <FacturableCodeField
            defaultValue={facturable?.code}
            existingCodes={existingCodes}
            className="grid gap-2 md:col-span-2"
          />
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Tipo</span>
            <Select
              name="type"
              defaultValue={facturable?.type ?? "Otro"}
              options={BILLING_FACTURABLE_TYPES.map((value) => ({ value, label: value }))}
            />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Tipo de unidad</span>
            <Select
              name="unit_type"
              defaultValue={facturable?.unit_type ?? "Unidad"}
              options={BILLING_FACTURABLE_UNITS.map((value) => ({ value, label: value }))}
            />
          </label>
          <label className="grid gap-2 md:col-span-6">
            <span className="text-sm font-medium text-foreground">Descripción</span>
            <Input
              name="description"
              required
              defaultValue={facturable?.description ?? ""}
              placeholder="Programación aplicación"
              data-filled={facturable?.description ? "true" : "false"}
            />
          </label>
        </div>
      </section>

      <section className={sectionClassName}>
        <SectionTitle
          title="Precio"
          note="Importe base del concepto. Admite valores negativos para descuentos."
        />
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Field
            label="Precio"
            name="unit_price"
            required
            inputMode="decimal"
            defaultValue={facturable?.unit_price ?? 0}
            placeholder="60"
          />
        </div>
      </section>

      <section className={sectionClassName}>
        <SectionTitle title="Estado y notas" note="Desactivar sustituye al borrado físico de PowerApps." />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="flex h-full items-center gap-3 rounded-[var(--radius-panel)] border border-input/85 bg-[color:var(--surface-2)] px-4 py-3">
            <input
              type="checkbox"
              name="active"
              defaultChecked={facturable?.active ?? true}
              className="size-4 rounded-[var(--radius-control)] border-input accent-primary"
            />
            <span className="text-sm font-semibold text-foreground">Activo</span>
          </label>
          <label className="flex h-full items-center gap-3 rounded-[var(--radius-panel)] border border-input/85 bg-[color:var(--surface-2)] px-4 py-3">
            <input
              type="checkbox"
              name="is_current"
              defaultChecked={facturable?.is_current ?? true}
              className="size-4 rounded-[var(--radius-control)] border-input accent-primary"
            />
            <span className="text-sm font-semibold text-foreground">Vigente</span>
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Comentarios</span>
            <Textarea
              name="comments"
              defaultValue={facturable?.comments ?? ""}
              placeholder="Notas internas del concepto"
              data-filled={facturable?.comments ? "true" : "false"}
            />
          </label>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-shell)] border border-border/80 bg-[color:var(--surface-1)] px-5 py-4 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.24)]">
        <Button asChild variant="outline">
          <Link href={cancelHref}>Volver</Link>
        </Button>
        <FormSubmitButton pendingLabel="Guardando...">
          <Save aria-hidden="true" />
          Guardar facturable
        </FormSubmitButton>
      </div>
    </form>
  )
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  required = false,
  className,
  inputMode,
}: {
  label: string
  name: string
  defaultValue?: string | number | null
  placeholder?: string
  required?: boolean
  className?: string
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"]
}) {
  return (
    <label className={className ?? "grid gap-2"}>
      <span className="text-sm font-medium text-foreground">{label}</span>
      <Input
        name={name}
        required={required}
        inputMode={inputMode}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        data-filled={defaultValue ? "true" : "false"}
      />
    </label>
  )
}

function SectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-border/70 pb-3">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        {note ? <p className="mt-1 text-sm leading-5 text-muted-foreground">{note}</p> : null}
      </div>
    </div>
  )
}
