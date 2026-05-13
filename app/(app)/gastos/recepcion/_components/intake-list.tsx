import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowRight, FileText, Inbox, Mail, Search, Settings2, UploadCloud } from "lucide-react"

import {
  importExpenseInvoiceEmailAction,
  uploadExpenseInvoiceIntakeAction,
} from "@/app/(app)/gastos/recepcion/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { FilterSidebarCard } from "@/components/ui/filter-sidebar-card"
import { Input } from "@/components/ui/input"
import {
  MobileRecordActions,
  MobileRecordCard,
  MobileRecordField,
  MobileRecordGrid,
} from "@/components/ui/mobile-record-card"
import { Select } from "@/components/ui/select"
import { formatExpenseAmountCompact, formatExpenseDate, formatExpenseFileSize } from "@/lib/expenses/format"
import {
  invoiceIntakeSourceLabels,
  invoiceIntakeStatusLabels,
  invoiceIntakeStatusTone,
} from "@/lib/expenses/invoice-intake/format"
import type {
  ExpenseInvoiceIntakeFilters,
  ExpenseInvoiceIntakeListItem,
  ExpenseInvoiceIntakeStatus,
} from "@/lib/expenses/invoice-intake/types"
import type { ExpenseSupplierOption } from "@/lib/expenses/types"
import type { MailOutbox } from "@/lib/mail/types"

const statusOptions: Array<[ExpenseInvoiceIntakeStatus | "all", string]> = [
  ["all", "Todas"],
  ["pendiente", "Pendientes"],
  ["extraida", "Extraidas"],
  ["requiere_revision", "Revision"],
  ["fallida", "Fallidas"],
  ["aprobada", "Aprobadas"],
  ["rechazada", "Rechazadas"],
]

const sourceOptions = [
  ["all", "Todos"],
  ["upload", "Subida"],
  ["email", "Email"],
]

export function ExpenseInvoiceIntakePanel({
  filters,
  suppliers,
  configuredOutbox,
  notice,
}: {
  filters: ExpenseInvoiceIntakeFilters
  suppliers: ExpenseSupplierOption[]
  configuredOutbox?: MailOutbox | null
  notice?: ReactNode
}) {
  return (
    <FilterSidebarCard
      title="Entrada"
      description="Sube PDFs o importa adjuntos recientes desde Microsoft."
      contentClassName="space-y-6 pt-5"
    >
      {notice}

      <form action={uploadExpenseInvoiceIntakeAction} className="space-y-3 rounded-[var(--radius-panel)] border border-dashed border-border bg-[color:var(--surface-2)]/65 p-3.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <UploadCloud className="size-4 text-primary" aria-hidden="true" />
          Subida manual
        </div>
        <Input type="file" name="files" accept="application/pdf,.pdf" multiple required />
        <Button type="submit" className="w-full">
          <UploadCloud aria-hidden="true" />
          Subir PDFs
        </Button>
      </form>

      <form action={importExpenseInvoiceEmailAction} className="space-y-3 rounded-[var(--radius-panel)] border border-border/75 bg-[color:var(--surface-2)]/45 p-3.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Mail className="size-4 text-primary" aria-hidden="true" />
          Importar email
        </div>
        {configuredOutbox ? (
          <div className="rounded-[var(--radius-panel)] border border-border/80 bg-background/70 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium">{configuredOutbox.display_name || configuredOutbox.email_address}</span>
              <Badge tone="success">Configurado</Badge>
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">{configuredOutbox.email_address}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-[var(--radius-panel)] border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No hay buzon asignado a Recepcion de facturas.
            </div>
            <SidebarField label="Buzon compartido" htmlFor="mailbox_email">
              <Input id="mailbox_email" name="mailbox_email" type="email" placeholder="facturas@empresa.com" />
            </SidebarField>
            <Button asChild type="button" className="w-full" variant="outline">
              <Link href="/settings">
                <Settings2 aria-hidden="true" />
                Configurar buzon
              </Link>
            </Button>
          </div>
        )}
        <SidebarField label="Mensajes" htmlFor="max_messages">
          <Input id="max_messages" name="max_messages" type="number" min={1} max={50} defaultValue={25} />
        </SidebarField>
        <Button type="submit" className="w-full" variant="secondary">
          <Inbox aria-hidden="true" />
          Importar adjuntos
        </Button>
      </form>

      <form className="space-y-5 border-t border-border/70 pt-5">
        <SidebarField label="Buscar" htmlFor="invoice-intake-q">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="invoice-intake-q"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Proveedor, factura, email..."
              className="pl-9"
            />
          </div>
        </SidebarField>

        <SidebarField label="Estado" htmlFor="invoice-intake-status">
          <Select
            id="invoice-intake-status"
            name="status"
            defaultValue={filters.status ?? "all"}
            options={statusOptions.map(([value, label]) => ({ value, label }))}
          />
        </SidebarField>

        <SidebarField label="Proveedor" htmlFor="invoice-intake-supplier">
          <Select
            id="invoice-intake-supplier"
            name="supplier"
            defaultValue={filters.supplier ?? "all"}
            options={[
              { value: "all", label: "Todos" },
              ...suppliers.map((supplier) => ({
                value: supplier.id,
                label: `${supplier.name} - ${supplier.tax_id}`,
              })),
            ]}
          />
        </SidebarField>

        <SidebarField label="Origen" htmlFor="invoice-intake-source">
          <Select
            id="invoice-intake-source"
            name="source"
            defaultValue={filters.source ?? "all"}
            options={sourceOptions.map(([value, label]) => ({ value, label }))}
          />
        </SidebarField>

        <div className="grid gap-2">
          <Button type="submit" className="w-full">Filtrar</Button>
          <Button asChild type="button" className="w-full" variant="ghost">
            <Link href="/gastos/recepcion">Borrar todo</Link>
          </Button>
        </div>
      </form>
    </FilterSidebarCard>
  )
}

export function ExpenseInvoiceIntakeTable({ items }: { items: ExpenseInvoiceIntakeListItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No hay facturas en recepcion."
        description="Sube PDFs o importa adjuntos desde email para preparar gastos individuales."
      />
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bandeja de recepcion</CardTitle>
        <CardDescription>PDFs recibidos, extraccion determinista y aprobacion antes de crear gastos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 lg:hidden">
          {items.map((item) => (
            <MobileRecordCard
              key={`mobile-${item.id}`}
              eyebrow={item.invoice_number ?? item.primary_document?.file_name ?? "PDF recibido"}
              title={item.title ?? item.supplier_name ?? "Factura pendiente"}
              subtitle={item.supplier_name ?? invoiceIntakeSourceLabels[item.source_kind]}
              headerSlot={<StatusBadge status={item.status} />}
              footer={
                <MobileRecordActions>
                  <Button asChild type="button" variant="outline" size="sm" className="w-full justify-center">
                    <Link href={`/gastos/recepcion/${item.id}`}>Revisar</Link>
                  </Button>
                </MobileRecordActions>
              }
            >
              <MobileRecordGrid className="grid-cols-2">
                <MobileRecordField label="Fecha" value={formatExpenseDate(item.invoice_date)} />
                <MobileRecordField label="Total" value={formatExpenseAmountCompact(item.total_amount)} />
                <MobileRecordField label="Origen" value={invoiceIntakeSourceLabels[item.source_kind]} />
                <MobileRecordField label="Archivo" value={item.primary_document?.file_name ?? "-"} />
              </MobileRecordGrid>
            </MobileRecordCard>
          ))}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Factura</th>
                <th className="px-4 py-3 text-left font-medium">Proveedor</th>
                <th className="px-4 py-3 text-left font-medium">Origen</th>
                <th className="px-4 py-3 text-left font-medium">Fecha</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-left font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Revisar</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-border/80">
                  <td className="max-w-[24rem] px-4 py-4 align-top">
                    <Link href={`/gastos/recepcion/${item.id}`} className="font-semibold text-foreground no-underline">
                      {item.title ?? item.invoice_number ?? item.primary_document?.file_name ?? "Factura recibida"}
                    </Link>
                    <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                      <FileText className="size-3.5" aria-hidden="true" />
                      <span className="truncate">{item.primary_document?.file_name ?? "Sin documento"}</span>
                    </div>
                    {item.last_error ? <div className="mt-1 text-xs text-amber-700">{item.last_error}</div> : null}
                  </td>
                  <td className="max-w-[18rem] px-4 py-4 align-top text-foreground/85">
                    <span className="block truncate font-semibold text-foreground">{item.supplier_name ?? "Sin proveedor"}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{item.supplier_tax_id ?? "-"}</span>
                  </td>
                  <td className="px-4 py-4 align-top text-foreground/85">
                    <span className="block">{invoiceIntakeSourceLabels[item.source_kind]}</span>
                    <span className="mt-1 block max-w-[12rem] truncate text-xs text-muted-foreground">
                      {item.primary_document?.sender_email ?? item.primary_document?.source_sha256.slice(0, 12) ?? "-"}
                    </span>
                  </td>
                  <td className="px-4 py-4 align-top text-foreground/85">{formatExpenseDate(item.invoice_date)}</td>
                  <td className="px-4 py-4 text-right align-top font-semibold text-foreground">
                    {formatExpenseAmountCompact(item.total_amount)}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <StatusBadge status={item.status} />
                    {item.primary_document ? (
                      <div className="mt-2 text-xs text-muted-foreground">{formatExpenseFileSize(item.primary_document.file_size)}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 text-right align-top">
                    <Button asChild size="icon-sm" variant="ghost" aria-label="Revisar factura">
                      <Link href={`/gastos/recepcion/${item.id}`}>
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

export function StatusBadge({ status }: { status: ExpenseInvoiceIntakeStatus }) {
  return <Badge tone={invoiceIntakeStatusTone(status)}>{invoiceIntakeStatusLabels[status]}</Badge>
}

function SidebarField({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2.5">
      <label className="text-sm font-medium text-foreground" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  )
}
