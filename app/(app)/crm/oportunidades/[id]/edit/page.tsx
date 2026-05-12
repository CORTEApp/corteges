import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Target } from "lucide-react"

import { OpportunityForm } from "@/app/(app)/crm/oportunidades/_components/opportunity-form"
import { ResourceEditScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"
import {
  formatOpportunityMoney,
  opportunityOriginLabel,
  opportunityStatusLabels,
} from "@/lib/crm/format"
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

  return (
    <ResourceEditScreen
      header={{
        icon: <Target className="size-6" aria-hidden="true" />,
        title: `Editar ${opportunity.company_name}`,
        subtitle: "Actualiza el pipeline, contacto y contexto comercial.",
        actions: (
          <Button asChild variant="outline">
            <Link href={`/crm/oportunidades/${opportunity.id}`}>
              <ArrowLeft aria-hidden="true" />
              Volver
            </Link>
          </Button>
        ),
      }}
      metrics={[
        { label: "Estado", value: opportunityStatusLabels[opportunity.status] },
        { label: "Precio inicial", value: formatOpportunityMoney(opportunity.initial_price) },
        { label: "Origen", value: opportunityOriginLabel(opportunity) },
      ]}
    >
      <OpportunityForm opportunity={opportunity} cancelHref={`/crm/oportunidades/${opportunity.id}`} />
    </ResourceEditScreen>
  )
}
