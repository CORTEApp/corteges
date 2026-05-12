import Link from "next/link"
import { ArrowLeft, Target } from "lucide-react"

import { OpportunityForm } from "@/app/(app)/crm/oportunidades/_components/opportunity-form"
import { ResourceEditScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"

export default function NewCRMOpportunityPage() {
  return (
    <ResourceEditScreen
      header={{
        icon: <Target className="size-6" aria-hidden="true" />,
        title: "Nueva oportunidad",
        subtitle: "Alta manual para leads que no vienen de SharePoint.",
        actions: (
          <Button asChild variant="outline">
            <Link href="/crm/oportunidades">
              <ArrowLeft aria-hidden="true" />
              Volver
            </Link>
          </Button>
        ),
      }}
      metrics={[
        { label: "Estado", value: "Nueva" },
        { label: "Origen", value: "Manual" },
      ]}
    >
      <OpportunityForm />
    </ResourceEditScreen>
  )
}
