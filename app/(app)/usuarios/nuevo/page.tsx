import Link from "next/link"
import { ArrowLeft, ShieldCheck, UserPlus } from "lucide-react"

import { createManagedUser } from "@/app/(app)/usuarios/actions"
import { ResourceEditScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"
import { FormSection } from "@/components/ui/form-section"
import { FormLoadingOverlay } from "@/components/ui/form-loading-overlay"
import { FormSubmitButton } from "@/components/ui/form-submit-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { APP_ROLE_LABELS, APP_ROLES } from "@/lib/users/roles"
import { requireMasterAccess } from "@/lib/users/server"

export default async function NuevoUsuarioPage() {
  await requireMasterAccess("/usuarios/nuevo")

  return (
    <ResourceEditScreen
      contentClassName="max-w-3xl"
      header={{
        icon: <UserPlus className="size-6" aria-hidden="true" />,
        title: "Nuevo usuario",
        subtitle: "Alta directa en Supabase Auth con roles internos de CORTE.Ges.",
        actions: (
          <Button asChild variant="outline">
            <Link href="/usuarios">
              <ArrowLeft aria-hidden="true" />
              Volver
            </Link>
          </Button>
        ),
      }}
    >
      <FormSection
        description="Crea el usuario confirmado y asigna al menos un rol operativo."
        title="Alta de usuario"
      >
        <form action={createManagedUser} className="relative space-y-5">
          <FormLoadingOverlay label="Creando usuario..." />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="persona@empresa.com" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_name">Nombre visible</Label>
              <Input id="display_name" name="display_name" placeholder="Nombre interno" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña inicial</Label>
            <Input id="password" name="password" type="password" minLength={8} placeholder="Mínimo 8 caracteres" required />
          </div>

          <div className="space-y-3">
            <div className="text-sm font-medium">Roles</div>
            <div className="grid gap-2 md:grid-cols-3">
              {APP_ROLES.map((role) => (
                <label key={role} className="flex items-center gap-3 rounded-[var(--radius-control)] border border-border px-3 py-2 text-sm">
                  <input type="checkbox" name="roles" value={role} defaultChecked={role === "usuario"} />
                  <span>{APP_ROLE_LABELS[role]}</span>
                </label>
              ))}
            </div>
          </div>

          <FormSubmitButton pendingLabel="Creando usuario...">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Crear usuario
          </FormSubmitButton>
        </form>
      </FormSection>
    </ResourceEditScreen>
  )
}
