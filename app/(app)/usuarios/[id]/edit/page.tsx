import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, BadgeCheck, KeyRound, ShieldCheck } from "lucide-react"

import { deactivateManagedUser, reactivateManagedUser, updateManagedUserRoles } from "@/app/(app)/usuarios/actions"
import { ResourceContentTabs } from "@/components/resource-content-tabs"
import { ResourceEditScreen } from "@/components/resource-screens"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button"
import { FormSection } from "@/components/ui/form-section"
import { FormSectionTabPanel } from "@/components/ui/form-section-tabs"
import { FormLoadingOverlay } from "@/components/ui/form-loading-overlay"
import { FormPendingScreen } from "@/components/ui/form-pending-screen"
import { APP_ROLE_LABELS, APP_ROLES } from "@/lib/users/roles"
import { loadManagedUser } from "@/lib/users/management"

function DeactivationControls({
  userId,
  isDeactivated,
  disabledReason,
}: {
  userId: string
  isDeactivated: boolean
  disabledReason: string
}) {
  if (isDeactivated) {
    return (
      <form action={reactivateManagedUser.bind(null, userId)} className="relative space-y-3">
        <FormLoadingOverlay label="Reactivando usuario..." />
        <ConfirmSubmitButton
          variant="outline"
          pendingLabel="Reactivando..."
          title="Reactivar usuario"
          description="El usuario recuperará el acceso al entorno."
          confirmLabel="Reactivar"
        >
          Reactivar usuario
        </ConfirmSubmitButton>
      </form>
    )
  }

  return (
    <form action={deactivateManagedUser.bind(null, userId)} className="relative space-y-3">
      <FormLoadingOverlay label="Desactivando usuario..." />
      <ConfirmSubmitButton
        variant="destructive"
        pendingLabel="Desactivando..."
        title="Desactivar usuario"
        description="El usuario no podrá iniciar sesión hasta que se reactive."
        confirmLabel="Desactivar"
        disabled={Boolean(disabledReason)}
      >
        Desactivar usuario
      </ConfirmSubmitButton>
      {disabledReason ? <p className="text-sm text-muted-foreground">{disabledReason}</p> : null}
    </form>
  )
}

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { user } = await loadManagedUser(id, `/usuarios/${id}/edit`)

  if (!user) {
    notFound()
  }

  const currentRoles = new Set(user.roles)
  const rolesFormId = `user-roles-form-${user.id}`

  return (
    <ResourceEditScreen
      header={{
        icon: <BadgeCheck className="size-6" aria-hidden="true" />,
        title: `Editar ${user.displayName}`,
        subtitle: "Roles y estado de acceso separados de la ficha de lectura.",
        actions: (
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={user.isDeactivated ? "warning" : "success"}>{user.isDeactivated ? "Desactivado" : "Activo"}</Badge>
            <Button variant="outline" asChild>
              <Link href={`/usuarios/${user.id}`}>
                <ArrowLeft aria-hidden="true" />
                Volver a ficha
              </Link>
            </Button>
          </div>
        ),
      }}
      metrics={[
        { label: "Estado", value: user.isDeactivated ? "Desactivado" : "Activo", tone: user.isDeactivated ? "warning" : "success" },
        { label: "Roles", value: String(user.roles.length), icon: <ShieldCheck className="size-4" aria-hidden="true" /> },
        { label: "Guarda", value: user.disabledReason ? "Activa" : "Sin bloqueo" },
      ]}
    >
      <ResourceContentTabs
        defaultTab="roles"
        tabs={[
          { id: "roles", label: "Roles", icon: <ShieldCheck className="size-4" aria-hidden="true" /> },
          { id: "acceso", label: "Acceso", icon: <KeyRound className="size-4" aria-hidden="true" /> },
        ]}
      >
        <FormSectionTabPanel tabId="roles">
          <FormSection
            description="Selecciona los permisos internos activos para este usuario."
            title="Roles"
            action={
              <Button type="submit" form={rolesFormId}>
                <ShieldCheck className="size-4" aria-hidden="true" />
                Actualizar roles
              </Button>
            }
          >
            <form id={rolesFormId} action={updateManagedUserRoles.bind(null, user.id)} className="relative space-y-4">
              <FormPendingScreen label="Actualizando roles..." />
              <FormLoadingOverlay label="Actualizando roles..." />
              <div className="grid gap-2 md:grid-cols-3">
                {APP_ROLES.map((role) => (
                  <label key={role} className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border px-3 py-3 text-sm">
                    <span>{APP_ROLE_LABELS[role]}</span>
                    <input type="checkbox" name="roles" value={role} defaultChecked={currentRoles.has(role)} />
                  </label>
                ))}
              </div>
            </form>
          </FormSection>
        </FormSectionTabPanel>

        <FormSectionTabPanel tabId="acceso">
          <FormSection
            description="Activa o bloquea el acceso sin borrar el histórico del usuario."
            title="Control de acceso"
          >
            <DeactivationControls
              disabledReason={user.disabledReason}
              isDeactivated={user.isDeactivated}
              userId={user.id}
            />
          </FormSection>
        </FormSectionTabPanel>
      </ResourceContentTabs>
    </ResourceEditScreen>
  )
}
