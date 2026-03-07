# UI composition flow

## Flujo recomendado

1. `corteapp-orchestrator`
   - congela la misión y detecta si hay trabajo de superficie/UI
2. `corteapp-nextjs-architect`
   - produce o revisa `design-brief`, `page-structure` y `component-map`
3. `corteapp-feature-builder`
   - compone la página usando `packages/blocks/*`
   - respeta `packages/design-rules/*`
4. `corteapp-qa-security`
   - valida rutas, imports, coherencia del catálogo y seguridad base
5. `corteapp-docs-release`
   - deja documentación y estado operativo claros

## Anti-flujo a evitar

- prompt abierto -> HTML/JSX libre -> parcheo visual manual -> deuda

## Flujo correcto

- contrato -> bloque -> composición -> validación
