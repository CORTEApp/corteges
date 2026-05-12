import { KeyRound, LogOut, Palette, UserRound } from "lucide-react"

import { updateProfilePreferences, signOutAction } from "@/app/(app)/perfil/actions"
import { DetailField, DetailFieldGrid } from "@/components/detail-fields"
import { ResourceContentTabs } from "@/components/resource-content-tabs"
import { ResourceDetailScreen } from "@/components/resource-screens"
import { Badge } from "@/components/ui/badge"
import { FormSection } from "@/components/ui/form-section"
import { FormSectionTabPanel } from "@/components/ui/form-section-tabs"
import { FormLoadingOverlay } from "@/components/ui/form-loading-overlay"
import { FormSubmitButton } from "@/components/ui/form-submit-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ProfileUiPreferencesFields } from "@/components/ui/profile-ui-preferences-fields"
import { Select } from "@/components/ui/select"
import { createAdminClient } from "@/lib/supabase/admin"
import { APP_ROLE_LABELS } from "@/lib/users/roles"
import { getAuthenticatedMembership } from "@/lib/users/server"

function normalizeLanguage(value: unknown) {
  return typeof value === "string" && ["es", "en", "ca"].includes(value) ? value : "es"
}

function stringPreference(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback
}

function HiddenProfilePreferences({
  displayName,
  preferredLanguage,
  preferredTheme,
  colorMode,
  textSize,
}: {
  displayName: string
  preferredLanguage: string
  preferredTheme: string
  colorMode: string
  textSize: string
}) {
  return (
    <>
      <input type="hidden" name="display_name" value={displayName} />
      <input type="hidden" name="preferred_language" value={preferredLanguage} />
      <input type="hidden" name="preferred_theme" value={preferredTheme} />
      <input type="hidden" name="color_mode" value={colorMode} />
      <input type="hidden" name="text_size" value={textSize} />
    </>
  )
}

export default async function PerfilPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const saved = params.saved === "1"
  const membership = await getAuthenticatedMembership("/perfil")
  const admin = createAdminClient()
  const authUserResult = await admin.auth.admin.getUserById(membership.user.id)
  if (authUserResult.error || !authUserResult.data.user) {
    throw new Error(authUserResult.error?.message || "No se pudo cargar el perfil autenticado.")
  }

  const authUser = authUserResult.data.user
  const metadata = authUser.user_metadata && typeof authUser.user_metadata === "object"
    ? (authUser.user_metadata as Record<string, unknown>)
    : {}
  const profileResult = await admin
    .from("user_profiles")
    .select("display_name, preferred_language, preferred_theme, color_mode, text_size")
    .eq("id", membership.user.id)
    .maybeSingle()
  if (profileResult.error) {
    throw new Error(profileResult.error.message)
  }

  const profile = (profileResult.data ?? {}) as Record<string, unknown>
  const displayName = stringPreference(profile.display_name, stringPreference(metadata.display_name, ""))
  const preferredLanguage = normalizeLanguage(profile.preferred_language ?? metadata.preferred_language)
  const preferredTheme = stringPreference(profile.preferred_theme, stringPreference(metadata.preferred_theme, "saas_atlas_blue_v2"))
  const colorMode = stringPreference(profile.color_mode, stringPreference(metadata.color_mode, "system"))
  const textSize = stringPreference(profile.text_size, stringPreference(metadata.text_size, "medium"))
  const roleLabels = membership.roles.length
    ? membership.roles.map((role) => APP_ROLE_LABELS[role]).join(", ")
    : "Sin roles"
  const languageOptions = [
    { value: "es", label: "Español" },
    { value: "en", label: "English" },
    { value: "ca", label: "Català" },
  ]

  return (
    <ResourceDetailScreen
      header={{
        icon: <UserRound className="size-6" aria-hidden="true" />,
        title: "Mi perfil",
        subtitle: "Preferencias visuales, seguridad y acceso del usuario autenticado.",
        actions: saved ? <Badge tone="success">Preferencias guardadas</Badge> : null,
      }}
      metrics={[
        { label: "Tema", value: preferredTheme, icon: <Palette className="size-4" aria-hidden="true" /> },
        { label: "Modo", value: colorMode },
        { label: "Texto", value: textSize },
        { label: "Roles", value: String(membership.roles.length), description: roleLabels },
      ]}
    >
      <ResourceContentTabs
        defaultTab="preferencias"
        tabs={[
          { id: "preferencias", label: "Preferencias", icon: <Palette className="size-4" aria-hidden="true" /> },
          { id: "seguridad", label: "Seguridad", icon: <KeyRound className="size-4" aria-hidden="true" /> },
          { id: "acceso", label: "Acceso", icon: <UserRound className="size-4" aria-hidden="true" /> },
        ]}
      >
        <FormSectionTabPanel tabId="preferencias">
          <FormSection
            description="Selecciona el idioma visible de la UX y actualiza tus datos básicos de acceso."
            title="Preferencias personales"
          >
            <form action={updateProfilePreferences} className="relative space-y-5">
              <FormLoadingOverlay label="Guardando preferencias..." />

              <div className="space-y-2">
                <Label htmlFor="display_name">Nombre visible</Label>
                <Input id="display_name" name="display_name" defaultValue={displayName} placeholder="Master" />
              </div>

              <ProfileUiPreferencesFields
                defaultThemePreset={preferredTheme}
                defaultThemeMode={colorMode}
                defaultFontSize={textSize}
              />

              <div className="space-y-2">
                <Label htmlFor="preferred_language">Idioma de la interfaz</Label>
                <Select
                  id="preferred_language"
                  name="preferred_language"
                  defaultValue={preferredLanguage}
                  options={languageOptions}
                />
              </div>

              <div className="rounded-[var(--radius-panel)] border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                El cambio de idioma se gestiona desde Mi perfil. Login, onboarding y shell del proyecto no deben ofrecer selectores alternativos de idioma.
              </div>

              <FormSubmitButton pendingLabel="Guardando preferencias...">Guardar preferencias</FormSubmitButton>
            </form>
          </FormSection>
        </FormSectionTabPanel>

        <FormSectionTabPanel tabId="seguridad">
          <FormSection
            description="Actualiza tu contraseña sin tocar preferencias visuales."
            title="Seguridad"
          >
            <form action={updateProfilePreferences} className="relative space-y-5">
              <FormLoadingOverlay label="Actualizando contraseña..." />
              <HiddenProfilePreferences
                colorMode={colorMode}
                displayName={displayName}
                preferredLanguage={preferredLanguage}
                preferredTheme={preferredTheme}
                textSize={textSize}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="password">Nueva contraseña</Label>
                  <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} placeholder="Mínimo 8 caracteres" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password_confirm">Confirmar contraseña</Label>
                  <Input id="password_confirm" name="password_confirm" type="password" autoComplete="new-password" minLength={8} placeholder="Repite la contraseña" />
                </div>
              </div>
              <FormSubmitButton pendingLabel="Actualizando contraseña...">Actualizar contraseña</FormSubmitButton>
            </form>
          </FormSection>
        </FormSectionTabPanel>

        <FormSectionTabPanel tabId="acceso">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <FormSection
              description="Estado operativo del usuario autenticado."
              title="Resumen de acceso"
            >
              <DetailFieldGrid>
                <DetailField label="Email" value={authUser.email || "Sin email"} />
                <DetailField label="Tema activo" value={preferredTheme} />
                <DetailField label="Modo visual" value={colorMode} />
                <DetailField label="Tamaño del texto" value={textSize} />
                <DetailField label="Idioma activo" value={languageOptions.find((option) => option.value === preferredLanguage)?.label ?? "Español"} />
                <DetailField label="Roles" value={roleLabels} />
              </DetailFieldGrid>
            </FormSection>

            <FormSection
              description="Finaliza la sesión actual en este navegador y vuelve al acceso seguro."
              title="Cerrar sesión"
            >
              <form action={signOutAction} className="relative">
                <FormLoadingOverlay label="Cerrando sesión..." />
                <FormSubmitButton variant="outline" className="w-full justify-center" pendingLabel="Cerrando sesión...">
                  <LogOut className="size-4" aria-hidden="true" />
                  Cerrar sesión
                </FormSubmitButton>
              </form>
            </FormSection>
          </div>
        </FormSectionTabPanel>
      </ResourceContentTabs>
    </ResourceDetailScreen>
  )
}
