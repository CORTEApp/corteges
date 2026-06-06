# Playbook: Supabase

## Contexto

Migraciones detectadas:

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
- `supabase/migrations/00000000000018_expense_individuals.sql`
- `supabase/migrations/00000000000019_sharepoint_binaries.sql`
- `supabase/migrations/00000000000020_crm_opportunities.sql`
- `supabase/migrations/00000000000021_crm_teams_agenda.sql`
- `supabase/migrations/00000000000022_billing_generated_pdfs.sql`
- `supabase/migrations/00000000000023_billing_mail_and_numbering.sql`
- `supabase/migrations/00000000000024_mail_outbox_module_settings.sql`
- `supabase/migrations/00000000000025_backfill_mail_outboxes_from_microsoft_connections.sql`
- `supabase/migrations/00000000000026_billing_invoice_approvals.sql`
- `supabase/migrations/00000000000027_expense_invoice_intake.sql`

## Como actuar

- Confirmar proyecto Supabase correcto antes de operar.
- Para SQL real, usar MCP o puente autorizado configurado para el repo.
- No usar placeholders ni variables dudosas.
- En cambios destructivos, pedir confirmacion explicita.
- Guardar migraciones pequenas y auditables.
