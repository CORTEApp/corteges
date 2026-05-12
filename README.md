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

### Activar modulo Clientes en Supabase
Aplica `supabase/migrations/00000000000006_clients_module.sql` y verifica:

```bash
psql "$SESSION_POOLER" -f supabase/queries/clients_verification.sql
```

### Preparar SQL e importacion desde SharePoint
```bash
npm run sharepoint:export
npm run sharepoint:sql
```

Después de aplicar `supabase/migrations/00000000000004_sharepoint_import_and_model.sql`
y la migración generada por `npm run sharepoint:sql`,
ejecuta:

```bash
npm run sharepoint:import
```

El export real queda en `.sharepoint-export/`, ignorado por git. Configura antes
`SHAREPOINT_SITE_URL` y `ENTRAID_CLIENT_ID` en `.env.local`.

### Metodo canonico: PDFs historicos de Facturas

Para traer los PDFs reales de la lista SharePoint `Facturas` y enlazarlos a
`billing_documents`, el flujo oficial es:

```bash
npm run sharepoint:graph-export
npm run sharepoint:import:billing
npm run sharepoint:billing-pdfs:download
npm run sharepoint:billing-pdfs:upload:dry-run
npm run sharepoint:billing-pdfs:upload
```

Tambien puede ejecutarse de una vez:

```bash
npm run sharepoint:billing-pdfs:all
```

Este flujo descarga solo adjuntos `.pdf` de la lista `Facturas`
(`918d3f77-aa39-4e86-8b1a-831aef7ad68c`) usando `DeviceLogin` de PnP
PowerShell. Cuando aparezca el codigo, se completa el login en
`https://microsoft.com/devicelogin`.

Queda fijado asi porque:

- `AppOnly` sirve para metadata, pero en este tenant devuelve `Access is denied`
  al leer adjuntos de lista.
- `Interactive` no es fiable con la app actual de Entra porque falta redirect URI
  y Microsoft devuelve `AADSTS500113`.
- `DeviceLogin` fue el metodo verificado para adjuntos reales.

La subida guarda los archivos en el bucket privado `billing-documents` y crea el
enlace funcional en `billing_document_files`, resolviendo cada PDF por
`sharepoint_list_id + sharepoint_item_id` contra `billing_documents`. El
inventario `sharepoint_import.binary_files` es auxiliar: si PostgREST no expone
el schema `sharepoint_import`, el importador puede omitir ese inventario sin
romper el enlace operativo de facturacion.

## Regla de oro

- el repo inicial contiene el **sistema**, no la app final
- la app final se genera en `project_init`
- lo crítico debe quedar en archivos versionables
- la UI inicial se compone desde **bloques internos**, no desde prompts abiertos
- no se usa Azure ni Power Automate salvo petición expresa
