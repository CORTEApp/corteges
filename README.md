# CORTE.App — sistema de agentes para repos vacíos con Next.js + Supabase + UI system interno

Este pack está pensado para un **repo vacío**. Se descomprime en la raíz y deja instalada la capa de agentes,
bootstrap, plantillas, herramientas y scaffolds.

La base de **Next.js no viene generada en raíz** a propósito. La crea el sistema en el primer arranque para evitar
mezclar un template fijo con la realidad del proyecto.

## Qué hace este pack

- instala el sistema de agentes en la raíz del repo
- arranca un flujo de **project init** sobre un repo no vacío
- genera la base de **Next.js App Router en TypeScript**
- usa **Tailwind + shadcn/ui** como base UI por defecto
- deja listo el wiring base de **Supabase SSR**
- integra un **UI system interno** para marketing + app shell sin depender del núcleo en servicios externos
- deja migraciones SQL y verificación base en `supabase/`
- soporta `audit_bundle` con fuentes estrictas 3, 5 y 6

## Estructura inicial correcta

```text
/
├─ .ai/
├─ .agents/
├─ .codex/
├─ docs/
├─ scaffolds/
├─ supabase/
├─ templates/
├─ tools/
├─ AGENTS.md
├─ README.md
├─ CHANGELOG.md
├─ .env.local.example
└─ .gitignore
```

## Qué añade la fusión UI

Durante `project_init`, el scaffold superpone:

- rutas de marketing útiles desde el primer arranque (`/`, `/casos`, `/contacto`)
- shell de app reutilizable (`/dashboard`, `/automatizaciones`, `/clientes`, `/settings`)
- `packages/brand`, `packages/ui`, `packages/blocks`, `packages/generators`, `packages/registry`, `packages/qa`
- reglas y contratos para composición basada en bloques internos

## Flujo simplificado

1. **Install Agent System**
   - descomprime el pack en la raíz del repo vacío
2. **First Boot**
   - el orquestador detecta repo vacío y lanza `project_init`
   - `tools/project_init.py` genera Next.js en un directorio temporal y lo fusiona en la raíz sin pisar el sistema de agentes
   - inicializa `shadcn/ui` y añade los componentes base
   - superpone el scaffold de marketing + app y el catálogo interno de bloques
3. **Env Setup**
   - `tools/env_assistant.py` guía el guardado de `.env.local`
4. **Activate Full Environment**
   - bootstrap de Supabase, verificación, readiness check y estado final

## Comandos útiles

### Filtrar audit bundle
```bash
python tools/audit_bundle_guard.py /ruta/al/bundle.zip --out .ai/_audit_bundle
```

### Preparar `.env.local`
```bash
python tools/env_assistant.py --out .env.local --report .ai/ENV_SETUP_REPORT.md
```

### Generar la base de Next.js + shadcn/ui sobre el repo ya inicializado
```bash
python tools/project_init.py --repo-root . --pm npm
```

### Auditar scaffold UI fusionado
```bash
python tools/ui_system_audit.py --root . --report MERGE_AUDIT_REPORT.md
```

### Verificar readiness
```bash
python tools/system_ready_check.py --root . --env-file .env.local --report .ai/SYSTEM_STATUS.md
```

## Regla de oro

- el repo inicial contiene el **sistema**, no la app final
- la app final se genera en `project_init`
- lo crítico debe quedar en archivos versionables
- la UI inicial se compone desde **bloques internos**, no desde prompts abiertos
- no se usa Azure ni Power Automate salvo petición expresa
