import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Building2, CalendarDays, Pencil, Settings2, UserRound } from "lucide-react"

import {
  SupplierAutoApprovalConfirmation,
  SupplierAutoApprovalResult,
} from "@/app/(app)/proveedores/_components/supplier-auto-approval-confirmation"
import { SupplierAdminReadOnly, SupplierFichaReadOnly } from "@/app/(app)/proveedores/_components/supplier-readonly-sections"
import { ResourceContentTabs } from "@/components/resource-content-tabs"
import { ResourceDetailScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"
import { FormSectionTabPanel } from "@/components/ui/form-section-tabs"
import { listSupplierAutoApprovalCandidates } from "@/lib/expenses/invoice-intake/approval"
import { createAdminClient } from "@/lib/supabase/admin"
import { formatSupplierDate, supplierPaymentMethodLabels } from "@/lib/suppliers/format"
import { getSupplierDetail } from "@/lib/suppliers/data"

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function numericParam(value: string | string[] | undefined) {
  const parsed = Number.parseInt(firstParam(value) ?? "", 10)
  return Number.isFinite(parsed) ? parsed : 0
}

export default async function SupplierDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const query = (await searchParams) ?? {}
  const detail = await getSupplierDetail(id)

  if (!detail) {
    notFound()
  }

  const { supplier } = detail
  const showAutoApprovalReview = supplier.auto_approve_expense_invoices && firstParam(query.autoApprovalReview) === "1"
  const showAutoApprovalResult = firstParam(query.autoApproved) != null || firstParam(query.autoFailed) != null
  const autoApproved = numericParam(query.autoApproved)
  const autoFailed = numericParam(query.autoFailed)
  const autoApprovalCandidates = showAutoApprovalReview
    ? await listSupplierAutoApprovalCandidates(createAdminClient(), supplier.id)
    : []

  return (
    <ResourceDetailScreen
      header={{
        icon: <Building2 className="size-6" aria-hidden="true" />,
        title: supplier.name,
        subtitle: `${supplier.tax_id} · ficha operativa del proveedor`,
        actions: (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/proveedores">
                <ArrowLeft aria-hidden="true" />
                Volver
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/proveedores/${supplier.id}/edit`}>
                <Pencil aria-hidden="true" />
                Editar
              </Link>
            </Button>
          </div>
        ),
      }}
      metrics={[
        { label: "Estado", value: supplier.active ? "Activo" : "Inactivo", tone: supplier.active ? "success" : "neutral" },
        { label: "Pago", value: supplierPaymentMethodLabels[supplier.payment_method] },
        { label: "Inicio", value: formatSupplierDate(supplier.start_date), icon: <CalendarDays className="size-4" aria-hidden="true" /> },
      ]}
    >
      <div className="grid gap-4">
        <SupplierAutoApprovalConfirmation
          supplierId={supplier.id}
          candidateCount={autoApprovalCandidates.length}
          cancelHref={`/proveedores/${supplier.id}`}
        />
        <SupplierAutoApprovalResult approved={autoApproved} failed={autoFailed} visible={showAutoApprovalResult} />
      </div>

      <ResourceContentTabs
        defaultTab="ficha"
        tabs={[
          { id: "ficha", label: "Ficha", icon: <UserRound className="size-4" aria-hidden="true" /> },
          { id: "administracion", label: "Administracion", icon: <Settings2 className="size-4" aria-hidden="true" /> },
        ]}
      >
        <FormSectionTabPanel tabId="ficha">
          <SupplierFichaReadOnly supplier={supplier} />
        </FormSectionTabPanel>

        <FormSectionTabPanel tabId="administracion">
          <SupplierAdminReadOnly supplier={supplier} />
        </FormSectionTabPanel>
      </ResourceContentTabs>
    </ResourceDetailScreen>
  )
}
