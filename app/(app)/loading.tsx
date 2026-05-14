import { FullScreenLoading } from "@/components/ui/full-screen-loading"

export default function Loading() {
  return (
    <FullScreenLoading
      description="Preparando datos, permisos y vistas de trabajo."
      label="Cargando operativa..."
    />
  )
}
