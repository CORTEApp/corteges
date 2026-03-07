# Merge decisions

## Base de la fusión
- Se ha tomado `corteapp-nextjs-supabase-agent-pack-v6-final` como **fuente base operativa**.
- El UI system V1 se ha integrado como **capacidad del scaffold** y como **conocimiento operativo de los agentes**.

## Decisiones clave
- **No** se ha convertido el pack en monorepo.
- **No** se han copiado la estructura de app del UI pack, el workspace original ni su `package.json` raíz para evitar contradicciones con `project_init`.
- El UI system vive dentro de `scaffolds/nextjs/files/packages/*` para materializarse solo cuando toque.
- Se ha mantenido el flujo original de `project_init` y Supabase SSR.
- Se ha sustituido la shell anterior del scaffold por una shell integrada con dos superficies:
  - marketing: `/`, `/casos`, `/contacto`
  - app: `/dashboard`, `/automatizaciones`, `/clientes`, `/settings`

## Contradicciones resueltas
- navegación antigua `/dashboard/clientes` y `/dashboard/ajustes` eliminada
- shell duplicada `components/layout/*` eliminada del scaffold
- `app/dashboard/page.tsx` antiguo eliminado para evitar colisión con `app/(app)/dashboard/page.tsx`
- documentación del UI pack reescrita para el modelo real del pack de agentes

## Auditoría incluida
- `tools/ui_system_audit.py`
- `MERGE_AUDIT_REPORT.md`
- `MERGE_AUDIT_REPORT.json`

## Qué valida la auditoría
- rutas duplicadas o rotas
- hrefs internas sin destino
- imports aliasados inexistentes
- consistencia mínima de catálogo y registry
- ausencia de referencias documentales residuales al modelo de monorepo
