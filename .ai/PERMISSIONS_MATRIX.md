# Permissions Matrix

## Modelo funcional
- CORTE.Ges corre en modo privado de uso propio.
- No hay tenants, empresas, memberships ni roles por empresa.
- La unidad de acceso es el usuario autenticado de Supabase Auth.
- Las operaciones server-side usan `SUPABASE_SECRET_KEY`; el cliente solo usa la publishable key.

## Matriz resumida
| Recurso | Select | Insert | Update | Delete |
|---|---|---|---|---|
| `public.user_profiles` | propio usuario | trigger `handle_new_user` | propio usuario, campos seguros; service role para admin | no expuesto |
| `public.app_user_roles` | propio usuario o `master` | `master`/service role | no | `master`/service role |
| `public.audit_logs` | usuario autenticado | usuario autenticado | no | no |
| `public.clients` | usuario autenticado | usuario autenticado | usuario autenticado | usuario autenticado |
| `public.client_documents` | usuario autenticado | usuario autenticado | usuario autenticado | usuario autenticado |
| `public.billing_facturables` | usuario autenticado | usuario autenticado | usuario autenticado | usuario autenticado |
| `public.billing_documents` | usuario autenticado | usuario autenticado | usuario autenticado | usuario autenticado |
| `public.billing_document_lines` | usuario autenticado | usuario autenticado | usuario autenticado | usuario autenticado |
| `public.billing_document_files` | usuario autenticado | service role | service role | service role |
| `public.billing_payments` | usuario autenticado | usuario autenticado | usuario autenticado | usuario autenticado |
| `public.billing_number_sequences` | usuario autenticado | RPC server-side | RPC server-side | no expuesto |
| `public.billing_subscriptions` | usuario autenticado | usuario autenticado | usuario autenticado | no expuesto |
| `public.suppliers` | usuario autenticado | usuario autenticado | usuario autenticado | usuario autenticado |
| `public.expense_individuals` | usuario autenticado | usuario autenticado | usuario autenticado | usuario autenticado |
| `public.expense_individual_documents` | usuario autenticado | usuario autenticado | usuario autenticado | usuario autenticado |
| `public.crm_opportunities` | usuario autenticado | usuario autenticado | usuario autenticado | no expuesto |
| `public.crm_opportunity_activities` | usuario autenticado | usuario autenticado | usuario autenticado | no expuesto |
| `public.crm_opportunity_meetings` | usuario autenticado | usuario autenticado | usuario autenticado | no expuesto |
| `public.microsoft_user_connections` | service role | service role | service role | service role |
| `storage.objects/client-documents` | usuario autenticado con documento asociado | usuario autenticado si la ruta empieza por un `client_id` existente | usuario autenticado con documento asociado | usuario autenticado con documento asociado |
| `storage.objects/expense-documents` | usuario autenticado con gasto asociado | usuario autenticado si la ruta empieza por un `expense_individual_id` existente | usuario autenticado con gasto asociado | usuario autenticado con gasto asociado |
| `storage.objects/billing-documents` | usuario autenticado con factura asociada | service role | service role | service role |
| `storage.objects/sharepoint-binaries` | service role | service role | service role | service role |
| `public.sp_*` | usuario autenticado | usuario autenticado | usuario autenticado | usuario autenticado |
| `sharepoint_import.*` | sin acceso cliente directo | sin acceso cliente directo | sin acceso cliente directo | sin acceso cliente directo |

## Controles adicionales
- RLS habilitado en tablas privadas y operativas.
- `master` es el único rol con gestión de usuarios en `/usuarios`.
- `sharepoint_import` revoca acceso a `anon` y `authenticated`; se alimenta con clave server-side.
- `sharepoint_import.binary_files` inventaria binarios y solo se escribe/lee con service role.
- `client-documents` es privado y su ruta esperada es `{client_id}/{uuid-filename}`.
- `billing-documents` es privado; la UI de facturas solo descarga adjuntos ya importados mediante URL firmada.
- `sharepoint-binaries` es un archivo privado sin acceso directo de usuarios autenticados.
- Clientes no expone emisión ni gestión de facturas; cualquier tabla legacy de facturas queda fuera de la superficie funcional actual.
- La numeracion de facturas se reserva por RPC y la emision desde proforma pagada se hace con bloqueo transaccional en Postgres.
- Suscripciones se finaliza con `end_date`; no hay borrado fisico ni grant `DELETE`.
- Proveedores permite borrado fisico confirmado en la base local solo si no tiene gastos individuales asociados; no modifica SharePoint.
- Gastos individuales exige proveedor existente y usa `ON DELETE RESTRICT` sobre `suppliers`.
- CRM no expone borrado fisico de oportunidades ni contactos; el cierre se modela por estado (`closed_won`, `closed_lost`, `disqualified`).
- Las conexiones Microsoft se gestionan solo server-side con service role; `authenticated` no puede leer ni escribir refresh tokens.
- Las reuniones Teams de CRM son visibles para usuarios autenticados, pero no exponen borrado fisico en V1.
- La arquitectura no debe reintroducir `tenant_id`, `company_id`, `companies`, `company_memberships` ni bootstrap de empresa sin petición explícita.
