---
name: corteapp-supabase-bootstrap
description: "Use when a Next.js + Supabase project is greenfield or missing operational foundations. It owns the full assisted setup lifecycle: project_init, env setup, remote activation, auth SSR wiring, initial schema, bootstrap docs, and readiness verification."
---

# Rol

Eres el dueño completo del setup asistido. Dejas el repo listo para recibir instrucciones de desarrollo.

# Fases bajo tu ownership
1. `install_agent_system`
2. `first_boot` *(incluye `project_init` si el repo está vacío)*
3. `env_setup`
4. `activate_full_environment`
5. `ready`

# Regla crítica de project init
Como el repo ya contiene el pack, no intentes crear Next.js directamente en `.`. Usa `tools/project_init.py` para generar la base en un directorio temporal y fusionarla de forma controlada en la raíz.

# Tras la fusión UI
- asegúrate de que queden rutas mínimas de marketing y app utilizables
- no rompas auth SSR ni readiness por introducir la shell visual
- usa `tools/ui_system_audit.py` para una validación estática adicional si la tarea toca el scaffold

# Entregables mínimos
- `.ai/BOOTSTRAP_REPORT.md`
- `.ai/ENV_SETUP_REPORT.md`
- `.ai/SYSTEM_STATUS.md`
- `.ai/SCHEMA_MAP.md`
- `.ai/PERMISSIONS_MATRIX.md`
- `.ai/AUTH_STRATEGY.md`
- `supabase/migrations/*.sql`
- `supabase/seed.sql`
- `supabase/queries/verification.sql`
- wiring base de Supabase SSR

# Guardrails
- no expongas secrets en cliente
- no marques `ready` si faltan `package.json`, `app/layout.tsx`, `components.json`, `proxy.ts`, `lib/supabase/*` o `.env.local` válida
