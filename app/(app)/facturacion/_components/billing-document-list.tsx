import Link from "next/link"
import { ArrowRight, FilePlus2, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { FilterSidebarCard } from "@/components/ui/filter-sidebar-card"
import { Input } from "@/components/ui/input"
import { MobileRecordActions, MobileRecordCard, MobileRecordField, MobileRecordGrid } from "@/components/ui/mobile-record-card"
import { Select } from "@/components/ui/select"
import {
  billingDocumentStatusLabels,
  billingDocumentStatusTone,
  billingPaymentStatusLabels,
  billingPaymentStatusTone,
  formatAmount,
  formatDate,
} from "@/lib/billing/format"
import type { BillingDocumentFilters, BillingDocumentListItem, BillingDocumentType } from "@/lib/billing/types"

const statusOptions = [
  ["all", "Todos"],
  ["issued", "Emitidas"],
  ["paid", "Pagadas"],
  ["invoiced", "Facturadas"],
  ["discarded", "Descartadas"],
  ["cancelled", "Canceladas"],
]

const paymentOptions = [
  ["all", "Todos"],
  ["unpaid", "Sin pago"],
  ["paid", "Pagadas"],
  ["legacy_partial", "Pago parcial historico"],
]

function routeBase(documentType: BillingDocumentType) {
  return documentType === "proforma" ? "/facturacion/proformas" : "/facturacion/facturas"
}

function titleFor(documentType: BillingDocumentType) {
  return documentType === "proforma" ? "Proformas" : "Facturas"
}

export function BillingDocumentFiltersBar({
  documentType,
  filters,
}: {
  documentType: BillingDocumentType
  filters: BillingDocumentFilters
}) {
  return (
    <FilterSidebarCard
      title="Filtros"
      description={`Consulta ${documentType === "proforma" ? "proformas" : "facturas"} por numero, cliente, estado y pago.`}
      contentClassName="space-y-5 pt-5"
    >
      <Button asChild type="button" className="w-full" variant="secondary">
        <Link href={routeBase(documentType)}>Borrar todo</Link>
      </Button>

      <form className="space-y-5">
        <SidebarField label="Buscar" htmlFor={`${documentType}-q`}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={`${documentType}-q`}
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="P-2026/57, cliente, CIF..."
              className="pl-9"
            />
          </div>
        </SidebarField>

        <SidebarField label="Estado" htmlFor={`${documentType}-status`}>
          <Select
            id={`${documentType}-status`}
            name="status"
            defaultValue={filters.status ?? "all"}
            options={statusOptions.map(([value, label]) => ({ value, label }))}
          />
        </SidebarField>

        <SidebarField label="Pago" htmlFor={`${documentType}-payment`}>
          <Select
            id={`${documentType}-payment`}
            name="payment"
            defaultValue={filters.payment ?? "all"}
            options={paymentOptions.map(([value, label]) => ({ value, label }))}
          />
        </SidebarField>

        <Button type="submit" className="w-full">
          Filtrar
        </Button>
      </form>
    </FilterSidebarCard>
  )
}

export function BillingDocumentsTable({
  documentType,
  documents,
}: {
  documentType: BillingDocumentType
  documents: BillingDocumentListItem[]
}) {
  const base = routeBase(documentType)

  if (documents.length === 0) {
    return (
      <EmptyState
        title={`No hay ${documentType === "proforma" ? "proformas" : "facturas"} para este filtro.`}
        description="Ajusta los filtros o crea una nueva proforma si toca iniciar una venta."
        actions={
          documentType === "proforma" ? (
            <Button asChild>
              <Link href="/facturacion/proformas/nuevo">
                <FilePlus2 aria-hidden="true" />
                Nueva proforma
              </Link>
            </Button>
          ) : null
        }
      />
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{titleFor(documentType)}</CardTitle>
        <CardDescription>
          {documentType === "proforma"
            ? "Serie comercial P separada de la serie fiscal F."
            : "Serie fiscal F con referencia a proforma cuando procede."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-3 lg:hidden">
          {documents.map((document) => (
            <MobileRecordCard
              key={`mobile-${document.id}`}
              eyebrow={document.document_number}
              title={document.client_name}
              subtitle={formatDate(document.issue_date)}
              headerSlot={<DocumentStatusBadges document={document} />}
              footer={
                <MobileRecordActions>
                  <Button asChild type="button" variant="outline" size="sm" className="w-full justify-center">
                    <Link href={`${base}/${document.id}`}>Abrir</Link>
                  </Button>
                </MobileRecordActions>
              }
            >
              <MobileRecordGrid className="grid-cols-2">
                <MobileRecordField label="Total" value={`${formatAmount(document.total_amount)} €`} />
                <MobileRecordField label="Lineas" value={String(document.line_count)} />
              </MobileRecordGrid>
            </MobileRecordCard>
          ))}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Numero</th>
                <th className="px-4 py-3 text-left font-medium">Cliente</th>
                <th className="px-4 py-3 text-left font-medium">Fecha</th>
                <th className="px-4 py-3 text-right font-medium">Base</th>
                <th className="px-4 py-3 text-right font-medium">IVA</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-left font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Ficha</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id} className="border-t border-border/80">
                  <td className="px-4 py-4 align-top">
                    <Link href={`${base}/${document.id}`} className="font-semibold text-foreground no-underline">
                      {document.document_number}
                    </Link>
                    {document.source_proforma_number ? (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Ref. {document.source_proforma_number}
                      </span>
                    ) : null}
                  </td>
                  <td className="max-w-[26rem] px-4 py-4 align-top">
                    <span className="line-clamp-2 font-medium text-foreground/90">{document.client_name}</span>
                    {document.project ? (
                      <span className="mt-1 block text-xs text-muted-foreground">{document.project}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 align-top text-foreground/80">{formatDate(document.issue_date)}</td>
                  <td className="px-4 py-4 text-right align-top text-foreground/80">
                    {formatAmount(document.subtotal_amount)} €
                  </td>
                  <td className="px-4 py-4 text-right align-top text-foreground/80">
                    {formatAmount(document.tax_amount)} €
                  </td>
                  <td className="px-4 py-4 text-right align-top font-semibold text-foreground">
                    {formatAmount(document.total_amount)} €
                  </td>
                  <td className="px-4 py-4 align-top">
                    <DocumentStatusBadges document={document} />
                  </td>
                  <td className="px-4 py-4 text-right align-top">
                    <Button asChild size="icon-sm" variant="ghost" aria-label={`Abrir ${document.document_number}`}>
                      <Link href={`${base}/${document.id}`}>
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

function DocumentStatusBadges({ document }: { document: BillingDocumentListItem }) {
  return (
    <span className="inline-flex flex-wrap gap-2">
      <Badge tone={billingDocumentStatusTone(document.status)}>{billingDocumentStatusLabels[document.status]}</Badge>
      <Badge tone={billingPaymentStatusTone(document.payment_status)}>
        {billingPaymentStatusLabels[document.payment_status]}
      </Badge>
    </span>
  )
}

function SidebarField({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: React.ReactNode
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
