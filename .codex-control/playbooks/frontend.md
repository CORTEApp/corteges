# Playbook: frontend

## Rutas detectadas

- `/` -> `app/page.tsx`
- `/` -> `scaffolds/nextjs/files/app/page.tsx`
- `/auth/error` -> `app/auth/error/page.tsx`
- `/auth/error` -> `scaffolds/nextjs/files/app/auth/error/page.tsx`
- `/auth/login` -> `app/auth/login/page.tsx`
- `/auth/login` -> `scaffolds/nextjs/files/app/auth/login/page.tsx`
- `/automatizaciones` -> `app/(app)/automatizaciones/page.tsx`
- `/automatizaciones` -> `scaffolds/nextjs/files/app/(app)/automatizaciones/page.tsx`
- `/casos` -> `app/(marketing)/casos/page.tsx`
- `/casos` -> `scaffolds/nextjs/files/app/(marketing)/casos/page.tsx`
- `/clientes` -> `app/(app)/clientes/page.tsx`
- `/clientes` -> `scaffolds/nextjs/files/app/(app)/clientes/page.tsx`
- `/clientes/:id` -> `app/(app)/clientes/[id]/page.tsx`
- `/clientes/:id/edit` -> `app/(app)/clientes/[id]/edit/page.tsx`
- `/clientes/nuevo` -> `app/(app)/clientes/nuevo/page.tsx`
- `/contacto` -> `app/(marketing)/contacto/page.tsx`
- `/contacto` -> `scaffolds/nextjs/files/app/(marketing)/contacto/page.tsx`
- `/crm` -> `app/(app)/crm/page.tsx`
- `/crm/oportunidades` -> `app/(app)/crm/oportunidades/page.tsx`
- `/crm/oportunidades/:id` -> `app/(app)/crm/oportunidades/[id]/page.tsx`
- `/crm/oportunidades/:id/edit` -> `app/(app)/crm/oportunidades/[id]/edit/page.tsx`
- `/crm/oportunidades/nuevo` -> `app/(app)/crm/oportunidades/nuevo/page.tsx`
- `/dashboard` -> `app/(app)/dashboard/page.tsx`
- `/dashboard` -> `scaffolds/nextjs/files/app/(app)/dashboard/page.tsx`
- `/estadisticas/facturacion` -> `app/(app)/estadisticas/facturacion/page.tsx`
- `/facturacion/aprobacion` -> `app/(app)/facturacion/aprobacion/page.tsx`
- `/facturacion/facturables` -> `app/(app)/facturacion/facturables/page.tsx`
- `/facturacion/facturables/:id` -> `app/(app)/facturacion/facturables/[id]/page.tsx`
- `/facturacion/facturables/:id/edit` -> `app/(app)/facturacion/facturables/[id]/edit/page.tsx`
- `/facturacion/facturables/nuevo` -> `app/(app)/facturacion/facturables/nuevo/page.tsx`

## Como actuar

- Mantener componentes, estilos y convenciones existentes.
- Cambiar textos, layout o estados dentro de la ruta existente.
- Revisar `.codex-control/pages.md` antes de tocar navegacion.
- En mobile, comprobar overflow y altura real del viewport.
