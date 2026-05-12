import type { ReactNode } from "react"

import {
  FormSectionTabList,
  FormSectionTabsProvider,
  type FormSectionTab,
} from "@/components/ui/form-section-tabs"
import { cn } from "@/lib/utils"

export function ResourceContentTabs({
  tabs,
  defaultTab,
  hashSync = true,
  children,
  className,
}: {
  tabs: FormSectionTab[]
  defaultTab?: string
  hashSync?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <FormSectionTabsProvider defaultTab={defaultTab} hashSync={hashSync} tabs={tabs}>
      <div className={cn("grid gap-6", className)}>
        <FormSectionTabList />
        {children}
      </div>
    </FormSectionTabsProvider>
  )
}
