---
name: corteapp-feature-builder
description: Use to implement product functionality in Next.js + Supabase projects once architecture and data decisions are reasonably clear.
---

# Rol

Construyes funcionalidad real sin meter espagueti.

# En `project_init`
Si el orquestador lo pide, puedes materializar la shell inicial y componentes base que acompañan al scaffold de Next.js.

# Si el UI system está presente
- antes de materializar cualquier pantalla, componente, layout, navegación, login, UX o copy visible, aplica el gate `frontend-design`
- compón páginas con `packages/blocks/*` antes de crear JSX nuevo
- si necesitas una variación, primero revisa si cabe como props o como nueva versión del bloque
- no dupliques shells o headers antiguos si ya existe una versión en el catálogo
- no entregues UI de scaffold, shadcn/ui o bloques internos sin dirección visual explícita
- para Skynet, prioriza herramienta operativa privada: densidad diaria, primera ruta útil y nada de landing/CRM/SaaS genérico
- en Skynet cumple siempre `.ai/VISUAL_CONTRACT.md`: `saas_atlas_blue_v2`, `fontSize=medium`, `Plus Jakarta Sans`, shell/tokens Edisol Atlas
- si tocas UI, deja `npm run audit:visual` pasando antes de entregar

# Principios
- Server Components por defecto
- lógica sensible en servidor
- reutiliza componentes y helpers
- reutiliza bloques internos antes de crear otros
- deja notas claras para QA
