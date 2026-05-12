# Plan

1. [x] Ejecutar `project_init` en repo no vacío usando `tools/project_init.py`.
2. [x] Validar y alinear entorno (`.env.local` + `.env.local.example`) para Supabase.
3. [x] Confirmar wiring SSR de Supabase (`lib/supabase/*`, `proxy.ts`, rutas `auth/*`).
4. [x] Ejecutar QA de bootstrap (`lint`, `build`, `ui_system_audit`, `system_ready_check`).
5. [x] Actualizar artefactos de memoria y estado en `.ai/`.
6. [x] Preparar pipeline SharePoint -> Supabase (`export`, `sql`, `import`) con staging idempotente.
7. [x] Añadir migracion base `sharepoint_import` y verificacion SQL para modelo generado.
8. [ ] Ejecutar export real de SharePoint cuando exista `ENTRAID_CLIENT_ID`.
9. [ ] Generar y aplicar `*_sharepoint_generated_model.sql` tras el export real.
10. [ ] Ejecutar import idempotente y verificacion contra Supabase.
11. [x] Implementar modulo Clientes con ficha mini-dashboard, histórico, documentos privados y rutas `/clientes`.
12. [x] Aplicar `00000000000006_clients_module.sql` en Supabase y ejecutar `supabase/queries/clients_verification.sql`.
13. [x] Aplicar migraciones remotas con `npx supabase db push --db-url SESSION_POOLER --include-all`.
14. [x] Ejecutar verificaciones remotas `verification.sql`, `clients_verification.sql` y `sharepoint_verification.sql`.
15. [x] Implementar flujo Next/Supabase `Proforma P-* -> pago completo -> Factura F-*`.
16. [x] Añadir migracion `00000000000015_billing_documents.sql` con documentos, lineas, pagos y secuencias.
17. [x] Añadir rutas `/facturacion/proformas`, `/facturacion/proformas/nuevo`, `/facturacion/proformas/[id]`, `/facturacion/facturas` y `/facturacion/facturas/[id]`.
18. [x] Añadir importador idempotente `tools/sharepoint_import_billing_documents.mjs` para `Facturas` + `Trabajos`.
19. [x] Aplicar migracion remota de documentos de facturacion y ejecutar `npm run sharepoint:import:billing`.
20. [x] Implementar modulo `/facturacion/suscripciones` con listado, alta, ficha read-only, edicion separada y finalizacion por fecha fin.
21. [x] Añadir migracion `00000000000016_billing_subscriptions.sql`, verificacion SQL e importador `tools/sharepoint_import_subscriptions.mjs`.
22. [ ] Aplicar migracion remota de suscripciones y ejecutar `npm run sharepoint:import:subscriptions`.
23. [x] Implementar modulo `/proveedores` con listado, alta, ficha read-only, edicion separada, eliminacion confirmada y navegacion en seccion `Gastos`.
24. [x] Añadir migracion `00000000000017_suppliers_module.sql`, verificacion SQL e importador `tools/sharepoint_import_suppliers.mjs`.
25. [x] Aplicar migracion remota de proveedores y ejecutar `npm run sharepoint:import:suppliers`.
26. [x] Implementar modulo `/gastos/individuales` con listado, alta, ficha read-only, edicion separada, documentos privados y eliminacion confirmada.
27. [x] Añadir migracion `00000000000018_expense_individuals.sql`, verificacion SQL e importador `tools/sharepoint_import_expense_individuals.mjs`.
28. [x] Aplicar migracion remota de gastos individuales y ejecutar `npm run sharepoint:import:expense-individuals`.
29. [x] Implementar soporte de binarios SharePoint con migracion `00000000000019_sharepoint_binaries.sql`, inventario `sharepoint_import.binary_files`, scripts de descarga/subida y UI documental en gastos/facturas.
30. [x] Aplicar migracion remota de binarios y ejecutar `supabase/queries/sharepoint_binaries_verification.sql`.
31. [ ] Descargar/subir binarios reales cuando SharePoint permita leer adjuntos (`E_ACCESSDENIED` con app-only actual) o cuando exista carpeta fallback para `--local-dir`.
32. [x] Implementar modulo CRM `/crm/oportunidades` con tablero pipeline, ficha, edicion, alta manual y registro de contactos.
33. [x] Añadir migracion `00000000000020_crm_opportunities.sql`, verificacion SQL e importador `tools/sharepoint_import_crm_opportunities.mjs`.
34. [x] Aplicar migracion remota de CRM, ejecutar import idempotente y verificar `supabase/queries/crm_opportunities_verification.sql`.
35. [x] Implementar agenda mixta en gestion de oportunidad con reuniones Teams via Microsoft Graph delegado por usuario.
36. [x] Añadir migracion `00000000000021_crm_teams_agenda.sql`, rutas OAuth Microsoft y verificacion SQL `crm_teams_agenda_verification.sql`.
37. [x] Aplicar migracion remota de agenda Teams via `SESSION_POOLER` y verificar `supabase/queries/crm_teams_agenda_verification.sql`.
