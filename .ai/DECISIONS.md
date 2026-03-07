# Decisions

## 2026-03-07

1. `project_init` se ejecuta vía `tools/project_init.py` (sin `create-next-app .`) para respetar repositorio no vacío.
2. Se corrige `tools/project_init.py` para Windows:
   - runners Node con `.cmd` (`npx.cmd`, `pnpm.cmd`, etc.).
   - directorio temporal `tmp_next_bootstrap` (sin prefijo `.` por restricción de npm naming).
   - `--yes` forzado para evitar prompts interactivos en `create-next-app`.
3. Se tipa explícitamente el manejo de cookies en `lib/supabase/server.ts` y `lib/supabase/proxy.ts` para cumplir `strict`.
4. `tsconfig.json` excluye `scaffolds` para que el build no falle compilando fuentes plantilla.
5. Se mantiene `SUPABASE_SECRET_KEY` como clave server-side principal y `SUPABASE_SERVICE_ROLE_KEY` como fallback legacy opcional.
