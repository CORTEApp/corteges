# Schema Map

## Migraciones aplicadas en repositorio
- `00000000000000_bootstrap_extensions.sql`
- `00000000000001_core_private_auth.sql`
- `00000000000002_private_auth_policies.sql`
- `00000000000003_storage_template.sql`
- `00000000000004_sharepoint_import_and_model.sql`
- `*_sharepoint_generated_model.sql` (generada por `npm run sharepoint:sql` tras export real con la siguiente version disponible)
- `00000000000006_clients_module.sql`
- `00000000000007_private_mode_cleanup.sql` (limpieza del scaffold anterior ya aplicado en remoto)
- `00000000000008_user_admin_and_profile_preferences.sql`
- `00000000000010_client_history_entries.sql`
- `00000000000011_client_history_current_manual.sql`
- `00000000000012_billing_facturables.sql`
- `00000000000013_billing_facturables_remove_vat_total.sql`
- `00000000000014_billing_facturables_code_uniqueness.sql`
- `00000000000015_billing_documents.sql`
- `00000000000016_billing_subscriptions.sql`
- `00000000000017_suppliers_module.sql`
- `00000000000018_expense_individuals.sql`
- `00000000000019_sharepoint_binaries.sql`
- `00000000000020_crm_opportunities.sql`
- `00000000000021_crm_teams_agenda.sql`
- `00000000000019_sharepoint_binaries.sql`
- `00000000000029_fiscal_tax_settings.sql`

## Tablas principales (`public`)
- `user_profiles`: perfil por usuario (`id` referencia `auth.users`) con preferencias visuales y rol principal.
- `app_user_roles`: roles simples de app por usuario (`master`, `admin`, `usuario`).
- `audit_logs`: trazabilidad por actor autenticado.
- `clients`: maestro operativo de clientes.
- `client_history_entries`: historico completo de Clientes; conserva duplicados/lineas SharePoint, soporta lineas manuales (`source_kind`) y marca vigente con `is_current`.
- `clients.current_history_entry_id`: puntero a la linea historica vigente que gobierna la ficha operativa.
- `client_invoices`: tabla legacy no expuesta en Clientes; la superficie actual no emite ni gestiona facturas.
- `client_documents`: metadata de documentos privados por cliente, incluyendo metadatos de binario SharePoint cuando procede.
- `billing_facturables`: catalogo limpio de conceptos facturables con `code` unico normalizado, precio base, unidad, estado activo/vigente y trazabilidad SharePoint.
- `billing_documents`: cabeceras de proformas (`P-*`) y facturas (`F-*`) con snapshot de cliente, totales, estado, pago, trazabilidad SharePoint y enlace `source_proforma_id`.
- `billing_document_lines`: lineas de documento copiadas desde Facturables o desde `Trabajos` historico.
- `billing_document_files`: metadata read-only de adjuntos privados de facturas importados desde SharePoint.
- `billing_document_files`: metadata read-only de adjuntos privados de facturas importados desde SharePoint.
- `billing_payments`: pago completo registrado contra una proforma; V1 no admite nuevos pagos parciales.
- `billing_number_sequences`: secuencias por tipo, serie y año; las facturas 2026 continuan en `F-2026/137` y desde 2027 reinician por año.
- `billing_subscriptions`: suscripciones operativas con snapshot de cliente/facturable, vigencia por `start_date/end_date`, cantidad, total recurrente y trazabilidad SharePoint.
- `suppliers`: maestro operativo de proveedores con contacto, metodo de pago, referencias SEPA/Stripe, vigencia y trazabilidad SharePoint.
- `expense_individuals`: gastos puntuales con proveedor obligatorio, factura, fecha, metodo de pago, base, IVA, total historico/manual, flag de adjunto legado y trazabilidad SharePoint.
- `expense_individual_documents`: metadata de documentos privados por gasto individual, con hash/metadatos de origen para binarios recuperados.
- `crm_opportunities`: oportunidades comerciales con empresa, contacto, peticion, origen/campana, owner, estado pipeline, cierre/descarte, trazabilidad SharePoint y auditoria.
- `crm_opportunity_activities`: historial de contactos por oportunidad, importado desde Prospectos o creado manualmente.
- `microsoft_user_connections`: conexion Microsoft por usuario con refresh token cifrado; acceso exclusivo service role.
- `crm_opportunity_meetings`: reuniones Teams/calendario vinculadas a oportunidades, con evento Graph, enlace Teams, asistentes, fechas y auditoria.
- `mail_outboxes`: catalogo global de buzones Microsoft Graph propios o compartidos.
- `mail_outbox_module_settings`: asignacion global de buzon activo por modulo (`billing`, `crm`).
- `mail_dispatch_jobs`: cola trazable de envios de email con idempotencia.
- `fiscal_tax_settings`: perfil fiscal privado por año con tramos IRPF configurables para estimaciones internas de `Estadisticas > Facturacion`.

## Capa SharePoint
- `sharepoint_import.import_runs`: ejecuciones de importacion.
- `sharepoint_import.lists`: metadata de listas/bibliotecas SharePoint.
- `sharepoint_import.fields`: metadata de campos y mapeos SQL.
- `sharepoint_import.attachments_inventory`: inventario de adjuntos por item.
- `sharepoint_import.documents_inventory`: inventario de documentos por item.
- `sharepoint_import.binary_files`: inventario canonico service-role-only de binarios descargados/subidos a Storage.
- `sharepoint_import.sp_*`: staging tipado por lista/biblioteca, generado desde metadata.
- `public.sp_*`: modelo relacional generado por lista/biblioteca con RLS y trazabilidad.
- `public.sp_*__*`: tablas puente para multi-lookups generados.
- `tools/sharepoint_import_clients.mjs`: adaptador especifico para hidratar `public.clients` desde la lista SharePoint `Clientes`.
- `tools/sharepoint_import_facturables.mjs`: adaptador especifico para hidratar `public.billing_facturables` desde la lista SharePoint `Facturables`.
- `tools/sharepoint_import_subscriptions.mjs`: adaptador especifico para hidratar `public.billing_subscriptions` desde la lista SharePoint `Suscripciones`.
- `tools/sharepoint_import_billing_documents.mjs`: adaptador especifico para hidratar `public.billing_documents` y `public.billing_document_lines` desde `Facturas` y `Trabajos`.
- `tools/sharepoint_import_suppliers.mjs`: adaptador especifico para hidratar `public.suppliers` desde la lista SharePoint `Proveedores`.
- `tools/sharepoint_import_expense_individuals.mjs`: adaptador especifico para hidratar `public.expense_individuals` desde la lista SharePoint `Gastos`.
- `tools/sharepoint_import_crm_opportunities.mjs`: adaptador especifico para hidratar `public.crm_opportunities` desde `Potenciales` y `public.crm_opportunity_activities` desde `Prospectos`.
- `tools/sharepoint_download_binaries.ps1`: descarga binarios reales desde SharePoint a `.sharepoint-export/binaries/`.
- `tools/sharepoint_upload_binaries.mjs`: sube binarios a Supabase Storage, enlaza entidades funcionales y archiva el resto.
- `tools/sharepoint_download_binaries.ps1`: descarga binarios reales desde SharePoint a `.sharepoint-export/binaries/`.
- `tools/sharepoint_upload_binaries.mjs`: sube binarios a Supabase Storage, enlaza entidades funcionales y archiva el resto.

## Storage
- `client-documents`: bucket privado para documentos de cliente.
- Ruta esperada: `{client_id}/{uuid-filename}`.
- Politicas de `storage.objects` delegan en helpers `storage_client_document_client_id()`, `can_access_client_document_object()` y `can_manage_client_document_object()`.
- `expense-documents`: bucket privado para facturas/documentos de gastos individuales.
- Ruta esperada: `{expense_individual_id}/{uuid-filename}`.
- `billing-documents`: bucket privado para adjuntos de facturas importadas.
- Ruta esperada: `{billing_document_id}/sharepoint/{sharepoint_item_id}-{sha256}-{filename}`.
- `sharepoint-binaries`: bucket privado de archivo para binarios SharePoint sin superficie funcional propia.
- Ruta esperada: `{sharepoint_list_id}/{sharepoint_item_id}/{sha256}-{filename}`.
- `billing-documents`: bucket privado para adjuntos de facturas importadas.
- Ruta esperada: `{billing_document_id}/sharepoint/{sharepoint_item_id}-{sha256}-{filename}`.
- `sharepoint-binaries`: bucket privado de archivo para binarios SharePoint sin superficie funcional propia.
- Ruta esperada: `{sharepoint_list_id}/{sharepoint_item_id}/{sha256}-{filename}`.

## Funciones clave
- `set_updated_at()`: trigger helper.
- `handle_new_user()`: crea `user_profiles` al alta en `auth.users`.
- `is_app_user()`: helper RLS para acceso privado de usuarios autenticados.
- `has_app_role(text[])` / `is_master_user()`: helpers RLS para administracion de usuarios.
- `next_billing_document_number(text, text, integer)`: reserva atomica de numero por tipo/serie/año.
- `issue_invoice_from_paid_proforma(uuid, date)`: emite factura fiscal desde proforma pagada dentro de una transaccion con bloqueo.
- `set_mail_outbox_module_settings(uuid, uuid)`: guarda en una transaccion los buzones asignados a Facturacion y CRM.

## Seeds y verificación
- `supabase/seed.sql`: seed mínimo, sin datos de negocio ni bootstrap de empresa.
- `supabase/queries/verification.sql`: assertions fail-fast de RLS, políticas base y ausencia del scaffold legacy.
- `supabase/queries/sharepoint_verification.sql`: assertions de staging, RLS y unicidad del modelo SharePoint.
- `supabase/queries/clients_verification.sql`: assertions de RLS, bucket privado y permisos del modulo Clientes.
- `supabase/queries/billing_documents_verification.sql`: assertions de RLS, RPCs, grants y guardas de doble factura del modulo Proformas/Facturas.
- `supabase/queries/billing_subscriptions_verification.sql`: assertions de RLS, grants, unicidad SharePoint y ausencia de tenants/deletes en Suscripciones.
- `supabase/queries/suppliers_verification.sql`: assertions de RLS, unicidad fiscal, permisos y ausencia de tenants en Proveedores.
- `supabase/queries/expense_individuals_verification.sql`: assertions de RLS, grants, bucket privado, FK obligatoria a proveedores, unicidad SharePoint y ausencia de tenants.
- `supabase/queries/sharepoint_binaries_verification.sql`: assertions de inventario binario, buckets privados, RLS/grants, enlaces documentales y ausencia de `company_id`/`management`.
- `supabase/queries/crm_opportunities_verification.sql`: assertions de RLS, grants, unicidad SharePoint, indice `lead_id`, ausencia de tenants y ausencia de deletes en oportunidades.
- `supabase/queries/crm_teams_agenda_verification.sql`: assertions de RLS, grants, token table service-role-only, FK a oportunidades y ausencia de `anon`, `company_id` y `management`.
- `supabase/queries/mail_outbox_module_settings_verification.sql`: assertions de asignacion por modulo, RLS, buzones activos y guardas de desactivacion.
- `supabase/queries/sharepoint_binaries_verification.sql`: assertions de inventario binario, buckets privados, RLS/grants, enlaces documentales y ausencia de `company_id`/`management`.
- `supabase/queries/fiscal_tax_settings_verification.sql`: assertions de RLS, grants, seed de 2026 y ausencia de tenants para configuracion fiscal.
