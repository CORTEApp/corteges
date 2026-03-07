# CORTE.App operating system

## Stack por defecto
- Trabaja en **Next.js + Supabase** salvo petición expresa en contra.
- Para repos vacíos, el default es **Next.js App Router + TypeScript + Tailwind + shadcn/ui**.
- En repos ya existentes, respeta **JavaScript o TypeScript** según el repo.
- Usa Next.js completo: Server Components por defecto, Client Components cuando toque, Server Actions, Route Handlers, `proxy.*`, revalidación, auth SSR y webhooks.
- Evita Azure, Power Automate y lock-in innecesario.

## UI system interno
- El scaffold base integra un **catálogo interno de bloques** para marketing y app surface.
- No generes UI abierta desde prompts tipo “hazme una landing moderna”.
- La secuencia preferida es: `brief -> design-brief -> page-structure -> component-map -> composición -> QA`.
- Usa `packages/blocks/catalog.json` y `packages/design-rules/*` como fuente de verdad visual tras `project_init`.
- Prioriza reutilización y coherencia frente a variaciones espontáneas.

## Greenfield-first
- El supuesto por defecto es **BBDD nueva desde cero** en Supabase.
- Las migraciones SQL representan infraestructura como código.
- No diseñes importación de legado ni compatibilidad con esquemas previos salvo instrucción explícita.

## Fuente de verdad técnica
- Prioriza archivos versionables:
  - `supabase/migrations/*.sql`
  - `supabase/seed.sql`
  - `supabase/queries/verification.sql`
  - `lib/supabase/*`
  - `packages/blocks/catalog.json`
  - `packages/design-rules/*`
  - documentos de `.ai/`
- No dejes decisiones críticas solo en el dashboard.

## Fuente de verdad funcional con auditoría
- Si el modo es `audit_bundle` o `hybrid`, solo pueden influir:
  1. `03_Plantilla_Proceso_Actual.docx`
  2. `05_Plantilla_Diseno_Proceso_Propuesto.docx`
  3. `06_Plantilla_Resumen_Ejecutivo_Direccion.docx`
- Todo lo demás es **inerte** y se ignora.

## Ciclo simplificado
1. `install_agent_system`
2. `first_boot` *(incluye `project_init` si el repo está vacío de app)*
3. `env_setup`
4. `activate_full_environment`
5. `ready`

## Ownership
- `corteapp-orchestrator` decide modo, fase y handoffs.
- `corteapp-supabase-bootstrap` es el dueño del setup y ejecuta `project_init` cuando haga falta.
- `corteapp-nextjs-architect` define shell, superficies y contratos UI cuando hay decisiones reales.
- `corteapp-feature-builder` materializa páginas y bloques sin salirse del catálogo cuando el sistema UI está presente.
- `corteapp-qa-security` valida `bootstrap_qa` y la coherencia estática básica del scaffold.
- `corteapp-docs-release` deja `BOOTSTRAP_REPORT.md`, `ENV_SETUP_REPORT.md` y `SYSTEM_STATUS.md`.

## Memoria duradera
Si el trabajo supera un cambio trivial, crea o actualiza en `.ai/`:
- `PROJECT_BRIEF.md`
- `PLAN.md`
- `STATUS.md`
- `DECISIONS.md`
- `ACCEPTANCE_CRITERIA.md` si hace falta
- `BOOTSTRAP_REPORT.md`, `ENV_SETUP_REPORT.md`, `SYSTEM_STATUS.md` durante setup
- artefactos de auditoría si el input viene de bundle
- `SCHEMA_MAP.md`, `PERMISSIONS_MATRIX.md`, `AUTH_STRATEGY.md` si tocas bootstrap, auth o permisos

## Skills a utilizar
- `corteapp-orchestrator`: coordina tareas multipaso, setup y auditoría.
- `corteapp-audit-normalizer`: normaliza auditoría a requisitos.
- `corteapp-nextjs-architect`: define rutas, shell, límites server/client y contratos UI estructurados.
- `corteapp-supabase-bootstrap`: setup completo, `project_init`, env, link, push, auth SSR y bootstrap.
- `corteapp-supabase-engineer`: evolución del esquema y RLS cuando la base ya existe.
- `corteapp-feature-builder`: implementación de funcionalidad y composición con bloques internos.
- `corteapp-qa-security`: revisión funcional + seguridad + consistencia estática del scaffold.
- `corteapp-docs-release`: README, handoff, entorno y release notes.
- `corteapp-payments-billing`: cobros, suscripciones, checkout y webhooks.

## Reglas de project init
- Como el repo no está vacío después de descomprimir el pack, **no** intentes `create-next-app .` directamente.
- Usa `tools/project_init.py` para crear Next.js en un directorio temporal y fusionarlo de forma controlada en la raíz.
- Inicializa `shadcn/ui` después de que exista `package.json` real.
- Tras la fusión UI, la shell objetivo inicial debe cubrir marketing + app con rutas funcionales mínimas.
- No marques `ready` si faltan `package.json`, `app/layout.tsx`, `components.json`, `proxy.ts`, `lib/supabase/*` o `.env.local` válida.

## Reglas de Supabase
- La secret key solo vive en servidor.
- Los datos privados requieren RLS real.
- En multiempresa, aísla por `company_id` o `tenant_id` y verifica fugas.
- No confíes en filtros del cliente para seguridad.
- Los secrets de OAuth o Stripe no se commitean.

## Barra mínima de revisión
- No cierres setup sin QA si tocaste auth, RLS, esquema o wiring SSR.
- `SYSTEM_STATUS.md` debe reflejar `SYSTEM_READY_FOR_DEVELOPMENT` solo si los checks mínimos pasan.
- Si el pack promete UI fusionada, comprueba rutas, imports y coherencia del catálogo con `tools/ui_system_audit.py`.
