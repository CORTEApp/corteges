import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export const FILTERS_LAYOUT_CLASS = "grid gap-6 xl:grid-cols-[16.5rem_minmax(0,1fr)]"

export function FilterSidebarCard({
  title = "Filtros",
  description,
  className,
  contentClassName,
  children,
}: {
  title?: string
  description?: string
  className?: string
  contentClassName?: string
  children: React.ReactNode
}) {
  return (
    <Card className={cn("h-fit xl:sticky xl:top-28", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className={cn("space-y-5 pt-5", contentClassName)}>{children}</CardContent>
    </Card>
  )
}
