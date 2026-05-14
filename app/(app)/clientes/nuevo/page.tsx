import Link from "next/link"
import { ArrowLeft, Plus, Save } from "lucide-react"

import { ClientForm } from "@/app/(app)/clientes/_components/client-form"
import { ResourceEditScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"
import { requireAppUser } from "@/lib/clients/data"

const CLIENT_FORM_ID = "client-create-form"

export default async function NewClientPage() {
  await requireAppUser(undefined, "/clientes/nuevo")

  return (
    <ResourceEditScreen
      contentClassName="max-w-5xl"
      header={{
        icon: <Plus className="size-6" aria-hidden="true" />,
        title: "Nuevo cliente",
        subtitle: "Alta limpia: identidad, contacto, pago administrativo y notas antes de adjuntar documentación.",
        actions: (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/clientes">
                <ArrowLeft aria-hidden="true" />
                Volver
              </Link>
            </Button>
            <Button type="submit" form={CLIENT_FORM_ID}>
              <Save aria-hidden="true" />
              Guardar cliente
            </Button>
          </div>
        ),
      }}
    >
      <ClientForm actionsPlacement="page" formId={CLIENT_FORM_ID} />
    </ResourceEditScreen>
  )
}
