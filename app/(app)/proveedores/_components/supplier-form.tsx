import Link from "next/link"
import { Save } from "lucide-react"

import { saveSupplierAction } from "@/app/(app)/proveedores/actions"
import { Field, SectionTitle, SelectField, TextAreaField } from "@/app/(app)/clientes/_components/form-controls"
import { Button } from "@/components/ui/button"
import { supplierPaymentMethodLabels } from "@/lib/suppliers/format"
import type { SupplierPaymentMethod, SupplierRecord } from "@/lib/suppliers/types"

const paymentOptions: SupplierPaymentMethod[] = ["unknown", "stripe", "sepa", "transfer", "other"]
const sectionClassName =
  "rounded-[var(--radius-shell)] border border-border/80 bg-[color:var(--surface-1)] p-5 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.24)] backdrop-blur-sm"

export function SupplierForm({
  supplier,
  cancelHref = "/proveedores",
}: {
  supplier?: SupplierRecord
  cancelHref?: string
}) {
  return (
    <form action={saveSupplierAction} className="grid gap-8">
      {supplier ? <input type="hidden" name="supplier_id" value={supplier.id} /> : null}

      <section className={sectionClassName}>
        <SectionTitle
          title="Identidad"
          note="El identificador fiscal, la denominación y si la relación sigue vigente."
        />
        <div className="mt-5 grid gap-4 md:grid-cols-6">
          <Field
            label="CIF"
            name="tax_id"
            required
            defaultValue={supplier?.tax_id}
            placeholder="B93434181"
            className="grid gap-2 md:col-span-2"
          />
          <Field
            label="Nombre"
            name="name"
            required
            defaultValue={supplier?.name}
            placeholder="OFERPLAY DESIGN S.L."
            className="grid gap-2 md:col-span-4"
          />
          <Field
            label="Fecha de inicio"
            name="start_date"
            type="date"
            defaultValue={supplier?.start_date}
            className="grid gap-2 md:col-span-2"
          />
          <label className="flex h-full items-end gap-3 rounded-[var(--radius-panel)] border border-input/85 bg-[color:var(--surface-2)] px-4 py-3 md:col-span-2">
            <input
              type="checkbox"
              name="active"
              defaultChecked={supplier?.active ?? true}
              className="size-4 rounded-[var(--radius-control)] border-input accent-primary"
            />
            <span className="text-sm font-semibold text-foreground">Proveedor activo</span>
          </label>
        </div>
      </section>

      <section className={sectionClassName}>
        <SectionTitle
          title="Contacto"
          note="La persona y canales para resolver facturas, contratos o incidencias."
        />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Nombre de contacto" name="contact_name" defaultValue={supplier?.contact_name} />
          <Field label="Teléfono de contacto" name="contact_phone" defaultValue={supplier?.contact_phone} />
          <Field label="Correo de contacto" name="contact_email" type="email" defaultValue={supplier?.contact_email} />
        </div>
      </section>

      <section className={sectionClassName}>
        <SectionTitle
          title="Pago"
          note="Referencias administrativas para proveedores con domiciliación o Stripe."
        />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <SelectField label="Método de pago" name="payment_method" defaultValue={supplier?.payment_method ?? "unknown"}>
            {paymentOptions.map((option) => (
              <option key={option} value={option}>
                {supplierPaymentMethodLabels[option]}
              </option>
            ))}
          </SelectField>
          <Field label="Referencia SEPA" name="sepa_reference" defaultValue={supplier?.sepa_reference} />
          <Field label="Referencia Stripe" name="stripe_reference" defaultValue={supplier?.stripe_reference} />
        </div>
      </section>

      <section className={sectionClassName}>
        <SectionTitle title="Comentarios" note="Contexto operativo que ayuda a decidir rápido." />
        <div className="mt-5">
          <TextAreaField
            label="Notas internas"
            name="comments"
            defaultValue={supplier?.comments}
            placeholder="Calidad del servicio, incidencias, sensibilidad o condiciones pactadas..."
          />
        </div>
      </section>

      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-shell)] border border-border/80 bg-[color:var(--surface-1)] px-5 py-4 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.24)]">
        <Button asChild variant="outline">
          <Link href={cancelHref}>Volver</Link>
        </Button>
        <Button type="submit">
          <Save aria-hidden="true" />
          Guardar proveedor
        </Button>
      </div>
    </form>
  )
}
