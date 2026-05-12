import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ContactRound, FileText, History as HistoryIcon, Pencil, UserRound } from "lucide-react"

import { ClientFichaReadOnly } from "@/app/(app)/clientes/_components/client-readonly-sections"
import { ClientHistorySection } from "@/app/(app)/clientes/_components/client-history-section"
import { DocumentSection } from "@/app/(app)/clientes/_components/document-section"
import { ResourceContentTabs } from "@/components/resource-content-tabs"
import { ResourceDetailScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"
import { FormSectionTabPanel } from "@/components/ui/form-section-tabs"
import { paymentMethodLabels } from "@/lib/clients/format"
import { getClientDetail } from "@/lib/clients/data"

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const detail = await getClientDetail(id)

  if (!detail) {
    notFound()
  }

  const { client, documents, history } = detail

  return (
    <ResourceDetailScreen
      header={{
        icon: <ContactRound className="size-6" aria-hidden="true" />,
        title: client.name,
        subtitle: `${client.tax_id} · mini-dashboard operativo del cliente`,
        actions: (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/clientes">
                <ArrowLeft aria-hidden="true" />
                Volver
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/clientes/${client.id}/edit`}>
                <Pencil aria-hidden="true" />
                Editar
              </Link>
            </Button>
          </div>
        ),
      }}
      metrics={[
        { label: "Estado", value: client.active ? "Activo" : "Inactivo", tone: client.active ? "success" : "neutral" },
        { label: "Documentos", value: String(documents.length), icon: <FileText className="size-4" aria-hidden="true" /> },
        { label: "Histórico", value: String(history.length), icon: <HistoryIcon className="size-4" aria-hidden="true" /> },
        { label: "Pago", value: paymentMethodLabels[client.payment_method] },
      ]}
    >
      <ResourceContentTabs
        defaultTab="ficha"
        tabs={[
          { id: "ficha", label: "Ficha", icon: <UserRound className="size-4" aria-hidden="true" /> },
          { id: "historico", label: "Histórico", icon: <HistoryIcon className="size-4" aria-hidden="true" /> },
          { id: "documentos", label: "Documentos", icon: <FileText className="size-4" aria-hidden="true" /> },
        ]}
      >
        <FormSectionTabPanel tabId="ficha">
          <ClientFichaReadOnly client={client} />
        </FormSectionTabPanel>

        <FormSectionTabPanel tabId="historico">
          <ClientHistorySection history={history} currentHistoryEntryId={client.current_history_entry_id} />
        </FormSectionTabPanel>

        <FormSectionTabPanel tabId="documentos">
          <DocumentSection clientId={client.id} documents={documents} mode="read" />
        </FormSectionTabPanel>
      </ResourceContentTabs>
    </ResourceDetailScreen>
  )
}
