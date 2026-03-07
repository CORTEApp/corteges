MODO: first_boot

Rol:
Actúa como orquestador principal del sistema presente en este repositorio. Debes coordinar a los agentes y dejar el proyecto completamente inicializado para desarrollo, sin crear todavía módulos de negocio.

Objetivo final:
Dejar este repositorio en estado SYSTEM_READY_FOR_DEVELOPMENT.

Contexto:

- El repositorio parte vacío a nivel de aplicación, pero ya contiene el sistema de agentes en raíz.
- Debes generar la base del proyecto desde cero.
- El stack obligatorio es:
  - Next.js
  - TypeScript
  - App Router
  - Tailwind CSS
  - shadcn/ui
  - Supabase
- No debes asumir que ya existe una aplicación Next.js.
- No debes desarrollar todavía funcionalidades de negocio específicas.
- No debes inventar requisitos funcionales.
- No debes usar documentos de auditoría salvo que se aporten más adelante.

Secuencia obligatoria:

1. project_init
2. bootstrap_env (asistido)
3. supabase_setup (asistido)
4. bootstrap_qa

Reglas de ejecución:

- Ejecuta las fases en ese orden y no saltes ninguna.
- Si una fase depende de datos sensibles o confirmaciones mínimas, solicita solo lo imprescindible.
- Mantén el repositorio limpio, coherente y sin duplicidades.
- No mezcles JavaScript y TypeScript.
- Usa TypeScript como estándar del proyecto.
- La base visual debe quedar preparada para shadcn/ui.
- No dejes scaffolds muertos, archivos de ejemplo sobrantes ni código sin uso.
- No expongas secretos al cliente.
- No uses el panel de Supabase como fuente principal de configuración crítica si puede quedar codificada en el repositorio.
- Si detectas ambigüedad técnica, toma la decisión más conservadora y documenta la decisión en .ai/WORKLOG.md.

Fase 1 — project_init:

- Genera la base del proyecto Next.js desde cero.
- Usa TypeScript.
- Usa App Router.
- Usa Tailwind CSS.
- Deja la estructura lista para integrar shadcn/ui.
- Genera la estructura base mínima de proyecto:
  - app/
  - components/
  - lib/
  - public/
- Deja preparado proxy.ts.
- Deja package.json, configuración TypeScript y configuración base necesarias.
- No generes módulos de negocio todavía.
- No metas lógica de dominio aún.
- Crea una base limpia, mantenible y orientada a crecimiento.

Fase 2 — bootstrap_env (asistido):

- Solicita únicamente las variables imprescindibles para Supabase y entorno.
- Valida formato.
- Guarda correctamente la configuración.
- Prepara .env.local y actualiza .env.local.example si procede.
- Genera .ai/ENV_SETUP_REPORT.md.
- Registra decisiones y validaciones en .ai/WORKLOG.md.

Fase 3 — supabase_setup (asistido):

- Prepara o alinea la estructura de Supabase en el repositorio.
- Deja listas las carpetas y archivos de trabajo de Supabase.
- Prepara migraciones base, seed.sql y verification.sql.
- Integra Supabase con Next.js.
- Configura auth SSR.
- Configura proxy.ts para el ciclo de sesión.
- Deja preparados:
  - lib/supabase/client.ts
  - lib/supabase/server.ts
  - lib/supabase/admin.ts
- Deja preparada la base de auth:
  - login
  - callback
  - error
- No desarrolles todavía tablas de negocio complejas salvo las mínimas necesarias para el bootstrap del sistema.
- No añadas funcionalidades fuera del arranque técnico.

Fase 4 — bootstrap_qa:

- Revisa que el proyecto arranca.
- Revisa que TypeScript está coherente.
- Revisa que no hay mezcla JS/TS.
- Revisa que no hay secretos expuestos.
- Revisa que la integración con Supabase está correctamente cableada.
- Revisa que proxy.ts está correctamente ubicado y coherente.
- Revisa que el estado final permite empezar desarrollo funcional.
- Genera un resumen claro de hallazgos y correcciones.

Artefactos obligatorios a crear o actualizar:

- .ai/SYSTEM_STATUS.md
- .ai/BOOTSTRAP_REPORT.md
- .ai/ENV_SETUP_REPORT.md
- .ai/AUTH_STRATEGY.md
- .ai/SCHEMA_MAP.md
- .ai/PERMISSIONS_MATRIX.md
- .ai/WORKLOG.md

Criterio estricto de éxito:
Solo marca SYSTEM_READY_FOR_DEVELOPMENT si al finalizar se cumple todo esto:

- proyecto Next.js generado y ordenado
- TypeScript activo
- Tailwind operativo
- base lista para shadcn/ui
- Supabase integrado
- auth SSR preparada
- proxy configurado
- entorno validado
- artefactos .ai actualizados
- repo listo para recibir instrucciones de desarrollo

Entregable esperado:

- repositorio inicializado
- estado documentado
- ningún módulo de negocio creado todavía
- sistema preparado para continuar con desarrollo guiado
