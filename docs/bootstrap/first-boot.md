# First Boot

## Objetivo
Generar la base de Next.js sobre un repo que ya contiene el pack de agentes.

## Regla
No uses `create-next-app .` directamente. El directorio ya no está vacío.

## Flujo
1. `tools/project_init.py` crea una app temporal con `create-next-app`.
2. Fusiona solo archivos permitidos en la raíz.
3. Inicializa `shadcn/ui`.
4. Añade componentes base.
5. Superpone el scaffold de `scaffolds/nextjs/files/`.
6. Deja trazas en `.ai/BOOTSTRAP_REPORT.md`.
