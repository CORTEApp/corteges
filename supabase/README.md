# Supabase scaffold

Base privada para Skynet/CORTE.App:
- `user_profiles`
- `app_user_roles`
- `audit_logs`
- `clients`
- `client_history_entries`
- `client_invoices`
- `client_documents`

No hay tenants, empresas iniciales ni memberships salvo que se pidan explícitamente en el futuro. La gestión interna de usuarios usa roles simples (`master`, `admin`, `usuario`) ligados a Supabase Auth.

## Flujo recomendado
1. `first_boot`
2. `env_setup`
3. `activate_full_environment`
4. QA de bootstrap y readiness

## Importacion SharePoint Clientes
El modulo `/clientes` lee `public.clients`. La importacion generica de SharePoint crea staging y tablas `sp_*`, pero el maestro operativo de clientes se hidrata con un paso especifico:

1. Completar `.env.local` con `SHAREPOINT_SITE_URL`, `ENTRAID_CLIENT_ID`, `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SECRET_KEY`. Opcionalmente se puede fijar `ENTRAID_TENANT_ID`; si falta, el export intenta derivarlo del host SharePoint.
2. Ejecutar `npm run sharepoint:graph-export -- --env-file C:/GitHub/edisolv2/m365.env --force` para export app-only con Microsoft Graph. Como alternativa manual, `npm run sharepoint:export -- -AuthMode DeviceLogin -Force` completa login PnP.
3. Ejecutar `npm run sharepoint:sql` y aplicar la migracion generada si hay listas nuevas.
4. Ejecutar `npm run sharepoint:import:clients`.

Nota: `npm run sharepoint:import` importa staging/tablas `sp_*`. En remoto requiere exponer el schema `sharepoint_import` en PostgREST o cambiar ese import a SQL directo. Para modulos operativos, usa los importadores especificos: `sharepoint:import:clients`, `sharepoint:import:facturables`, `sharepoint:import:subscriptions` y `sharepoint:import:billing`.

`sharepoint:import:clients` preserva dos capas:
- `clients`: cliente canonico actual, consolidado por CIF.
- `client_history_entries`: todas las lineas/items SharePoint, incluidos duplicados historicos y entradas sin CIF.

`sharepoint:import:subscriptions` hidrata `billing_subscriptions` desde la lista `Suscripciones`. Conserva snapshot de cliente/facturable, convierte fechas fin de año `>=2100` en vigencia abierta y no escribe de vuelta en SharePoint.

Si solo se quiere alimentar el listado operativo tras un export ya existente:

```bash
npm run sharepoint:import:clients
```
