# Permissions Matrix

## Roles funcionales
- `platform_admin`: superusuario de plataforma.
- `owner`: dueño por empresa.
- `admin`: administrador por empresa.
- `member`: miembro operativo.
- `viewer`: acceso lectura según políticas.

## Matriz resumida por tabla
| Recurso | Select | Insert | Update | Delete |
|---|---|---|---|---|
| `public.companies` | `platform_admin` o miembro de la empresa | `platform_admin` | `platform_admin` o `owner/admin` de esa empresa | `platform_admin` o `owner` |
| `public.user_profiles` | propio usuario, `platform_admin` o admins compartiendo empresa | bootstrap/trigger (`handle_new_user`) | propio usuario (campos seguros) o `platform_admin` | no expuesto a `authenticated` |
| `public.company_memberships` | propio usuario, `platform_admin`, `owner/admin` | `platform_admin` o según `can_manage_membership` | `platform_admin` o según `can_manage_membership` | `platform_admin` o dueño/admin bajo restricciones |
| `public.audit_logs` | `platform_admin` o `owner/admin` | miembros de la empresa o `platform_admin` | no | no |

## Controles adicionales
- RLS habilitado en todas las tablas base.
- `authenticated` no puede elevar `user_profiles.is_platform_admin` por permisos de columna/políticas.
- Aislamiento multiempresa por `company_id` en membresías y auditoría.
