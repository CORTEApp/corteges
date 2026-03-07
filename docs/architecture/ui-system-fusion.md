# UI system fusion — arquitectura integrada

## Objetivo

Aterrizar un punto intermedio entre:

- generar UI abierta con herramientas externas
- montar un sistema interno enorme desde cero

La decisión adoptada es:

```text
brief -> design-brief -> page-structure -> component-map -> composición con bloques internos -> QA
```

## Cómo se integra con el pack multiagente

- el repo raíz sigue siendo un **pack de sistema**, no una app ya generada
- `project_init` sigue siendo el punto de materialización
- el UI system se superpone durante `project_init` dentro de `scaffolds/nextjs/files/`
- el orquestador y los especialistas trabajan con contratos estructurados y catálogo interno

## Activos internos introducidos

- `packages/brand/` — tokens y variables CSS
- `packages/ui/` — primitives y wrappers compartidos
- `packages/blocks/` — bloques P0 para marketing y app
- `packages/generators/` — prompts, schemas y ejemplos de contrato
- `packages/registry/` — base para registry interno compatible con shadcn
- `packages/qa/` — guías de QA visual y funcional

## Reglas de composición

1. no inventar bloques fuera de `catalog.json`
2. no dejar CTAs internas apuntando a rutas inexistentes
3. no mezclar shell antigua y shell nueva en paralelo
4. una sola fuente de verdad visual: `packages/design-rules/*` + `packages/brand/*`
5. la app base debe mantener auth SSR y readiness del pack original
