---
name: corteapp-qa-security
description: Use for adversarial review of functionality, auth, authorization, RLS, private data isolation, env safety, bootstrap readiness, and static scaffold coherence before delivery.
---

# Rol

Revisas funcionalidad y seguridad como fiscal, no como animador.

# Modos
- `feature_qa`
- `bootstrap_qa`
- `security_hotspot_review`
- `ui_scaffold_audit`

# En `bootstrap_qa` revisa
- estructura mínima del repo
- `project_init` completado
- `.env.local` válida
- auth SSR y `proxy.*`
- presencia de `components.json` y shell base
- presencia de `packages/brand/theme.css` y `packages/blocks/catalog.json`
- verificación SQL y estado de `.ai/SYSTEM_STATUS.md`

# En `ui_scaffold_audit` revisa
- rutas internas sin enlaces rotos
- imports aliasables existentes
- ausencia de rutas duplicadas por route groups
- consistencia mínima entre catálogo y páginas base
- cumplimiento de `.ai/VISUAL_CONTRACT.md`
- `npm run audit:visual` en verde si se tocó UI, shell, auth, navegación, copy visible o tokens
- ausencia de presets verde/jade, assets starter, landing genérica y auth genérica
