# Schema Map

## Migraciones aplicadas en repositorio
- `00000000000000_bootstrap_extensions.sql`
- `00000000000001_core_multi_tenant.sql`
- `00000000000002_membership_and_profiles_policies.sql`
- `00000000000003_storage_template.sql`

## Tablas principales (public)
- `companies`: tenants/empresas.
- `user_profiles`: perfil por usuario (`id` referencia `auth.users`).
- `company_memberships`: relación usuario-empresa con rol.
- `audit_logs`: trazabilidad por empresa y actor.

## Funciones clave
- `set_updated_at()`: trigger helper.
- `handle_new_user()`: bootstrap de perfil al alta en `auth.users`.
- `is_platform_admin()`, `is_member_of_company()`, `has_company_role()`, `current_company_role()`: helpers de autorización.
- `can_manage_membership()`: control de gestión de membresías.
- `bootstrap_first_company(slug, name)`: bootstrap inicial idempotente y protegido.

## Seeds y verificación
- `supabase/seed.sql`: seed mínimo (sin datos de negocio).
- `supabase/queries/verification.sql`: assertions fail-fast de RLS y políticas base.
