# Auth Strategy

## Modelo
- Proveedor: `Supabase Auth`.
- Flujo inicial: email + contraseña para usuario master privado.
- Objetivo: SSR auth estable con refresh de sesión en proxy.

## Componentes
- Cliente navegador: `lib/supabase/client.ts`.
- Cliente servidor: `lib/supabase/server.ts`.
- Cliente admin server-only: `lib/supabase/admin.ts`.
- Gestión de sesión en proxy: `lib/supabase/proxy.ts` + `proxy.ts`.

## Rutas base
- Login UI: `app/auth/login/page.tsx`.
- Perfil autenticado: `/perfil`.
- Gestión de usuarios: `/usuarios` y `/usuarios/[id]`, solo rol `master`.
- Callback OAuth/OTP: `app/auth/callback/route.ts` queda disponible para flujos futuros, no como login principal.
- Error auth: `app/auth/error/page.tsx`.
- Bootstrap de usuario master: `npm run auth:master` usando `user_master` y `user_master_password`.

## Reglas de seguridad
- `SUPABASE_SECRET_KEY`/`SUPABASE_SERVICE_ROLE_KEY` solo en servidor.
- No se usa clave privilegiada en client components.
- Redirect de callback saneado (`next` solo path interno seguro).
- El proxy actualiza cookies de sesión en cada request matcheado.
- Los roles de app viven en `public.app_user_roles` y se sincronizan con metadata de Supabase Auth para compatibilidad.
- Cualquier cambio visible de auth debe pasar por el gate `frontend-design`; no se acepta pantalla generica de scaffold.
