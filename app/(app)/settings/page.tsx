import Link from "next/link"
import { AlertTriangle, Building2, Calculator, Mail, PlugZap, Save, Send, Settings2, ShieldCheck } from "lucide-react"

import {
  deactivateMailOutboxAction,
  saveFiscalTaxSettingsAction,
  saveMailOutboxAction,
  saveModuleOutboxSettingsAction,
  testMailOutboxAction,
} from "@/app/(app)/settings/actions"
import { DetailField, DetailFieldGrid } from "@/components/detail-fields"
import { ResourceListScreen } from "@/components/resource-screens"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { FormLoadingOverlay } from "@/components/ui/form-loading-overlay"
import { FormPendingScreen } from "@/components/ui/form-pending-screen"
import { FormSection } from "@/components/ui/form-section"
import { FormSubmitButton } from "@/components/ui/form-submit-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { listMailSettingsPageData } from "@/lib/mail/settings"
import {
  MAIL_MODULE_LABELS,
  type MailModule,
  type MailOutbox,
  type MailOutboxMode,
  type MailOutboxModuleSetting,
  type MicrosoftOutboxConnection,
} from "@/lib/mail/types"
import {
  currentFiscalYear,
  formatFiscalAmount,
  formatFiscalPercent,
  getFiscalTaxSettingsForYear,
  type FiscalTaxSettings,
} from "@/lib/statistics/fiscal"
import { requireAdminAccess } from "@/lib/users/server"

const OUTBOX_MODE_OPTIONS: Array<{ value: MailOutboxMode; label: string }> = [
  { value: "user_mailbox", label: "Propio" },
  { value: "shared_mailbox", label: "Compartido" },
]

const OUTBOX_MODE_LABELS: Record<MailOutboxMode, string> = {
  user_mailbox: "Propio",
  shared_mailbox: "Compartido",
}

const MODULES: MailModule[] = ["billing", "crm", "expense_invoice_intake"]
const NEW_OUTBOX_FORM_ID = "mail-outbox-new-form"
const MODULE_ASSIGNMENTS_FORM_ID = "mail-module-assignments-form"
const FISCAL_TAX_SETTINGS_FORM_ID = "fiscal-tax-settings-form"

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

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function OutboxForm({
  outbox,
  connections,
  formId,
}: {
  outbox?: MailOutbox
  connections: MicrosoftOutboxConnection[]
  formId: string
}) {
  const scope = outbox?.id ?? "nuevo"
  const connectionOptions = connections.map((connection) => ({
    value: connection.user_id,
    label: connectionLabel(connection),
  }))
  const disabled = connectionOptions.length === 0

  return (
    <form id={formId} action={saveMailOutboxAction} className="relative grid gap-4">
      <FormPendingScreen label="Guardando buzon..." />
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
      action={
        <Button type="submit" form={MODULE_ASSIGNMENTS_FORM_ID} disabled={!activeOptions.length}>
          <Save className="size-4" aria-hidden="true" />
          Guardar uso
        </Button>
      }
    >
      <form id={MODULE_ASSIGNMENTS_FORM_ID} action={saveModuleOutboxSettingsAction} className="relative grid gap-5">
        <FormPendingScreen label="Guardando modulos..." />
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
            Crea o reactiva un buzon antes de asignarlo a un modulo.
          </p>
        ) : null}
      </form>
    </FormSection>
  )
}

function FiscalTaxSettingsForm({ settings }: { settings: FiscalTaxSettings }) {
  return (
    <FormSection
      id="fiscalidad"
      title="Fiscalidad"
      description="Perfil de tramos usado por Estadisticas > Facturacion para estimar IRPF."
      action={
        <div className="flex flex-wrap justify-end gap-2">
          <Badge tone={settings.source === "database" ? "success" : "warning"}>
            {settings.source === "database" ? "Guardado" : "Defecto"}
          </Badge>
          <Button type="submit" form={FISCAL_TAX_SETTINGS_FORM_ID}>
            <Save className="size-4" aria-hidden="true" />
            Guardar fiscalidad
          </Button>
        </div>
      }
    >
      <form id={FISCAL_TAX_SETTINGS_FORM_ID} action={saveFiscalTaxSettingsAction} className="relative grid gap-5">
        <FormPendingScreen label="Guardando fiscalidad..." />
        <FormLoadingOverlay label="Guardando fiscalidad..." />
        <div className="grid gap-4 lg:grid-cols-[8rem_minmax(0,1fr)]">
          <div className="space-y-2">
            <Label htmlFor="tax_year">Año activo</Label>
            <Input id="tax_year" name="tax_year" type="number" min="2000" max="2200" defaultValue={settings.taxYear} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile_label">Etiqueta</Label>
            <Input id="profile_label" name="profile_label" defaultValue={settings.profileLabel} required />
          </div>
        </div>

        <div className="grid gap-3">
          {settings.irpfBrackets.map((bracket, index) => (
            <div
              key={`bracket-${index}`}
              className="grid gap-3 rounded-[var(--radius-panel)] border border-border/80 bg-[color:var(--surface-2)] p-3 sm:grid-cols-[1fr_9rem]"
            >
              <div className="space-y-2">
                <Label htmlFor={`bracket_up_to_${index}`}>Tramo {index + 1}</Label>
                <Input
                  id={`bracket_up_to_${index}`}
                  name="bracket_up_to"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Sin limite"
                  defaultValue={bracket.upTo ?? ""}
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  {bracket.upTo === null ? "Ultimo tramo abierto" : `Hasta ${formatFiscalAmount(bracket.upTo)}`}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`bracket_rate_${index}`}>Tipo</Label>
                <Input
                  id={`bracket_rate_${index}`}
                  name="bracket_rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  defaultValue={bracket.rate}
                  required
                />
                <p className="text-xs leading-5 text-muted-foreground">{formatFiscalPercent(bracket.rate)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="source_note">Nota interna</Label>
          <Input id="source_note" name="source_note" defaultValue={settings.sourceNote ?? ""} />
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
  const [
    { outboxes, moduleSettings, microsoftConnections },
    fiscalSettings,
  ] = await Promise.all([
    listMailSettingsPageData(),
    getFiscalTaxSettingsForYear(currentFiscalYear()),
  ])
  const settingsByModule = moduleSettingMap(moduleSettings)
  const outboxesById = outboxMap(outboxes)
  const connectionsByUserId = mailConnectionMap(microsoftConnections)
  const activeOutboxes = outboxes.filter((outbox) => outbox.active)
  const saved = params.saved === "outbox" || params.saved === "modules" || params.saved === "fiscal"
  const testStatus = firstParam(params.test)
  const testOutbox = firstParam(params.outbox)
  const testRecipient = firstParam(params.to)
  const testMessage = firstParam(params.message)

  return (
    <ResourceListScreen
      header={{
        icon: <Settings2 className="size-6" aria-hidden="true" />,
        title: "Configuracion",
        subtitle: "Buzones Microsoft y asignacion global por modulo.",
        actions: (
          <div className="flex flex-wrap gap-2">
            {saved ? <Badge tone="success">Configuracion guardada</Badge> : null}
            {testStatus === "sent" ? (
              <Badge tone="success">Prueba enviada</Badge>
            ) : null}
            {testStatus === "failed" ? (
              <Badge tone="danger">Prueba fallida</Badge>
            ) : null}
          </div>
        ),
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
        {
          label: "Recepcion",
          value: settingsByModule.get("expense_invoice_intake") ? "Asignado" : "Pendiente",
          description: settingsByModule.get("expense_invoice_intake")
            ? outboxesById.get(settingsByModule.get("expense_invoice_intake") ?? "")?.email_address
            : "Sin buzon",
        },
        {
          label: "Fiscalidad",
          value: String(fiscalSettings.taxYear),
          description: fiscalSettings.profileLabel,
          icon: <Calculator className="size-4" aria-hidden="true" />,
        },
      ]}
    >
      {testStatus === "sent" ? (
        <div className="rounded-[var(--radius-panel)] border border-primary/15 bg-primary/10 px-4 py-3 text-sm text-primary">
          Prueba enviada desde <strong>{testOutbox}</strong> a <strong>{testRecipient}</strong>.
        </div>
      ) : null}
      {testStatus === "failed" ? (
        <div className="rounded-[var(--radius-panel)] border border-red-200/70 bg-red-50 px-4 py-3 text-sm text-red-800">
          No se pudo probar el buzon: {testMessage}
        </div>
      ) : null}
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
                  <div className="flex flex-wrap justify-end gap-2">
                    <Badge tone="neutral">Alta</Badge>
                    <Button type="submit" form={NEW_OUTBOX_FORM_ID} disabled={!microsoftConnections.length}>
                      <Save className="size-4" aria-hidden="true" />
                      Crear buzon
                    </Button>
                  </div>
                </div>
                <OutboxForm formId={NEW_OUTBOX_FORM_ID} connections={microsoftConnections} />
              </div>

              {outboxes.length ? (
                <div className="divide-y divide-border/70 rounded-[var(--radius-panel)] border border-border/80 bg-[color:var(--surface-2)]">
                  {outboxes.map((outbox) => {
                    const connection = connectionsByUserId.get(outbox.connection_user_id)
                    const outboxFormId = `mail-outbox-form-${outbox.id}`
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
                          <div className="flex flex-wrap gap-2">
                            <Button type="submit" form={outboxFormId} disabled={!microsoftConnections.length}>
                              <Save className="size-4" aria-hidden="true" />
                              Guardar buzon
                            </Button>
                            {outbox.active ? (
                              <form action={testMailOutboxAction}>
                                <input type="hidden" name="outbox_id" value={outbox.id} />
                                <FormSubmitButton variant="outline" size="sm" pendingLabel="Probando...">
                                  <Send className="size-3.5" aria-hidden="true" />
                                  Probar
                                </FormSubmitButton>
                              </form>
                            ) : null}
                            {outbox.active ? (
                              <form action={deactivateMailOutboxAction}>
                                <input type="hidden" name="outbox_id" value={outbox.id} />
                                <FormSubmitButton variant="outline" size="sm" pendingLabel="Desactivando...">
                                  Desactivar
                                </FormSubmitButton>
                              </form>
                            ) : null}
                          </div>
                        </div>

                        <DetailFieldGrid>
                          <DetailField label="Conexion" value={connection ? connectionLabel(connection) : outbox.connection_user_id} />
                          <DetailField label="Estado conexion" value={connection?.status === "connected" ? "Conectada" : "Reconectar"} />
                          <DetailField label="Ultimo error" value={outbox.last_error || "Sin errores registrados"} />
                        </DetailFieldGrid>

                        <OutboxForm outbox={outbox} formId={outboxFormId} connections={microsoftConnections} />
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
          <FiscalTaxSettingsForm settings={fiscalSettings} />

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
                <span>CRM queda preparado para futuros emails. Recepcion usa lectura de adjuntos; Teams no usa este buzon global.</span>
              </div>
            </div>
          </FormSection>
        </div>
      </div>
    </ResourceListScreen>
  )
}
