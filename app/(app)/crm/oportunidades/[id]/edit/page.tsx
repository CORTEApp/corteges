import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Save, Target } from "lucide-react"

import { OpportunityForm } from "@/app/(app)/crm/oportunidades/_components/opportunity-form"
import { ResourceEditScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"
import { formatOpportunityMoney, opportunityStatusLabels } from "@/lib/crm/format"
import { getCRMOpportunityDetail } from "@/lib/crm/data"

export default async function EditCRMOpportunityPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const detail = await getCRMOpportunityDetail(id)

  if (!detail) {
    notFound()
  }

  const { opportunity } = detail
  const formId = `opportunity-edit-form-${opportunity.id}`

  return (
    <ResourceEditScreen
      header={{
        icon: <Target className="size-6" aria-hidden="true" />,
        title: `Editar ${opportunity.company_name}`,
        subtitle: "Actualiza el pipeline, contacto y contexto comercial.",
        actions: (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/crm/oportunidades/${opportunity.id}`}>
                <ArrowLeft aria-hidden="true" />
                Volver
              </Link>
            </Button>
            <Button type="submit" form={formId}>
              <Save aria-hidden="true" />
              Guardar oportunidad
            </Button>
          </div>
        ),
      }}
      metrics={[
        { label: "Estado", value: opportunityStatusLabels[opportunity.status] },
        { label: "Precio inicial", value: formatOpportunityMoney(opportunity.initial_price) },
      ]}
    >
      <OpportunityForm actionsPlacement="page" formId={formId} opportunity={opportunity} />
    </ResourceEditScreen>
  )
}
