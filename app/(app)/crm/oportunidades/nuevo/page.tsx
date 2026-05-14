import Link from "next/link"
import { ArrowLeft, Save, Target } from "lucide-react"

import { OpportunityForm } from "@/app/(app)/crm/oportunidades/_components/opportunity-form"
import { ResourceEditScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"

const OPPORTUNITY_FORM_ID = "opportunity-create-form"

export default function NewCRMOpportunityPage() {
  return (
    <ResourceEditScreen
      header={{
        icon: <Target className="size-6" aria-hidden="true" />,
        title: "Nueva oportunidad",
        subtitle: "Alta manual para leads creados desde CORTE.Ges.",
        actions: (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/crm/oportunidades">
                <ArrowLeft aria-hidden="true" />
                Volver
              </Link>
            </Button>
            <Button type="submit" form={OPPORTUNITY_FORM_ID}>
              <Save aria-hidden="true" />
              Guardar oportunidad
            </Button>
          </div>
        ),
      }}
      metrics={[
        { label: "Estado", value: "Nueva" },
      ]}
    >
      <OpportunityForm actionsPlacement="page" formId={OPPORTUNITY_FORM_ID} />
    </ResourceEditScreen>
  )
}
