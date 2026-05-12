import Link from "next/link"
import { ShieldCheck, UserPlus, UsersRound } from "lucide-react"

import { UserManagementTable, type UserManagementTableRow } from "@/app/(app)/usuarios/_components/user-management-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ResourceListScreen } from "@/components/resource-screens"
import { APP_ROLE_LABELS, type AppRole } from "@/lib/users/roles"
import { loadManagedUsers } from "@/lib/users/management"
import { formatDateTime } from "@/lib/utils"

function rolesBadges(roles: AppRole[]) {
  return (
    <div className="flex flex-wrap gap-2">
      {roles.length ? (
        roles.map((role) => <Badge key={role}>{APP_ROLE_LABELS[role]}</Badge>)
      ) : (
        <span className="text-sm text-muted-foreground">Sin roles</span>
      )}
    </div>
  )
}

export default async function UsuariosPage() {
  const { users } = await loadManagedUsers("/usuarios")
  const activeCount = users.filter((user) => !user.isDeactivated).length
  const masterCount = users.filter((user) => user.roles.includes("master")).length
  const rows: UserManagementTableRow[] = users.map((user) => ({
    email: user.email,
    displayName: user.displayName,
    status: <Badge tone={user.isDeactivated ? "warning" : "success"}>{user.isDeactivated ? "Desactivado" : "Activo"}</Badge>,
    deactivationDate: user.deactivatedAt ? formatDateTime(user.deactivatedAt) : <span className="text-muted-foreground">Sin fecha</span>,
    createdAt: formatDateTime(user.createdAt) || "Sin fecha",
    lastSignIn: formatDateTime(user.lastSignInAt) || "Sin fecha",
    roles: rolesBadges(user.roles),
    actions: (
      <Button size="sm" variant="secondary" asChild className="w-full justify-center sm:w-auto">
        <Link href={`/usuarios/${user.id}`}>Abrir ficha</Link>
      </Button>
    ),
  }))

  return (
    <ResourceListScreen
      header={{
        icon: <UsersRound className="size-6" aria-hidden="true" />,
        title: "Usuarios",
        subtitle: "Listado de acceso interno. Alta, roles y baja se gestionan desde pantallas separadas.",
        actions: (
          <Button asChild>
            <Link href="/usuarios/nuevo">
              <UserPlus aria-hidden="true" />
              Nuevo usuario
            </Link>
          </Button>
        ),
      }}
      metrics={[
        { label: "Usuarios", value: String(users.length), icon: <UsersRound className="size-4" aria-hidden="true" /> },
        { label: "Activos", value: String(activeCount), tone: "success" },
        { label: "Bajas", value: String(users.length - activeCount), tone: users.length - activeCount > 0 ? "warning" : "neutral" },
        { label: "Master", value: String(masterCount), icon: <ShieldCheck className="size-4" aria-hidden="true" /> },
      ]}
    >
      {rows.length ? (
        <UserManagementTable
          title="Usuarios del entorno"
          description="Control de acceso operativo para CORTE.Ges."
          rows={rows}
        />
      ) : (
        <EmptyState title="Sin usuarios" description="Todavía no hay usuarios gestionables." />
      )}
    </ResourceListScreen>
  )
}
