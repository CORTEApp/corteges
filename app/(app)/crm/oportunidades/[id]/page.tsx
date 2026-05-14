import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CalendarClock, MessageSquareText, Pencil, Settings2, Target, UserRound } from "lucide-react"

import {
  OpportunityActivitiesSection,
  OpportunityFichaReadOnly,
  OpportunityManagementSection,
} from "@/app/(app)/crm/oportunidades/_components/opportunity-readonly-sections"
import { ResourceContentTabs } from "@/components/resource-content-tabs"
import { ResourceDetailScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"
import { FormSectionTabPanel } from "@/components/ui/form-section-tabs"
import {
  formatOpportunityDateTime,
  formatOpportunityMoney,
  opportunityStatusLabels,
} from "@/lib/crm/format"
import { getCRMOpportunityDetail } from "@/lib/crm/data"

export default async function CRMOpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const detail = await getCRMOpportunityDetail(id)

  if (!detail) {
    notFound()
  }

  const { opportunity, activities, meetings, microsoftConnection, agendaItems } = detail

  return (
    <ResourceDetailScreen
      header={{
        icon: <Target className="size-6" aria-hidden="true" />,
        title: opportunity.company_name,
        subtitle: `${opportunityStatusLabels[opportunity.status]} · ${opportunity.contact_name ?? opportunity.contact_email ?? "Sin contacto"}`,
        actions: (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/crm/oportunidades">
                <ArrowLeft aria-hidden="true" />
                Volver
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/crm/oportunidades/${opportunity.id}/edit`}>
                <Pencil aria-hidden="true" />
                Editar
              </Link>
            </Button>
          </div>
        ),
      }}
      metrics={[
        { label: "Estado", value: opportunityStatusLabels[opportunity.status] },
        { label: "Precio inicial", value: formatOpportunityMoney(opportunity.initial_price) },
        { label: "Proximo contacto", value: formatOpportunityDateTime(opportunity.next_contact_at), icon: <CalendarClock className="size-4" aria-hidden="true" /> },
      ]}
    >
      <ResourceContentTabs
        defaultTab="gestion"
        tabs={[
          { id: "gestion", label: "Gestion", icon: <Settings2 className="size-4" aria-hidden="true" /> },
          { id: "ficha", label: "Ficha", icon: <UserRound className="size-4" aria-hidden="true" /> },
          { id: "contactos", label: "Contactos", icon: <MessageSquareText className="size-4" aria-hidden="true" /> },
        ]}
      >
        <FormSectionTabPanel tabId="gestion">
          <OpportunityManagementSection
            opportunity={opportunity}
            meetings={meetings}
            microsoftConnection={microsoftConnection}
            agendaItems={agendaItems}
          />
        </FormSectionTabPanel>

        <FormSectionTabPanel tabId="ficha">
          <OpportunityFichaReadOnly opportunity={opportunity} />
        </FormSectionTabPanel>

        <FormSectionTabPanel tabId="contactos">
          <OpportunityActivitiesSection opportunity={opportunity} activities={activities} />
        </FormSectionTabPanel>

      </ResourceContentTabs>
    </ResourceDetailScreen>
  )
}
