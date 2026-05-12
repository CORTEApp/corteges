import { Plus } from "lucide-react"

import { ClientForm } from "@/app/(app)/clientes/_components/client-form"
import { ResourceEditScreen } from "@/components/resource-screens"
import { requireAppUser } from "@/lib/clients/data"

export default async function NewClientPage() {
  await requireAppUser(undefined, "/clientes/nuevo")

  return (
    <ResourceEditScreen
      contentClassName="max-w-5xl"
      header={{
        icon: <Plus className="size-6" aria-hidden="true" />,
        title: "Nuevo cliente",
        subtitle: "Alta limpia: identidad, contacto, pago administrativo y notas antes de adjuntar documentación.",
      }}
    >
      <ClientForm />
    </ResourceEditScreen>
  )
}
