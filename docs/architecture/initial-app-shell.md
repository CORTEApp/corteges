# Shell inicial de aplicación

Base recomendada para `project_init` en un repo vacío tras la fusión UI:

- `app/layout.tsx`
- `app/page.tsx` *(marketing home)*
- `app/(marketing)/casos/page.tsx`
- `app/(marketing)/contacto/page.tsx`
- `app/(app)/layout.tsx`
- `app/(app)/dashboard/page.tsx`
- `app/(app)/automatizaciones/page.tsx`
- `app/(app)/clientes/page.tsx`
- `app/(app)/settings/page.tsx`
- `app/auth/login/page.tsx`
- `app/auth/error/page.tsx`
- `app/auth/callback/route.ts`
- `packages/brand/*`
- `packages/ui/*`
- `packages/blocks/*`
- wiring de Supabase SSR en `lib/supabase/`

La shell inicial debe ser ligera, pero ya debe dejar dos superficies útiles:
marketing y app. No metas módulos de negocio antes de tener requisitos.
