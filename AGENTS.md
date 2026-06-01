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
- **Gate obligatorio `frontend-design`**: todo trabajo user-facing debe empezar usando el skill `frontend-design`.
- Si el cambio toca pantalla, componente, navegación, layout, login, UX, copy visible o una captura del usuario, `frontend-design` entra antes de tocar código.
- No entregues UI generada solo desde scaffold, shadcn/ui o bloques internos sin dirección visual explícita.
- Si el trabajo es puramente backend/Supabase/scripts, deja un checkpoint explícito: no se toca UI y no se introduce superficie visual nueva.
- Skynet es una herramienta operativa privada: primera ruta útil, densidad de trabajo diaria, nada de landing genérica, CRM genérico, SaaS demo, copy de starter ni auth genérica.
- Contrato visual obligatorio: `.ai/VISUAL_CONTRACT.md`. El default fijo es `saas_atlas_blue_v2`, `fontSize=medium`, `Plus Jakarta Sans`, escala base 14px y shell Edisol Atlas.
- Toda UI nueva debe heredar tokens, densidad, shell y componentes actuales. No cambies fuente, escala, preset, color primario ni estilo de campos salvo petición expresa.
- Si se toca UI, ejecuta `npm run audit:visual` y revisa desktop/móvil antes de entregar siempre que sea posible.

## Greenfield-first
- El supuesto por defecto es **BBDD nueva desde cero** en Supabase.
- Las migraciones SQL representan infraestructura como código.
- No diseñes importación de legado ni compatibilidad con esquemas previos salvo instrucción explícita.
- Este repo es **Skynet/CORTE.App para uso propio**: no asumas tenants, multiempresa, onboarding de empresa ni memberships salvo petición explícita.
- Si una tabla necesita aislamiento, usa RLS por usuario autenticado o reglas privadas simples. No introduzcas `tenant_id`, `company_id`, `companies` ni `company_memberships` por defecto.

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

## Coolify / Producción
- Antes de tocar despliegue, variables de entorno o credenciales de producción, lee `docs/ops/coolify.md`.
- Panel Coolify: `https://coolify.corteapp.es`.
- App productiva: UUID `x6k0as1xsjbt5lclqz77casu`, recurso `corteges`, FQDN `https://ges.corteapp.es`.
- Proyecto/environment Coolify: `7f4213180e9a0ba72d6a62224` / `f54d9cffed21107a1f716c5d4`.
- SSH operativo: `deploy@coolify.corteapp.es` con clave local `~/.ssh/corteapp_deploy_ed25519`.
- No insertar ni actualizar `environment_variables.value` directamente en PostgreSQL: Coolify cifra esos valores con Laravel.
- No versionar secretos; documenta solo nombres de variables, rutas y procedimientos.

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
- `frontend-design`: obligatorio para cualquier cambio visible o revisión de pantallas.
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
- No modeles multiempresa/tenant salvo que se pida de forma explícita.
- No confíes en filtros del cliente para seguridad.
- Los secrets de OAuth o Stripe no se commitean.

## Barra mínima de revisión
- No cierres setup sin QA si tocaste auth, RLS, esquema o wiring SSR.
- `SYSTEM_STATUS.md` debe reflejar `SYSTEM_READY_FOR_DEVELOPMENT` solo si los checks mínimos pasan.
- Si el pack promete UI fusionada, comprueba rutas, imports y coherencia del catálogo con `tools/ui_system_audit.py`.
