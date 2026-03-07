# Auth Strategy

## Modelo
- Proveedor: `Supabase Auth`.
- Flujo inicial: `magic link` por email.
- Objetivo: SSR auth estable con refresh de sesión en proxy.

## Componentes
- Cliente navegador: `lib/supabase/client.ts`.
- Cliente servidor: `lib/supabase/server.ts`.
- Cliente admin server-only: `lib/supabase/admin.ts`.
- Gestión de sesión en proxy: `lib/supabase/proxy.ts` + `proxy.ts`.

## Rutas base
- Login UI: `app/auth/login/page.tsx`.
- Callback OAuth/magic-link: `app/auth/callback/route.ts`.
- Error auth: `app/auth/error/page.tsx`.

## Reglas de seguridad
- `SUPABASE_SECRET_KEY`/`SUPABASE_SERVICE_ROLE_KEY` solo en servidor.
- No se usa clave privilegiada en client components.
- Redirect de callback saneado (`next` solo path interno seguro).
- El proxy actualiza cookies de sesión en cada request matcheado.
