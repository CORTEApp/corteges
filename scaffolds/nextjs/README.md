# Next.js scaffold

Este scaffold no se copia a la raíz al descomprimir el pack. Se usa durante `project_init`.

## Idea clave
El repo ya no está vacío cuando el pack está instalado, así que `create-next-app .` no es una opción fiable.

## Solución
Usa `tools/project_init.py`:
1. crea una app temporal con `create-next-app`
2. fusiona archivos permitidos en la raíz
3. inicializa `shadcn/ui`
4. añade componentes base
5. superpone los archivos de `scaffolds/nextjs/files/`

## Qué añade la fusión UI
- marketing home y rutas auxiliares (`/`, `/casos`, `/contacto`)
- app surface mínima (`/dashboard`, `/automatizaciones`, `/clientes`, `/settings`)
- bloques, tokens y reglas internas dentro de `packages/`
- contratos de composición y QA reutilizables
