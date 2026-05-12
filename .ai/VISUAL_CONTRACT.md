# Visual Contract: CORTE.Ges / Edisol Atlas

## Fuente De Verdad
- Referencia visual: `C:\GitHub\edisolv2\edisol`.
- Marca visible: `CORTE.Ges`, usando el mark fuente de `C:\GitHub\webv3\public\brand`.
- Aplicacion objetivo: herramienta privada y operativa, no landing, no CRM generico, no starter.
- Preset fijo: `saas_atlas_blue_v2`.
- Modo fijo de arranque: `themeMode=system`, resolviendo claro/oscuro antes del primer paint.
- Escala fija: `data-font-size="medium"` con `html { font-size: 14px; }`.
- Fuente fija: `Plus Jakarta Sans` expuesta como `--font-generated-sans`.

## Tokens Obligatorios
- Color de accion y foco: `--primary`.
- CTA fuerte: fondo `--primary` y texto/iconos blancos constantes.
- Campos rellenos: `--field-filled`.
- Superficies: `--surface-1`, `--surface-2`, `--surface-3`.
- Shell lateral: `--sidebar`, `--sidebar-border`, `--sidebar-accent`, `--sidebar-active`.
- Texto, bordes y anillos deben salir de tokens globales, no de colores Tailwind sueltos.

## Contrato Runtime
- `app/layout.tsx` debe cargar `Plus_Jakarta_Sans` y ejecutar `theme-bootstrap` con `saas_atlas_blue_v2` y `medium`.
- `app/layout.tsx` y la shell deben usar `/brand/corteges/logo-mark.svg` como favicon y mark visible.
- `packages/brand/theme.css` es la fuente de tokens Atlas Blue y de `data-font-size`.
- `app/globals.css` debe aplicar `var(--font-generated-sans)` como fuente base.
- Ancho operativo: las pantallas privadas usan `--layout-max-width: clamp(80rem, calc(100vw - 24rem), 140rem)` para aprovechar monitores anchos sin romper la lectura.
- Iconografia: los iconos Lucide usan trazo global `1.6` y los iconos auxiliares deben mantener una densidad visual equivalente, sin afectar al logo de marca.
- Toda pantalla nueva hereda la shell, tokens, densidad y componentes actuales.
- Si una tarea toca UI, debe entrar `frontend-design` antes de tocar codigo y se revisa desktop/mobile antes de entregar.
- Si una tarea no toca UI, se declara expresamente que no introduce superficie visual nueva.
- Excepcion aprobada: `/perfil` puede ofrecer preferencias visuales como Edisol. El fallback y primer arranque siguen siendo `saas_atlas_blue_v2`, `system` y `medium`.

## Prohibido
- Presets verdes/jade como `saas_graphite_jade_v2` o `graphite_jade`.
- Clases runtime `bg-emerald-*`, `text-emerald-*`, `border-emerald-*` o equivalentes visuales verdes.
- `richColors` en toasts si trae semantica visual ajena al sistema.
- Assets starter visibles: `next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`.
- Copy starter o marketing generico visible: `CORTE.App Starter`, `CORTE.Ges Starter`, `Solicitar demo`, `Ver casos`, `Procesos mas claros`, `magic link`.
- Pantallas de auth genericas o scaffold shadcn sin direccion visual Atlas.
- Selector de tema fuera de `/perfil` hasta que se pida expresamente.

## Auditoria Obligatoria
- Ejecutar `npm run audit:visual` cuando se toque UI o cuando una tarea pueda afectar shell, layout, tokens, auth, navegacion o copy visible.
- Antes de entregar una pantalla nueva, comprobar:
  - `data-preset="saas_atlas_blue_v2"`.
  - `data-font-size="medium"`.
  - fuente computada compatible con `Plus Jakarta Sans`.
  - botones, campos y estados activos usan azul Atlas, no verde.
