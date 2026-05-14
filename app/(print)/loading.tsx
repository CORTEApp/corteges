import { FullScreenLoading } from "@/components/ui/full-screen-loading"

export default function Loading() {
  return (
    <FullScreenLoading
      description="Preparando documento para revision."
      label="Generando vista..."
    />
  )
}
