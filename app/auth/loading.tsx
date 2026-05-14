import { FullScreenLoading } from "@/components/ui/full-screen-loading"

export default function Loading() {
  return (
    <FullScreenLoading
      description="Validando acceso y sesion segura."
      label="Cargando acceso..."
    />
  )
}
