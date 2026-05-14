import Link from "next/link"
import { CalendarDays, KeyRound, LogOut, Mail, Palette, PlugZap, RefreshCw, Save, UserRound } from "lucide-react"

import { updateProfilePreferences, signOutAction } from "@/app/(app)/perfil/actions"
import { disconnectMicrosoftAction } from "@/app/integraciones/microsoft/actions"
import { DetailField, DetailFieldGrid } from "@/components/detail-fields"
import { ResourceContentTabs } from "@/components/resource-content-tabs"
import { ResourceDetailScreen } from "@/components/resource-screens"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FormSection } from "@/components/ui/form-section"
import { FormSectionTabPanel } from "@/components/ui/form-section-tabs"
import { FormLoadingOverlay } from "@/components/ui/form-loading-overlay"
import { FormPendingScreen } from "@/components/ui/form-pending-screen"
import { FormSubmitButton } from "@/components/ui/form-submit-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ProfileUiPreferencesFields } from "@/components/ui/profile-ui-preferences-fields"
import { Select } from "@/components/ui/select"
import { getMicrosoftConnectionStatus } from "@/lib/microsoft/graph"
import { createAdminClient } from "@/lib/supabase/admin"
import { APP_ROLE_LABELS } from "@/lib/users/roles"
import { getAuthenticatedMembership } from "@/lib/users/server"

const MICROSOFT_PROFILE_NEXT = "/perfil#integraciones"
const MICROSOFT_CONNECT_HREF = `/integraciones/microsoft/connect?next=${encodeURIComponent(MICROSOFT_PROFILE_NEXT)}`
const PROFILE_PREFERENCES_FORM_ID = "profile-preferences-form"
const PROFILE_SECURITY_FORM_ID = "profile-security-form"

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

function microsoftStatusLabel({
  configured,
  connected,
  requiresReconnect,
}: {
  configured: boolean
  connected: boolean
  requiresReconnect: boolean
}) {
  if (!configured) {
    return "Sin configurar"
  }
  if (connected) {
    return "Conectado"
  }
  if (requiresReconnect) {
    return "Reconectar"
  }
  return "Pendiente"
}

function microsoftStatusTone({
  configured,
  connected,
  requiresReconnect,
}: {
  configured: boolean
  connected: boolean
  requiresReconnect: boolean
}) {
  if (!configured || requiresReconnect) {
    return "warning" as const
  }
  return connected ? ("success" as const) : ("neutral" as const)
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
  const microsoftConnection = await getMicrosoftConnectionStatus(membership.user.id)
  const microsoftLabel = microsoftStatusLabel(microsoftConnection)
  const microsoftTone = microsoftStatusTone(microsoftConnection)
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
          { id: "integraciones", label: "Integraciones", icon: <PlugZap className="size-4" aria-hidden="true" /> },
          { id: "acceso", label: "Acceso", icon: <UserRound className="size-4" aria-hidden="true" /> },
        ]}
      >
        <FormSectionTabPanel tabId="preferencias">
          <FormSection
            description="Selecciona el idioma visible de la UX y actualiza tus datos básicos de acceso."
            title="Preferencias personales"
            action={
              <Button type="submit" form={PROFILE_PREFERENCES_FORM_ID}>
                <Save className="size-4" aria-hidden="true" />
                Guardar preferencias
              </Button>
            }
          >
            <form id={PROFILE_PREFERENCES_FORM_ID} action={updateProfilePreferences} className="relative space-y-5">
              <FormPendingScreen label="Guardando preferencias..." />
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
            </form>
          </FormSection>
        </FormSectionTabPanel>

        <FormSectionTabPanel tabId="seguridad">
          <FormSection
            description="Actualiza tu contraseña sin tocar preferencias visuales."
            title="Seguridad"
            action={
              <Button type="submit" form={PROFILE_SECURITY_FORM_ID}>
                <KeyRound className="size-4" aria-hidden="true" />
                Actualizar contraseña
              </Button>
            }
          >
            <form id={PROFILE_SECURITY_FORM_ID} action={updateProfilePreferences} className="relative space-y-5">
              <FormPendingScreen label="Actualizando contraseña..." />
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
            </form>
          </FormSection>
        </FormSectionTabPanel>

        <FormSectionTabPanel tabId="integraciones">
          <FormSection
            action={<Badge tone={microsoftTone}>{microsoftLabel}</Badge>}
            description="Conexion delegada de tu usuario para calendario, reuniones de Teams y correo de facturacion."
            title="Microsoft 365"
          >
            <div className="grid gap-5">
              <DetailFieldGrid>
                <DetailField
                  label="Cuenta"
                  value={microsoftConnection.email ?? microsoftConnection.displayName ?? "Sin cuenta conectada"}
                />
                <DetailField label="Estado" value={microsoftLabel} />
                <DetailField label="Calendario y Teams" value="Calendars.ReadWrite" />
                <DetailField label="Correo" value="Mail.Send / Mail.Send.Shared" />
              </DetailFieldGrid>

              <div className="flex flex-wrap gap-2">
                <Badge tone="info">
                  <CalendarDays className="mr-1 size-3" aria-hidden="true" />
                  Calendario
                </Badge>
                <Badge tone="info">
                  <Mail className="mr-1 size-3" aria-hidden="true" />
                  Correo
                </Badge>
                <Badge tone="info">
                  <PlugZap className="mr-1 size-3" aria-hidden="true" />
                  Buzones compartidos
                </Badge>
              </div>

              {microsoftConnection.lastError ? (
                <p className="rounded-[var(--radius-control)] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {microsoftConnection.lastError}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-3">
                {microsoftConnection.configured ? (
                  <Button asChild>
                    <Link href={MICROSOFT_CONNECT_HREF}>
                      {microsoftConnection.connected ? (
                        <RefreshCw className="size-4" aria-hidden="true" />
                      ) : (
                        <PlugZap className="size-4" aria-hidden="true" />
                      )}
                      {microsoftConnection.connected ? "Reconectar Microsoft" : "Conectar Microsoft"}
                    </Link>
                  </Button>
                ) : (
                  <Button disabled>
                    <PlugZap className="size-4" aria-hidden="true" />
                    Microsoft no configurado
                  </Button>
                )}

                {microsoftConnection.connected || microsoftConnection.requiresReconnect ? (
                  <form action={disconnectMicrosoftAction}>
                    <input type="hidden" name="redirect_to" value={MICROSOFT_PROFILE_NEXT} />
                    <FormSubmitButton variant="outline" pendingLabel="Desconectando...">
                      Desconectar
                    </FormSubmitButton>
                  </form>
                ) : null}
              </div>
            </div>
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
