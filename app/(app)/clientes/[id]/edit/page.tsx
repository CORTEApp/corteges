import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ContactRound, FileText, History as HistoryIcon, Save, UserRound } from "lucide-react"

import { ClientForm } from "@/app/(app)/clientes/_components/client-form"
import { DocumentSection } from "@/app/(app)/clientes/_components/document-section"
import { ResourceContentTabs } from "@/components/resource-content-tabs"
import { ResourceEditScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"
import { FormSectionTabPanel } from "@/components/ui/form-section-tabs"
import { getClientDetail } from "@/lib/clients/data"

export default async function EditClientPage({
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
    <ResourceEditScreen
      header={{
        icon: <ContactRound className="size-6" aria-hidden="true" />,
        title: `Editar ${client.name}`,
        subtitle: "Cambios separados de la ficha: datos y documentos con tabs internas.",
        actions: (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/clientes/${client.id}`}>
                <ArrowLeft aria-hidden="true" />
                Volver a ficha
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/clientes">Listado</Link>
            </Button>
          </div>
        ),
      }}
      metrics={[
        { label: "Estado", value: client.active ? "Activo" : "Inactivo", tone: client.active ? "success" : "neutral" },
        { label: "Documentos", value: String(documents.length), icon: <FileText className="size-4" aria-hidden="true" /> },
        { label: "Histórico", value: String(history.length), icon: <HistoryIcon className="size-4" aria-hidden="true" /> },
        { label: "Guardado", value: "Histórico manual", icon: <Save className="size-4" aria-hidden="true" /> },
      ]}
    >
      <ResourceContentTabs
        defaultTab="datos"
        tabs={[
          { id: "datos", label: "Datos", icon: <UserRound className="size-4" aria-hidden="true" /> },
          { id: "documentos", label: "Documentos", icon: <FileText className="size-4" aria-hidden="true" /> },
        ]}
      >
        <FormSectionTabPanel tabId="datos">
          <ClientForm client={client} cancelHref={`/clientes/${client.id}`} />
        </FormSectionTabPanel>

        <FormSectionTabPanel tabId="documentos">
          <DocumentSection clientId={client.id} documents={documents} />
        </FormSectionTabPanel>
      </ResourceContentTabs>
    </ResourceEditScreen>
  )
}
