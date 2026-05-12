import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, BadgeCheck, KeyRound, Pencil, ShieldCheck, UserRound } from "lucide-react"

import { DetailField, DetailFieldGrid } from "@/components/detail-fields"
import { ResourceContentTabs } from "@/components/resource-content-tabs"
import { ResourceDetailScreen } from "@/components/resource-screens"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FormSection } from "@/components/ui/form-section"
import { FormSectionTabPanel } from "@/components/ui/form-section-tabs"
import { APP_ROLE_LABELS } from "@/lib/users/roles"
import { loadManagedUser } from "@/lib/users/management"
import { formatDateTime } from "@/lib/utils"

export default async function UsuarioDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { user } = await loadManagedUser(id, `/usuarios/${id}`)

  if (!user) {
    notFound()
  }

  return (
    <ResourceDetailScreen
      header={{
        icon: <BadgeCheck className="size-6" aria-hidden="true" />,
        title: user.displayName,
        subtitle: "Ficha de usuario en lectura. Roles y baja se cambian desde edición.",
        actions: (
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={user.isDeactivated ? "warning" : "success"}>{user.isDeactivated ? "Desactivado" : "Activo"}</Badge>
            <Button variant="outline" asChild>
              <Link href="/usuarios">
                <ArrowLeft aria-hidden="true" />
                Volver
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/usuarios/${user.id}/edit`}>
                <Pencil aria-hidden="true" />
                Editar
              </Link>
            </Button>
          </div>
        ),
      }}
      metrics={[
        { label: "Estado", value: user.isDeactivated ? "Desactivado" : "Activo", tone: user.isDeactivated ? "warning" : "success" },
        { label: "Roles", value: String(user.roles.length), icon: <ShieldCheck className="size-4" aria-hidden="true" /> },
        { label: "Creado", value: formatDateTime(user.createdAt) || "Sin fecha" },
        { label: "Último acceso", value: formatDateTime(user.lastSignInAt) || "Sin fecha" },
      ]}
    >
      <ResourceContentTabs
        defaultTab="ficha"
        tabs={[
          { id: "ficha", label: "Ficha", icon: <UserRound className="size-4" aria-hidden="true" /> },
          { id: "roles", label: "Roles", icon: <ShieldCheck className="size-4" aria-hidden="true" /> },
          { id: "acceso", label: "Acceso", icon: <KeyRound className="size-4" aria-hidden="true" /> },
        ]}
      >
        <FormSectionTabPanel tabId="ficha">
          <FormSection title="Ficha">
            <DetailFieldGrid>
              <DetailField label="Email" value={user.email} />
              <DetailField label="Nombre visible" value={user.displayName} />
              <DetailField
                label="Estado"
                value={<Badge tone={user.isDeactivated ? "warning" : "success"}>{user.isDeactivated ? "Desactivado" : "Activo"}</Badge>}
              />
              <DetailField label="Creado" value={formatDateTime(user.createdAt) || "Sin fecha"} />
              <DetailField label="Último acceso" value={formatDateTime(user.lastSignInAt) || "Sin fecha"} />
              <DetailField label="Fecha de baja" value={user.deactivatedAt ? formatDateTime(user.deactivatedAt) : "Sin fecha"} />
            </DetailFieldGrid>
          </FormSection>
        </FormSectionTabPanel>

        <FormSectionTabPanel tabId="roles">
          <FormSection
            description="Lectura de permisos asignados actualmente."
            title="Roles"
          >
            <div className="flex flex-wrap gap-2">
              {user.roles.length ? (
                user.roles.map((role) => <Badge key={role}>{APP_ROLE_LABELS[role]}</Badge>)
              ) : (
                <span className="text-sm text-muted-foreground">Sin roles</span>
              )}
            </div>
          </FormSection>
        </FormSectionTabPanel>

        <FormSectionTabPanel tabId="acceso">
          <FormSection
            description="Estado de acceso sin controles destructivos en la ficha."
            title="Acceso"
          >
            <DetailFieldGrid>
              <DetailField
                label="Estado"
                value={<Badge tone={user.isDeactivated ? "warning" : "success"}>{user.isDeactivated ? "Desactivado" : "Activo"}</Badge>}
              />
              <DetailField label="Fecha de baja" value={user.deactivatedAt ? formatDateTime(user.deactivatedAt) : "Sin fecha"} />
              <DetailField label="Guarda activa" value={user.disabledReason || "Sin bloqueo"} />
            </DetailFieldGrid>
          </FormSection>
        </FormSectionTabPanel>
      </ResourceContentTabs>
    </ResourceDetailScreen>
  )
}
