# Env Setup Report

## Archivo objetivo
- `.env.local`

## Entorno declarado
- `local`

## Variables recogidas
| Variable | Estado | Fuente | Observación |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | present | `.env.local` | formato URL válido |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | present | `.env.local` | valor presente (masked) |
| `SUPABASE_SECRET_KEY` | present | `.env.local` | server-side only (masked) |
| `SUPABASE_SERVICE_ROLE_KEY` | missing | `.env.local` | opcional como fallback legacy |
| `SUPABASE_ACCESS_TOKEN` | present | `.env.local` | usado para tareas CLI/automatización (masked) |
| `SUPABASE_DB_PASSWORD` | present | `.env.local` | opcional para operaciones CLI SQL (masked) |

## Validación
- formato básico URL: `ok`
- claves mínimas presentes: `ok`
- secretos en cliente: `no detectado en código fuente`

## Alineaciones aplicadas
- `.env.local.example` actualizado con `SUPABASE_DB_PASSWORD` opcional.
