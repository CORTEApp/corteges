# Contexto Codex Control - corteges

## Resumen

- Repo: `corteges`
- Paquete: `corteges`
- Raiz de app/paquete: `.`
- Gestor: `npm`
- Stack detectado: Next.js, React, Supabase, Tailwind, TypeScript
- Sistemas detectados: api, auth, coolify, frontend, migrations, supabase, workers
- Archivos analizados: 520

## Regla operativa

Este repo debe evolucionar por modificacion incremental. No reconstruyas pantallas, servicios o flujos desde cero si existe una implementacion previa.

## Estructura principal

- `app/`
- `components/`
- `docs/`
- `lib/`
- `packages/`
- `scaffolds/`
- `scripts/`
- `supabase/`
- `templates/`
- `tools/`
- `types/`


## Scripts

- `dev`: `next dev`
- `build`: `next build`
- `postinstall`: `PLAYWRIGHT_BROWSERS_PATH=0 playwright install chromium`
- `start`: `next start`
- `lint`: `eslint`
- `test:billing-approval`: `node tools/test_billing_approval_amounts.mjs`
- `test:mail-recipients`: `node tools/test_mail_recipients.mjs`
- `test:invoice-intake`: `node tools/test_invoice_intake_extraction.mjs`
- `audit:ui-system`: `python tools/ui_system_audit.py --root . --report MERGE_AUDIT_REPORT.md`
- `audit:billing-pdf`: `node tools/audit_billing_pdf.mjs`
- `audit:visual`: `npm run audit:ui-system && npm run audit:billing-pdf`
- `auth:master`: `node tools/bootstrap_master_user.mjs`
- `sharepoint:export`: `pwsh -NoProfile -ExecutionPolicy Bypass -File tools/sharepoint_export.ps1`
- `sharepoint:graph-export`: `node tools/sharepoint_graph_export.mjs`
- `sharepoint:sql`: `python tools/sharepoint_generate_sql.py --export-dir .sharepoint-export`
- `sharepoint:import`: `node tools/sharepoint_import.mjs --export-dir .sharepoint-export`
- `sharepoint:import:clients`: `node tools/sharepoint_import_clients.mjs --export-dir .sharepoint-export`
- `sharepoint:import:facturables`: `node tools/sharepoint_import_facturables.mjs --export-dir .sharepoint-export`
- `sharepoint:import:billing`: `node tools/sharepoint_import_billing_documents.mjs --export-dir .sharepoint-export`
- `sharepoint:import:subscriptions`: `node tools/sharepoint_import_subscriptions.mjs --export-dir .sharepoint-export`
- `sharepoint:import:suppliers`: `node tools/sharepoint_import_suppliers.mjs --export-dir .sharepoint-export`
- `sharepoint:import:expense-individuals`: `node tools/sharepoint_import_expense_individuals.mjs --export-dir .sharepoint-export`
- `sharepoint:import:crm-opportunities`: `node tools/sharepoint_import_crm_opportunities.mjs --export-dir .sharepoint-export`
- `sharepoint:import:all`: `npm run sharepoint:import:clients && npm run sharepoint:import:facturables && npm run sharepoint:import:subscriptions && npm run sharepoint:import:billing && npm run sharepoint:import:suppliers && npm run sharepoint:import:expense-individuals && npm run sharepoint:import:crm-opportunities`
- `sharepoint:binaries:download`: `pwsh -NoProfile -ExecutionPolicy Bypass -File tools/sharepoint_download_binaries.ps1 -OutDir .sharepoint-export`
- `sharepoint:binaries:upload`: `node tools/sharepoint_upload_binaries.mjs --export-dir .sharepoint-export`
- `sharepoint:binaries:all`: `npm run sharepoint:binaries:download -- -Force && npm run sharepoint:binaries:upload -- --dry-run && npm run sharepoint:binaries:upload`
- `sharepoint:billing-pdfs:download`: `pwsh -NoProfile -ExecutionPolicy Bypass -File tools/sharepoint_download_binaries.ps1 -OutDir .sharepoint-export -AuthMode DeviceLogin -Force -ListId 918d3f77-aa39-4e86-8b1a-831aef7ad68c -Extensions .pdf`
- `sharepoint:billing-pdfs:upload:dry-run`: `node tools/sharepoint_upload_binaries.mjs --export-dir .sharepoint-export --local-dir .sharepoint-export/binaries --list-id 918d3f77-aa39-4e86-8b1a-831aef7ad68c --extensions .pdf --dry-run`
- `sharepoint:billing-pdfs:upload`: `node tools/sharepoint_upload_binaries.mjs --export-dir .sharepoint-export --local-dir .sharepoint-export/binaries --list-id 918d3f77-aa39-4e86-8b1a-831aef7ad68c --extensions .pdf --continue-on-error`
- `sharepoint:billing-pdfs:all`: `npm run sharepoint:billing-pdfs:download && npm run sharepoint:billing-pdfs:upload:dry-run && npm run sharepoint:billing-pdfs:upload`
- `cron:monthly-invoices`: `node scripts/run-monthly-invoices-cron.mjs`

## Migraciones y datos

- `scaffolds/supabase/migrations/00000000000000_bootstrap_extensions.sql`
- `scaffolds/supabase/migrations/00000000000001_core_multi_tenant.sql`
- `scaffolds/supabase/migrations/00000000000002_membership_and_profiles_policies.sql`
- `scaffolds/supabase/migrations/00000000000003_storage_template.sql`
- `supabase/migrations/00000000000000_bootstrap_extensions.sql`
- `supabase/migrations/00000000000001_core_multi_tenant.sql`
- `supabase/migrations/00000000000002_membership_and_profiles_policies.sql`
- `supabase/migrations/00000000000003_storage_template.sql`
- `supabase/migrations/00000000000004_sharepoint_import_and_model.sql`
- `supabase/migrations/00000000000006_clients_module.sql`
- `supabase/migrations/00000000000007_remove_tenant_scaffold.sql`
- `supabase/migrations/00000000000008_user_admin_and_profile_preferences.sql`
- `supabase/migrations/00000000000010_client_history_entries.sql`
- `supabase/migrations/00000000000011_client_history_current_manual.sql`
- `supabase/migrations/00000000000012_billing_facturables.sql`
- `supabase/migrations/00000000000013_billing_facturables_remove_vat_total.sql`
- `supabase/migrations/00000000000014_billing_facturables_code_uniqueness.sql`
- `supabase/migrations/00000000000015_billing_documents.sql`
- `supabase/migrations/00000000000016_billing_subscriptions.sql`
- `supabase/migrations/00000000000017_suppliers_module.sql`

## Documentacion encontrada

- `.agents/prompts/codex/README.md`
- `.agents/prompts/codex/architect.md`
- `.agents/prompts/codex/audit-normalizer.md`
- `.agents/prompts/codex/docs-release.md`
- `.agents/prompts/codex/feature-builder.md`
- `.agents/prompts/codex/orchestrator.md`
- `.agents/prompts/codex/payments-billing.md`
- `.agents/prompts/codex/qa-security.md`
- `.agents/prompts/codex/supabase-bootstrap.md`
- `.agents/prompts/codex/supabase-engineer.md`
- `.agents/prompts/openclaw/README.md`
- `.agents/prompts/openclaw/architect.md`
- `.agents/prompts/openclaw/audit-normalizer.md`
- `.agents/prompts/openclaw/docs-release.md`
- `.agents/prompts/openclaw/feature-builder.md`
- `.agents/prompts/openclaw/orchestrator.md`
- `.agents/prompts/openclaw/payments-billing.md`
- `.agents/prompts/openclaw/qa-security.md`
- `.agents/prompts/openclaw/supabase-bootstrap.md`
- `.agents/prompts/openclaw/supabase-engineer.md`
- `.agents/skills/corteapp-audit-normalizer/SKILL.md`
- `.agents/skills/corteapp-docs-release/SKILL.md`
- `.agents/skills/corteapp-feature-builder/SKILL.md`
- `.agents/skills/corteapp-nextjs-architect/SKILL.md`
- `.agents/skills/corteapp-orchestrator/SKILL.md`
- `.agents/skills/corteapp-payments-billing/SKILL.md`
- `.agents/skills/corteapp-qa-security/SKILL.md`
- `.agents/skills/corteapp-supabase-bootstrap/SKILL.md`
- `.agents/skills/corteapp-supabase-engineer/SKILL.md`
- `.ai/ACCEPTANCE_CRITERIA.md`

## Riesgos por defecto

- No tocar secretos ni imprimir variables sensibles.
- No hacer cambios destructivos en datos sin confirmacion explicita.
- No cambiar despliegue, dominios ni integraciones externas salvo peticion directa.
- En SQL/migraciones, preferir cambios pequenos, reversibles y documentados.

## Notas de enriquecimiento Codex

# Snapshot operativo: corteges

## Finalidad general

`corteges` es una aplicacion operativa Next.js + Supabase para gestion interna: clientes, proveedores, facturacion, gastos, recepcion de facturas, CRM, usuarios/permisos e integraciones Microsoft.

Aunque el README conserva lenguaje de "pack/scaffold para repo vacio", el snapshot muestra una app ya materializada en `app/`, con modulos de negocio reales, migraciones Supabase avanzadas y scripts de importacion SharePoint. Para Codex Control, conviene tratar este repo como producto operativo vivo, no como scaffold generico.

Stack detectado:

- Next.js App Router + React + TypeScript.
- Supabase para auth, datos, storage/modelo.
- Tailwind y sistema UI interno.
- Integraciones Microsoft Graph / login.microsoftonline.com.
- Scripts npm para auditorias, SharePoint, billing, cron y bootstrap.

Skynet aparece desactivado: `enabled: false`.

## Mapa de zonas y rutas

### Entrada y shell

Rutas activas principales:

- `/` redirige a `/clientes`.
- `/dashboard` redirige a `/clientes`.
- `/automatizaciones` redirige a `/clientes`.
- `/casos` redirige a `/clientes`.
- `/contacto` redirige a `/clientes`.
- `/crm` redirige a `/crm/oportunidades`.

Interpretacion operativa: la app real prioriza superficie privada de trabajo sobre marketing. Las rutas scaffold siguen existiendo bajo `scaffolds/nextjs/files/...` con versiones de marketing/app shell, pero no parecen ser la superficie activa.

Revision manual recomendada:

- Confirmar si las redirecciones desde marketing son intencionales.
- Evitar mezclar rutas de `scaffolds/nextjs/files` con rutas activas de `app/`.
- Si una conversacion pide "cambiar home", aclarar si se refiere a `app/page.tsx` real o al scaffold.

### Auth

Rutas:

- `/auth/login`
- `/auth/callback`
- `/auth/error`

Datos:

- Supabase.
- Cookies/sesion.

Riesgo general bajo en snapshot, pero es zona critica por impacto transversal. Cualquier cambio aqui debe revisar SSR auth, cookies, redirects, variables de entorno y callback OAuth.

### Clientes

Rutas:

- `/clientes`
- `/clientes/nuevo`
- `/clientes/:id`
- `/clientes/:id/edit`
- `/clientes/:id/documentos/:documentId`

Tablas:

- `clients`
- `client_documents`
- `client_history_entries`

Riesgo:

- Listado: medio.
- Alta, detalle y edicion: alto.
- Documentos: medio.

Acciones relevantes:

- Server actions.
- Mutacion HTTP.
- Escritura de datos.
- Redirecciones a anclas de documentos.

### CRM

Rutas:

- `/crm/oportunidades`
- `/crm/oportunidades/nuevo`
- `/crm/oportunidades/:id`
- `/crm/oportunidades/:id/edit`

Tablas:

- `crm_opportunities`
- `crm_opportunity_activities`
- `crm_opportunity_meetings`
- Tambien cruza con `clients`, `client_documents`, `client_history_entries`.

Integraciones:

- `graph.microsoft.com`
- `login.microsoftonline.com`

Riesgo:

- Alto en listado, detalle y edicion.
- Medio en nueva oportunidad.

Puntos de atencion:

- Hay notificaciones/mensajeria.
- Hay escritura y mutaciones.
- Verificar permisos, tokens Microsoft, errores de sincronizacion y consistencia entre oportunidad, actividad y reuniones.

### Facturacion

Rutas principales:

- `/facturacion/facturables`
- `/facturacion/facturables/nuevo`
- `/facturacion/facturables/:id`
- `/facturacion/facturables/:id/edit`
- `/facturacion/facturas`
- `/facturacion/facturas/:id`
- `/facturacion/facturas/:id/pdf`
- `/facturacion/facturas/:id/plantilla`
- `/facturacion/proformas`
- `/facturacion/proformas/nuevo`
- `/facturacion/proformas/:id`
- `/facturacion/proformas/:id/pdf`
- `/facturacion/proformas/:id/plantilla`
- `/facturacion/suscripciones`
- `/facturacion/suscripciones/nuevo`
- `/facturacion/suscripciones/:id`
- `/facturacion/suscripciones/:id/edit`
- `/facturacion/aprobacion`

Tablas:

- `billing_documents`
- `billing_document_lines`
- `billing_document_files`
- `billing_facturables`
- `billing_number_sequences`
- `billing_payments`
- `billing_invoice_approval_batches`
- `billing_invoice_approval_candidates`
- `billing_invoice_approval_lines`

Riesgo:

- Medio para CRUD de facturacion general.
- Alto para `/facturacion/aprobacion`.
- Medio para PDFs, pero con permisos y env vars.

Endpoints/acciones especiales:

- `/api/cron/billing/monthly-invoices`: riesgo alto.
- PDFs bajo `app/(print)/...`: generan/consultan documentos y usan sesion/env.
- Numeracion y mail aparecen en migraciones `00000000000023_billing_mail_and_numbering.sql` y `00000000000024_mail_outbox_module_settings.sql`.

### Estadisticas de facturacion

Rutas:

- `/estadisticas/facturacion`
- `/estadisticas/facturacion/export/:kind`

Tablas:

- `billing_documents`
- `clients`
- `client_documents`
- `client_history_entries`
- `expense_individuals`
- `fiscal_tax_settings`

Riesgo:

- Medio.

Nota: el detector marca "escritura de datos" incluso en estadisticas/export. Conviene revisar manualmente si realmente escribe, registra auditoria, genera archivos temporales o solo consulta.

### Gastos

Rutas de gastos individuales:

- `/gastos/individuales`
- `/gastos/individuales/nuevo`
- `/gastos/individuales/:id`
- `/gastos/individuales/:id/edit`
- `/gastos/individuales/:id/documentos/:documentId`

Tablas:

- `expense_individuals`
- `expense_individual_documents`
- `suppliers`
- `clients`
- `client_documents`
- `client_history_entries`

Riesgo:

- Medio en listado/documentos.
- Alto en alta, detalle y edicion.

Rutas de recepcion:

- `/gastos/recepcion`
- `/gastos/recepcion/:id`
- `/gastos/recepcion/:id/documentos/:documentId`

Tablas:

- `expense_invoice_intake_items`
- `expense_invoice_intake_documents`
- `expense_invoice_intake_events`
- `expense_invoice_supplier_templates`
- `mail_outbox_module_settings`
- `app_user_roles`
- `suppliers`

Integraciones:

- Microsoft Graph.
- Login Microsoft.

Riesgo:

- Alto.

Puntos de atencion:

- Intake de facturas combina permisos, documentos, eventos, templates de proveedor y mailbox.
- Migraciones recientes incluyen deduplicacion, duplicate review y auto approval de proveedor.

### Proveedores

Rutas:

- `/proveedores`
- `/proveedores/nuevo`
- `/proveedores/:id`
- `/proveedores/:id/edit`

Tablas:

- `suppliers`
- `expense_individuals`
- `expense_individual_documents`
- `expense_invoice_intake_documents`
- `clients`
- `client_documents`
- `client_history_entries`

Riesgo:

- Medio en listado.
- Alto en alta, detalle y edicion.

### Usuarios, perfil y settings

Rutas:

- `/usuarios`
- `/usuarios/nuevo`
- `/usuarios/:id`
- `/usuarios/:id/edit`
- `/perfil`
- `/settings`

Tablas:

- `app_user_roles`
- `user_profiles`
- `microsoft_user_connections`
- Varias tablas de clientes, facturacion y gastos segun pantalla.

Integraciones:

- Microsoft Graph.
- Login Microsoft.

Riesgo:

- Alto.

Puntos de atencion:

- `/usuarios/*` controla roles y baja/edicion.
- `/perfil` mezcla usuario actual, conexiones Microsoft y mutaciones.
- `/settings` mezcla permisos, integracion externa, configuracion y escritura.

### Integraciones Microsoft

Rutas:

- `/integraciones/microsoft/connect`
- `/integraciones/microsoft/callback`

Tabla:

- `microsoft_user_connections`

Externos:

- `graph.microsoft.com`
- `login.microsoftonline.com`

Riesgo:

- Alto.

Acciones:

- OAuth/connect.
- Callback.
- Escritura de conexiones.
- Notificaciones/mensajeria.
- Variables de entorno.

## Paginas criticas

Prioridad alta para futuras conversaciones Codex Control:

1. `/api/cron/billing/monthly-invoices`
   - Genera o prepara facturas mensuales.
   - Toca documentos, facturables y aprobaciones.
   - Requiere idempotencia, control de ejecucion, logs y proteccion por secreto/cron auth.

2. `/facturacion/aprobacion`
   - Control de permisos y aprobacion de facturas.
   - Alto impacto economico.
   - Validar roles, estados, batch/candidates/lines y transiciones.

3. `/integraciones/microsoft/connect` y `/integraciones/microsoft/callback`
   - OAuth y persistencia de conexiones.
   - Revisar state/nonce, expiracion de tokens, scopes, errores y secretos.

4. `/gastos/recepcion` y `/gastos/recepcion/:id`
   - Entrada de facturas, documentos, eventos y templates.
   - Requiere trazabilidad y control de duplicados.

5. `/usuarios/*`, `/perfil`, `/settings`
   - Permisos, perfil, roles y conexiones.
   - Cualquier bug puede escalar privilegios o romper acceso.

6. `/clientes/:id`, `/clientes/:id/edit`, `/clientes/nuevo`
   - Modulo base al que redirige la app.
   - Impacta historial, documentos y otros modulos.

7. `/proveedores/:id`, `/proveedores/:id/edit`, `/proveedores/nuevo`
   - Cruza gastos, recepcion y auto-aprobacion.

8. `/crm/oportunidades/:id` y `/crm/oportunidades/:id/edit`
   - Combina CRM, Microsoft Graph y mensajeria.

9. `/facturacion/*/:id/pdf`
   - Documentos imprimibles/autenticados.
   - Revisar permisos, datos expuestos, cache y generacion de archivos.

## Datos e integraciones

### Modelo Supabase por dominios

Auth/permisos:

- `app_user_roles`
- `user_profiles`

Clientes:

- `clients`
- `client_documents`
- `client_history_entries`

Facturacion:

- `billing_documents`
- `billing_document_lines`
- `billing_document_files`
- `billing_facturables`
- `billing_number_sequences`
- `billing_payments`
- `billing_invoice_approval_batches`
- `billing_invoice_approval_candidates`
- `billing_invoice_approval_lines`

Gastos/proveedores:

- `suppliers`
- `expense_individuals`
- `expense_individual_documents`
- `expense_invoice_intake_items`
- `expense_invoice_intake_documents`
- `expense_invoice_intake_events`
- `expense_invoice_supplier_templates`

CRM:

- `crm_opportunities`
- `crm_opportunity_activities`
- `crm_opportunity_meetings`

Integraciones/configuracion:

- `microsoft_user_connections`
- `mail_outbox_module_settings`
- `fiscal_tax_settings`

### Migraciones destacadas

El historial muestra evolucion desde bootstrap hasta modulos reales:

- Bootstrap Supabase, storage y politicas.
- Importacion/modelo SharePoint.
- Clientes.
- Eliminacion de tenant scaffold: `00000000000007_remove_tenant_scaffold.sql`.
- Admin, roles y preferencias.
- Facturables, documentos, suscripciones, PDFs, mail y numeracion.
- Proveedores y gastos.
- CRM y Teams agenda.
- Intake de facturas, mailbox, duplicados y auto-aprobacion.

Nota importante: hay tension documental entre scaffold multi-tenant inicial y guardrails que dicen no asumir multiempresa/tenant salvo peticion explicita. La migracion de eliminacion de tenant scaffold sugiere que el estado real debe ser privado/simple. Revisar manualmente RLS y queries antes de introducir cualquier nocion de tenant.

### Integraciones externas

Microsoft:

- OAuth/connect/callback.
- Graph API.
- Login Microsoft.
- Conexiones por usuario en `microsoft_user_connections`.
- Uso en CRM, perfil, settings y recepcion de facturas.

SharePoint:

Scripts npm detectados:

- Exportacion: `sharepoint:export`, `sharepoint:graph-export`.
- SQL/importacion: `sharepoint:sql`, `sharepoint:import:*`.
- Binarios: `sharepoint:binaries:*`.
- PDFs facturacion: `sharepoint:billing-pdfs:*`.

Operativamente, SharePoint parece ser fuente/import historica o canal de migracion de datos/binarios. No modificar estos scripts sin revisar estructura de `.sharepoint-export`, ids de lista y dry-run.

Mail/outbox:

- `mail_outbox_module_settings`.
- Migraciones de mail y numbering.
- Acciones de notificaciones/mensajeria en CRM, Microsoft y perfil.
- Tests npm: `test:mail-recipients`.

Billing/PDF:

- Auditoria `audit:billing-pdf`.
- Logs en `.codex-logs/billing-pdf-audit`.
- Tests `test:billing-approval`.
- Cron mensual `cron:monthly-invoices`.

## Riesgos operativos

### Seguridad y permisos

- Muchas rutas de alto riesgo combinan `Sesion/cookies`, `Control de permisos` y escritura.
- Revisar RLS en tablas sensibles: usuarios, roles, facturacion, gastos, conexiones Microsoft y documentos.
- Evitar acceso privilegiado desde cliente.
- Confirmar que server actions validan usuario, rol y ownership antes de mutar.

### OAuth y secretos

- Rutas Microsoft usan variables de entorno y servicios externos.
- Revisar que secrets no se filtren al cliente.
- Validar state/CSRF, scopes minimos, expiracion/refresh y manejo de errores.
- Revisar si tokens se almacenan cifrados o con controles adecuados.

### Facturacion

- Riesgo economico: numeracion, PDFs, aprobaciones, pagos, proformas/facturas y cron.
- El cron mensual debe ser idempotente y auditable.
- Las aprobaciones deben tener transiciones explicitas y rollback/estado consistente.
- PDFs deben evitar cache o exposicion indebida entre usuarios.

### Documentos y binarios

- Rutas de documentos redirigen a vistas/anclas, pero pueden estar cerca de storage/download logic.
- Revisar permisos por documento antes de exponer URLs.
- SharePoint binaries upload/download tiene modo dry-run en algunos scripts: conservar esa disciplina.

### Scaffold vs app real

- El snapshot contiene rutas duplicadas entre `app/...` y `scaffolds/nextjs/files/app/...`.
- Las rutas scaffold describen marketing y shell base, mientras las activas suelen redirigir a `/clientes`.
- En futuras tareas, no tocar scaffold pensando que cambia produccion.
- En tareas de project_init/scaffold, no tocar app productiva salvo que se pida.

### Detector automatico incompleto

Hay campos "No detectado automaticamente" y titulos truncados en varias rutas. Tambien hay acciones marcadas como escritura en zonas que podrian ser solo lectura/export. Tratar el snapshot como guia de priorizacion, no como prueba definitiva.

## Playbooks recomendados

### Trabajo incremental

Usar cuando la tarea sea una mejora pequena o bugfix.

Checklist operativo:

- Identificar dominio: clientes, facturacion, gastos, CRM, usuarios, integracion.
- Revisar ruta activa en `app/`, no scaffold.
- Localizar tablas tocadas y server actions/API implicadas.
- Verificar permisos/RLS antes de cambiar mutaciones.
- Ejecutar pruebas especificas si aplican: billing approval, mail recipients, invoice intake, lint/build.

### Frontend

Usar si cambia pantalla, layout, navegacion, copy visible, formulario o UX.

Reglas del repo:

- Gate obligatorio `frontend-design`.
- Respetar `.ai/VISUAL_CONTRACT.md`.
- Usar sistema UI interno, `packages/design-rules/*`, `packages/brand/*`.
- Evitar UI generica tipo starter.
- Para app operativa, priorizar densidad, jerarquia y legibilidad.

Zonas frontend sensibles:

- Formularios de alta/edicion en clientes, proveedores, gastos, usuarios y facturacion.
- Pantallas de aprobacion.
- Recepcion de facturas.
- Settings/perfil por mezcla de permisos e integraciones.

### Supabase/migraciones

Usar si cambia schema, RLS, indices, storage o queries.

Checklist:

- Revisar migraciones existentes y tabla objetivo.
- No introducir multiempresa/tenant salvo peticion explicita.
- No dejar tablas sensibles sin RLS.
- Preparar rollback o estrategia de compatibilidad si hay datos existentes.
- Actualizar `SCHEMA_MAP`, permisos y docs operativas si el cambio es relevante.

### Auth

Usar para login, callback, usuarios, roles, perfil y settings.

Checklist:

- Verificar SSR auth y cookies.
- Revisar `app_user_roles` y `user_profiles`.
- Confirmar redirects y errores.
- Probar usuario sin permisos, usuario normal y admin.
- No exponer service role en cliente.

### API/workers/cron

Usar para route handlers, cron mensual, endpoints PDF/documentos e integraciones.

Checklist:

- Validar auth del endpoint.
- Controlar idempotencia.
- Registrar errores operativos.
- Evitar dobles escrituras en cron/billing.
- Confirmar env vars obligatorias.
- Revisar timeouts y fallos externos.

### Billing/payments

Usar para facturacion, aprobacion, PDFs, numeracion, mail y cron.

Checklist:

- Revisar tablas `billing_*`.
- Validar secuencias de numeracion.
- Confirmar estados de proforma/factura/aprobacion.
- Probar generacion PDF.
- Ejecutar `test:billing-approval` y auditoria PDF si cambia layout/documentos.

### SharePoint/importacion

Usar para migracion o sincronizacion de datos/binarios.

Checklist:

- Hacer dry-run antes de upload.
- Confirmar `ListId`, extensiones y directorio `.sharepoint-export`.
- Separar import de datos e import de binarios.
- No cambiar scripts globales sin probar modulo concreto.

### QA/security

Usar para rutas de alto riesgo o cambios transversales.

Checklist:

- Revisar RLS, server actions, route handlers y secrets.
- Probar permisos negativos.
- Revisar que los endpoints de documentos/PDF no filtren datos.
- Para UI, correr auditoria visual si corresponde.
- Para mail/intake, usar tests especificos existentes.

## Zonas poco detectadas a revisar manualmente

- `lib/`: no hay detalle en snapshot, pero probablemente contiene clientes Supabase, helpers de auth, Microsoft, billing y utilidades compartidas.
- `components/`: no hay mapa de componentes; revisar antes de tocar UI o formularios.
- `packages/ui`, `packages/blocks`, `packages/brand`, `packages/registry`: mencionados por docs, pero no detallados en rutas activas.
- `scripts/`: solo aparece cron mensual; revisar workers reales y tareas programadas.
- `tools/`: muchos scripts SharePoint/auditoria/test; revisar argumentos y efectos antes de ejecutar.
- `supabase/seed.sql`, `supabase/queries/verification.sql`: mencionados como entregables, no detectados explicitamente.
- `proxy.ts`: mencionado como guardrail, no aparece en rutas snapshot.
- `.env.local.example`: existe, pero variables concretas no estan listadas.
- Storage Supabase: hay `storage_template` y documentos/binarios, pero no hay mapa de buckets/policies.
- Mail/outbox: hay tabla y migraciones, pero falta mapa de proveedor real, destinatarios y flujo de envio.
- Coolify: hay docs/playbook, pero no hay detalle de despliegue, variables ni jobs.
- Workers: aparece como sistema/playbook, pero no hay rutas o archivos concretos detectados salvo cron/script.

