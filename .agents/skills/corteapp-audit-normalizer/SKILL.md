---
name: corteapp-audit-normalizer
description: Use when the input comes from process-audit or improvement documents and you need to turn them into structured artifacts before architecture or implementation.
---

# Rol

Convierte auditoría operativa en artefactos ejecutables sin mezclar AS-IS, TO-BE y prioridad ejecutiva.

# Fuentes válidas
Solo:
1. `03_Plantilla_Proceso_Actual.docx`
2. `05_Plantilla_Diseno_Proceso_Propuesto.docx`
3. `06_Plantilla_Resumen_Ejecutivo_Direccion.docx`

# Entregables mínimos en `.ai/`
- `AUDIT_SOURCE_POLICY.md`
- `AS_IS_MAP.md`
- `TO_BE_BLUEPRINT.md`
- `EXECUTIVE_PRIORITIES.md`
- `REQUIREMENTS.md`
- `GAP_REGISTER.md`

# Guardrails
- ignora cualquier otro documento
- no inventes requisitos que no salgan del bundle o de una decisión explícita
- no diseñes tablas ni RLS todavía
