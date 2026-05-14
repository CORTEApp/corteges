# Worklog

- 2026-03-07: inicio de `first_boot` según `PRIMERINICIO.md`.
- 2026-03-07: ejecutado `python tools/project_init.py --repo-root . --pm npm`.
- 2026-03-07: incidencia detectada en Windows (`FileNotFoundError` con `npx` sin `.cmd`).
- 2026-03-07: corrección aplicada en `tools/project_init.py` para resolver runners `.cmd`.
- 2026-03-07: incidencia detectada por nombre inválido del temp dir (`.tmp_next_bootstrap`).
- 2026-03-07: corrección aplicada a `tmp_next_bootstrap` + reemplazo de target en runtime.
- 2026-03-07: incidencia por prompt interactivo de `create-next-app`; se fuerza `--yes`.
- 2026-03-07: `project_init` completado, scaffold de Next.js + shadcn + UI blocks fusionado.
- 2026-03-07: QA ejecutada (`npm run lint`, `npm run build`, `ui_system_audit`, `system_ready_check`).
- 2026-03-07: build fallaba por tipos implícitos en cookies SSR; tipado explícito aplicado.
- 2026-03-07: build fallaba compilando archivos de `scaffolds`; `tsconfig.json` actualizado para excluirlos.
- 2026-03-07: entorno validado desde `.env.local`; `.env.local.example` alineado con `SUPABASE_DB_PASSWORD` opcional.
- 2026-03-07: estado final verificado en `.ai/SYSTEM_STATUS.md` como `SYSTEM_READY_FOR_DEVELOPMENT`.
- 2026-05-13: añadida aprobación automática opcional por proveedor para recepción de facturas de gastos, migración aplicada en remoto y verificación SQL ejecutada.
- 2026-05-13: añadida confirmación en ficha de proveedor para aprobar recepciones históricas `extraida` al activar aprobación automática.
- 2026-05-14: convertida la confirmación de aprobación automática de proveedor a modal autoabierto, limpiando la URL al cerrar sin procesar histórico.
