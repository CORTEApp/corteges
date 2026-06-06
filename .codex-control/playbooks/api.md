# Playbook: API

## Endpoints detectados

- `/api/cron/billing/monthly-invoices` -> `app/api/cron/billing/monthly-invoices/route.ts`
- `/auth/callback` -> `app/auth/callback/route.ts`
- `/auth/callback` -> `scaffolds/nextjs/files/app/auth/callback/route.ts`
- `/clientes/:id/documentos/:documentId` -> `app/(app)/clientes/[id]/documentos/[documentId]/route.ts`
- `/estadisticas/facturacion/export/:kind` -> `app/(app)/estadisticas/facturacion/export/[kind]/route.ts`
- `/facturacion/facturas/:id/documentos/:documentId` -> `app/(app)/facturacion/facturas/[id]/documentos/[documentId]/route.ts`
- `/facturacion/facturas/:id/pdf` -> `app/(print)/facturacion/facturas/[id]/pdf/route.ts`
- `/facturacion/proformas/:id/documentos/:documentId` -> `app/(app)/facturacion/proformas/[id]/documentos/[documentId]/route.ts`
- `/facturacion/proformas/:id/pdf` -> `app/(print)/facturacion/proformas/[id]/pdf/route.ts`
- `/gastos/individuales/:id/documentos/:documentId` -> `app/(app)/gastos/individuales/[id]/documentos/[documentId]/route.ts`
- `/gastos/recepcion/:id/documentos/:documentId` -> `app/(app)/gastos/recepcion/[id]/documentos/[documentId]/route.ts`
- `/integraciones/microsoft/callback` -> `app/integraciones/microsoft/callback/route.ts`
- `/integraciones/microsoft/connect` -> `app/integraciones/microsoft/connect/route.ts`

## Como actuar

- Validar entrada y permisos antes de modificar datos.
- No imprimir secretos en logs ni respuestas.
- Mantener shape de respuesta salvo peticion explicita.
- Documentar errores humanos esperados.
