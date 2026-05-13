import Link from "next/link"
import { AlertTriangle, Building2, Mail, PlugZap, Save, Settings2, ShieldCheck } from "lucide-react"

import {
  deactivateMailOutboxAction,
  saveMailOutboxAction,
  saveModuleOutboxSettingsAction,
} from "@/app/(app)/settings/actions"
import { DetailField, DetailFieldGrid } from "@/components/detail-fields"
import { ResourceListScreen } from "@/components/resource-screens"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { FormLoadingOverlay } from "@/components/ui/form-loading-overlay"
import { FormSection } from "@/components/ui/form-section"
import { FormSubmitButton } from "@/components/ui/form-submit-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { MAIL_MODULE_LABELS, type MailModule, type MailOutbox, type MailOutboxMode, type MailOutboxModuleSetting, type MicrosoftOutboxConnection } from "@/lib/mail/types"
import { listMailSettingsPageData } from "@/lib/mail/settings"
import { requireAdminAccess } from "@/lib/users/server"

const OUTBOX_MODE_OPTIONS: Array<{ value: MailOutboxMode; label: string }> = [
  { value: "user_mailbox", label: "Propio" },
  { value: "shared_mailbox", label: "Compartido" },
]

const OUTBOX_MODE_LABELS: Record<MailOutboxMode, string> = {
  user_mailbox: "Propio",
  shared_mailbox: "Compartido",
}

const MODULES: MailModule[] = ["billing", "crm"]

function connectionLabel(connection: MicrosoftOutboxConnection) {
  const identity = connection.display_name || connection.microsoft_email || connection.user_id
  const suffix = connection.status === "connected" ? "conectado" : "reconectar"
  return `${identity} (${suffix})`
}

function outboxLabel(outbox: MailOutbox) {
  return [outbox.display_name, outbox.email_address].filter(Boolean).join(" · ")
}

function moduleSettingMap(settings: MailOutboxModuleSetting[]) {
  return new Map(settings.map((setting) => [setting.module, setting.outbox_id]))
}

function outboxMap(outboxes: MailOutbox[]) {
  return new Map(outboxes.map((outbox) => [outbox.id, outbox]))
}

function mailConnectionMap(connections: MicrosoftOutboxConnection[]) {
  return new Map(connections.map((connection) => [connection.user_id, connection]))
}

function OutboxStatusBadge({ outbox }: { outbox: MailOutbox }) {
  return outbox.active ? <Badge tone="success">Activo</Badge> : <Badge tone="neutral">Inactivo</Badge>
}

function OutboxForm({
  outbox,
  connections,
}: {
  outbox?: MailOutbox
  connections: MicrosoftOutboxConnection[]
}) {
  const scope = outbox?.id ?? "nuevo"
  const connectionOptions = connections.map((connection) => ({
    value: connection.user_id,
    label: connectionLabel(connection),
  }))
  const disabled = connectionOptions.length === 0

  return (
    <form action={saveMailOutboxAction} className="relative grid gap-4">
      <FormLoadingOverlay label="Guardando buzon..." />
      {outbox ? <input type="hidden" name="outbox_id" value={outbox.id} /> : null}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-2">
          <Label htmlFor={`email_address_${scope}`}>Email del buzon</Label>
          <Input
            id={`email_address_${scope}`}
            name="email_address"
            type="email"
            defaultValue={outbox?.email_address ?? ""}
            placeholder="facturacion@corteapp.es"
            required
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`display_name_${scope}`}>Nombre visible</Label>
          <Input
            id={`display_name_${scope}`}
            name="display_name"
            defaultValue={outbox?.display_name ?? ""}
            placeholder="Facturacion"
            disabled={disabled}
          />
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)_10rem]">
        <div className="space-y-2">
          <Label htmlFor={`mode_${scope}`}>Tipo</Label>
          <Select
            id={`mode_${scope}`}
            name="mode"
            defaultValue={outbox?.mode ?? "user_mailbox"}
            options={OUTBOX_MODE_OPTIONS}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`connection_user_id_${scope}`}>Conexion delegada</Label>
          <Select
            id={`connection_user_id_${scope}`}
            name="connection_user_id"
            defaultValue={outbox?.connection_user_id ?? ""}
            placeholder="Selecciona usuario conectado"
            options={connectionOptions}
            required
            disabled={disabled}
          />
        </div>
        <label
          htmlFor={`active_${scope}`}
          className="flex min-h-11 items-center gap-3 rounded-[var(--radius-panel)] border border-border/80 bg-[color:var(--surface-2)] px-3.5 py-2.5 text-sm font-medium"
        >
          <input
            id={`active_${scope}`}
            name="active"
            type="checkbox"
            defaultChecked={outbox?.active ?? true}
            disabled={disabled}
            className="size-4 accent-[color:var(--primary)]"
          />
          Activo
        </label>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <FormSubmitButton disabled={disabled} pendingLabel="Guardando...">
          <Save className="size-4" aria-hidden="true" />
          {outbox ? "Guardar buzon" : "Crear buzon"}
        </FormSubmitButton>
      </div>
    </form>
  )
}

function ModuleAssignments({
  outboxes,
  settings,
}: {
  outboxes: MailOutbox[]
  settings: MailOutboxModuleSetting[]
}) {
  const activeOptions = outboxes
    .filter((outbox) => outbox.active)
    .map((outbox) => ({ value: outbox.id, label: outboxLabel(outbox) }))
  const settingsByModule = moduleSettingMap(settings)

  return (
    <FormSection
      title="Uso por modulo"
      description="Define que buzon Microsoft usara cada modulo operativo. Teams sigue usando la cuenta delegada del usuario que crea la reunion."
    >
      <form action={saveModuleOutboxSettingsAction} className="relative grid gap-5">
        <FormLoadingOverlay label="Guardando modulos..." />
        <div className="grid gap-4 lg:grid-cols-2">
          {MODULES.map((module) => (
            <div key={module} className="space-y-2">
              <Label htmlFor={`${module}_outbox_id`}>{MAIL_MODULE_LABELS[module]}</Label>
              <Select
                id={`${module}_outbox_id`}
                name={`${module}_outbox_id`}
                defaultValue={settingsByModule.get(module) ?? ""}
                placeholder="Sin buzon asignado"
                options={activeOptions}
                disabled={!activeOptions.length}
              />
            </div>
          ))}
        </div>
        {!activeOptions.length ? (
          <p className="rounded-[var(--radius-panel)] border border-amber-200/70 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Crea o reactiva un buzon antes de asignarlo a Facturacion o CRM.
          </p>
        ) : null}
        <div className="flex justify-end">
          <FormSubmitButton disabled={!activeOptions.length} pendingLabel="Guardando...">
            <Save className="size-4" aria-hidden="true" />
            Guardar uso por modulo
          </FormSubmitButton>
        </div>
      </form>
    </FormSection>
  )
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  await requireAdminAccess("/settings")
  const { outboxes, moduleSettings, microsoftConnections } = await listMailSettingsPageData()
  const settingsByModule = moduleSettingMap(moduleSettings)
  const outboxesById = outboxMap(outboxes)
  const connectionsByUserId = mailConnectionMap(microsoftConnections)
  const activeOutboxes = outboxes.filter((outbox) => outbox.active)
  const saved = params.saved === "outbox" || params.saved === "modules"

  return (
    <ResourceListScreen
      header={{
        icon: <Settings2 className="size-6" aria-hidden="true" />,
        title: "Configuracion",
        subtitle: "Buzones Microsoft y asignacion global por modulo.",
        actions: saved ? <Badge tone="success">Configuracion guardada</Badge> : null,
      }}
      metrics={[
        { label: "Buzones", value: String(outboxes.length), icon: <Mail className="size-4" aria-hidden="true" /> },
        { label: "Activos", value: String(activeOutboxes.length), icon: <ShieldCheck className="size-4" aria-hidden="true" />, tone: "success" },
        {
          label: "Facturacion",
          value: settingsByModule.get("billing") ? "Asignado" : "Pendiente",
          description: settingsByModule.get("billing") ? outboxesById.get(settingsByModule.get("billing") ?? "")?.email_address : "Sin buzon",
        },
        {
          label: "CRM",
          value: settingsByModule.get("crm") ? "Asignado" : "Pendiente",
          description: settingsByModule.get("crm") ? outboxesById.get(settingsByModule.get("crm") ?? "")?.email_address : "Sin buzon",
        },
      ]}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.55fr)]">
        <div className="grid gap-6">
          <FormSection
            title="Buzones Microsoft"
            description="Catalogo global de buzones emisores. El usuario conectado aporta el token delegado; los buzones compartidos necesitan permisos Exchange de envio."
            action={<Badge tone="info">Microsoft Graph</Badge>}
          >
            <div className="grid gap-5">
              {microsoftConnections.length ? null : (
                <EmptyState
                  title="No hay conexiones Microsoft"
                  description="Conecta Microsoft desde Mi perfil antes de crear buzones globales."
                  actions={
                    <Button asChild variant="outline">
                      <Link href="/perfil#integraciones">
                        <PlugZap className="size-4" aria-hidden="true" />
                        Ir a Mi perfil
                      </Link>
                    </Button>
                  }
                />
              )}

              <div className="rounded-[var(--radius-panel)] border border-border/80 bg-[color:var(--surface-2)] p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Nuevo buzon</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Usa un buzon propio o uno compartido autorizado en Microsoft 365.</p>
                  </div>
                  <Badge tone="neutral">Alta</Badge>
                </div>
                <OutboxForm connections={microsoftConnections} />
              </div>

              {outboxes.length ? (
                <div className="divide-y divide-border/70 rounded-[var(--radius-panel)] border border-border/80 bg-[color:var(--surface-2)]">
                  {outboxes.map((outbox) => {
                    const connection = connectionsByUserId.get(outbox.connection_user_id)
                    return (
                      <section key={outbox.id} className="grid gap-4 p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-sm font-semibold">{outbox.display_name || outbox.email_address}</h3>
                              <OutboxStatusBadge outbox={outbox} />
                              <Badge tone="neutral">{OUTBOX_MODE_LABELS[outbox.mode]}</Badge>
                            </div>
                            <p className="mt-1 break-all text-sm text-muted-foreground">{outbox.email_address}</p>
                          </div>
                          {outbox.active ? (
                            <form action={deactivateMailOutboxAction}>
                              <input type="hidden" name="outbox_id" value={outbox.id} />
                              <FormSubmitButton variant="outline" size="sm" pendingLabel="Desactivando...">
                                Desactivar
                              </FormSubmitButton>
                            </form>
                          ) : null}
                        </div>

                        <DetailFieldGrid>
                          <DetailField label="Conexion" value={connection ? connectionLabel(connection) : outbox.connection_user_id} />
                          <DetailField label="Estado conexion" value={connection?.status === "connected" ? "Conectada" : "Reconectar"} />
                          <DetailField label="Ultimo error" value={outbox.last_error || "Sin errores registrados"} />
                        </DetailFieldGrid>

                        <OutboxForm outbox={outbox} connections={microsoftConnections} />
                      </section>
                    )
                  })}
                </div>
              ) : null}
            </div>
          </FormSection>
        </div>

        <div className="grid content-start gap-6">
          <ModuleAssignments outboxes={outboxes} settings={moduleSettings} />

          <FormSection
            title="Asignacion actual"
            description="Resumen operativo de los buzones que resolveran los modulos."
          >
            <div className="grid gap-3">
              {MODULES.map((module) => {
                const outboxId = settingsByModule.get(module)
                const outbox = outboxId ? outboxesById.get(outboxId) : null
                return (
                  <div key={module} className="rounded-[var(--radius-panel)] border border-border/80 bg-[color:var(--surface-2)] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{MAIL_MODULE_LABELS[module]}</p>
                        <p className="mt-1 truncate text-sm text-muted-foreground">{outbox ? outboxLabel(outbox) : "Sin buzon asignado"}</p>
                      </div>
                      <Badge tone={outbox ? "success" : "warning"}>{outbox ? "Listo" : "Pendiente"}</Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          </FormSection>

          <FormSection
            title="Notas de permisos"
            description="Lo que queda fuera de esta pantalla sigue separado por diseño."
          >
            <div className="grid gap-3 text-sm text-muted-foreground">
              <div className="flex gap-3 rounded-[var(--radius-panel)] border border-border/80 bg-[color:var(--surface-2)] px-4 py-3">
                <Building2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>Los buzones compartidos requieren Send As o Send on behalf en Exchange para el usuario conectado.</span>
              </div>
              <div className="flex gap-3 rounded-[var(--radius-panel)] border border-border/80 bg-[color:var(--surface-2)] px-4 py-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />
                <span>CRM queda preparado para futuros emails. Las reuniones de Teams no usan este buzon global.</span>
              </div>
            </div>
          </FormSection>
        </div>
      </div>
    </ResourceListScreen>
  )
}
