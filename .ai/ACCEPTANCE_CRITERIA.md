# Acceptance Criteria

## SharePoint -> Supabase
- `.env.local.example` documenta `SHAREPOINT_SITE_URL`, `ENTRAID_CLIENT_ID` y `SHAREPOINT_EXPORT_DIR`.
- `npm run sharepoint:export` exporta listas visibles y bibliotecas visibles a `.sharepoint-export/`.
- `.sharepoint-export/` queda ignorado por git para evitar commitear datos reales.
- `npm run sharepoint:sql` genera SQL por lista/biblioteca y `sql_manifest.json`.
- La capa `sharepoint_import` no concede acceso directo a `anon` ni `authenticated`.
- Las tablas publicas generadas tienen RLS, unicidad por origen SharePoint y trazabilidad.
- `npm run sharepoint:import` usa `SUPABASE_SECRET_KEY` y puede ejecutarse dos veces sin duplicar items.
- Adjuntos y documentos quedan inventariados como metadata y los binarios se migran con `sharepoint:binaries:*` cuando se requiera Storage.
- `supabase/queries/sharepoint_verification.sql` valida RLS, grants y constraints esperadas.

## Binarios SharePoint
- `pwsh tools/sharepoint_download_binaries.ps1 -OutDir .sharepoint-export -DryRun` confirma candidatos: Gastos 165, Clientes 17, Facturas 135, Proveedores 1, Proyectos 14, Potenciales 15, Documentos 1 y Videos 3.
- `tools/sharepoint_download_binaries.ps1` genera `.sharepoint-export/binaries/manifest.json` con `sha256`, tamaño, ruta local y origen SharePoint.
- `node tools/sharepoint_upload_binaries.mjs --export-dir .sharepoint-export --dry-run` valida enlaces funcionales y archivo sin escribir en Storage.
- `node tools/sharepoint_upload_binaries.mjs --export-dir .sharepoint-export` sube a Supabase Storage remoto de forma idempotente.
- `--local-dir <dir>` permite fallback con estructura `<listId>/<itemId>/<fileName>`.
- Gastos, Clientes y Facturas se enlazan a sus tablas documentales; Proveedores, Proyectos, Potenciales, Documentos y Videos quedan archivados en `sharepoint-binaries`.
- `supabase/queries/sharepoint_binaries_verification.sql` valida buckets privados, RLS/grants, inventario binario, ausencia de `anon`, `company_id` y `management`.

## Clientes
- `/clientes` muestra listado operativo con búsqueda y filtros por activo y pago.
- `/clientes/nuevo` permite crear cliente con identidad, contacto, pago y comentarios.
- `/clientes/[id]` muestra una ficha mini-dashboard read-only con tabs `Ficha`, `Histórico` y `Documentos`.
- `/clientes/[id]/edit` permite editar datos y gestionar documentos; no emite ni gestiona facturas.
- `clients.tax_id` es unico en el sistema.
- `client_documents` usa bucket privado `client-documents`.
- Usuarios autenticados pueden operar el módulo; usuarios sin sesión no acceden.
- `supabase/queries/clients_verification.sql` valida RLS, bucket privado y permisos base.

## Facturacion / Facturables
- `/facturacion/facturables` muestra catalogo operativo con busqueda por denominacion, descripcion y tipo.
- Por defecto solo aparecen registros activos y vigentes; los filtros permiten ver inactivos o historicos.
- `/facturacion/facturables/nuevo`, `/facturacion/facturables/[id]` y `/facturacion/facturables/[id]/edit` siguen flujo listado -> ficha -> edicion.
- `billing_facturables.code` es unico por denominacion normalizada y el import SharePoint es idempotente por codigo.
- `billing_facturables` no expone IVA ni total; solo mantiene precio base y unidad.
- No se emiten facturas desde Facturables ni desde Clientes.
- Desactivar sustituye al borrado fisico.

## Facturacion / Proformas y Facturas
- `/facturacion/proformas` lista proformas con filtros por busqueda, estado y pago.
- `/facturacion/proformas/nuevo` crea proformas `P-YYYY/n` con cliente, fechas, proyecto, observaciones y lineas desde Facturables.
- El pago nuevo solo puede registrarse por el total completo de la proforma.
- El boton `Emitir factura` solo aparece cuando la proforma esta pagada y no tiene factura asociada.
- Emitir factura crea un documento fiscal `F-YYYY/n`, copia las lineas y enlaza `source_proforma_id`.
- La emision fiscal es transaccional en Postgres y no permite doble factura desde la misma proforma.
- `/facturacion/facturas` y `/facturacion/facturas/[id]` muestran la serie fiscal y la referencia a proforma.
- `/facturacion/facturas/[id]` muestra adjuntos y PDFs generados sin exponer origen tecnico y descarga mediante `/facturacion/facturas/[id]/documentos/[documentId]`.
- `tools/sharepoint_import_billing_documents.mjs --dry-run` confirma 135 items de `Facturas` y 264 de `Trabajos`; la linea historica `F-2024/7` queda detectada sin cabecera importada.
- `supabase/queries/billing_documents_verification.sql` valida RLS, grants, RPCs y guardas de doble factura.

## Facturacion / Suscripciones
- `/facturacion/suscripciones` muestra por defecto suscripciones activas hoy, con busqueda y filtro por activas, futuras, finalizadas o todas.
- `/facturacion/suscripciones/nuevo`, `/facturacion/suscripciones/[id]` y `/facturacion/suscripciones/[id]/edit` siguen flujo listado -> ficha -> edicion.
- La ficha muestra snapshot de cliente, CIF, correo, codigo, descripcion, vigencia, cantidad, total recurrente y administracion de baja sin exponer origen tecnico.
- En alta/edicion de suscripciones, precio base 10 €, cantidad 2 e IVA 21 % calcula base 20 €, IVA 4,20 € y total recurrente 24,20 €.
- Al editar un Facturable de 10 € a 12 €, una suscripcion enlazada con cantidad 2 e IVA 21 % pasa de 24,20 € a 29,04 € y los candidatos de aprobacion pendientes se recalculan.
- Finalizar una suscripcion fija `end_date`; no borra fisicamente ni concede `DELETE` a `authenticated`.
- `tools/sharepoint_import_subscriptions.mjs --dry-run` confirma 10 items de `Suscripciones`.
- `supabase/queries/billing_subscriptions_verification.sql` valida RLS, grants, unicidad SharePoint y ausencia de tenants/deletes.
- V1 no genera proformas/facturas recurrentes, PDF, email ni escritura de vuelta a SharePoint.

## Proveedores
- `/proveedores` muestra listado operativo con busqueda y filtros por activo y pago; por defecto muestra activos.
- `/proveedores/nuevo`, `/proveedores/[id]` y `/proveedores/[id]/edit` siguen flujo listado -> ficha -> edicion.
- La ficha muestra tabs `Ficha` y `Administracion`, con contacto, referencias SEPA/Stripe, comentarios y eliminacion confirmada sin exponer origen tecnico.
- La seccion de navegacion `Gastos` contiene `Proveedores` como primer item.
- `suppliers.tax_id` es unico en el sistema.
- Usuarios autenticados pueden operar el modulo; usuarios sin sesion no acceden.
- La eliminacion requiere confirmacion y borra solo la fila local.
- `tools/sharepoint_import_suppliers.mjs --dry-run` confirma 23 items de `Proveedores`, con 22 activos y 1 inactivo.
- `tools/sharepoint_import_suppliers.mjs` importa 21 proveedores unicos por `tax_id`; los duplicados de SharePoint se resuelven priorizando activo y fecha de modificacion mas reciente.
- `supabase/queries/suppliers_verification.sql` valida RLS, unicidad fiscal, permisos base y ausencia de tenants.

## Gastos / Individuales
- `/gastos/individuales` muestra listado operativo con busqueda y filtros por proveedor, pago, año y mes; por defecto muestra el año actual.
- `/gastos/individuales/nuevo`, `/gastos/individuales/[id]` y `/gastos/individuales/[id]/edit` siguen flujo listado -> ficha -> edicion.
- La ficha muestra tabs `Ficha`, `Documentos` y `Administracion`, con proveedor obligatorio, factura, fecha, importes, observaciones y eliminacion confirmada sin exponer origen tecnico.
- La seccion de navegacion `Gastos` contiene `Individuales` y `Proveedores`.
- `expense_individuals.supplier_id` es obligatorio y restringe el borrado de proveedores con gastos asociados.
- `expense_individual_documents` usa bucket privado `expense-documents`.
- La ficha/edicion de gasto permite subida manual multiple y borrado confirmado de documentos.
- Usuarios autenticados pueden operar el modulo; usuarios sin sesion no acceden.
- La eliminacion requiere confirmacion y borra solo la fila local y sus documentos locales.
- `tools/sharepoint_import_expense_individuals.mjs --dry-run` confirma 171 items de `Gastos`, 171 enlaces a proveedor, 168 `N26`, 3 `Caixa`, 119 IVA `0`, 52 IVA `21`, 16 sin `Precio` y 54 descuadres historicos preservados.
- `supabase/queries/expense_individuals_verification.sql` valida RLS, grants, bucket privado, FK obligatoria a proveedores, unicidad SharePoint y ausencia de tenants.

## CRM / Oportunidades
- La navegacion muestra seccion `CRM` con `Oportunidades`; `/crm` redirige a `/crm/oportunidades`.
- `/crm/oportunidades` muestra tablero pipeline con tabs `Abiertas` y `Cerradas`.
- El listado permite filtrar por busqueda, estado, owner, origen, proximos contactos y abiertas/cerradas.
- `/crm/oportunidades/nuevo`, `/crm/oportunidades/[id]` y `/crm/oportunidades/[id]/edit` siguen flujo listado -> ficha -> edicion.
- La ficha muestra tabs `Gestion`, `Ficha` y `Contactos`, permite registrar contactos manuales y cerrar la oportunidad sin borrado fisico.
- El tab `Gestion` muestra agenda mixta, estado de conexion Microsoft y creacion de reuniones Teams.
- `/integraciones/microsoft/connect` y `/integraciones/microsoft/callback` conectan Microsoft Graph delegado por usuario.
- Las reuniones Teams se crean como eventos de calendario del usuario conectado y quedan registradas en `crm_opportunity_meetings` y en el historico como `meeting_online`.
- Si la conexion Microsoft falta o requiere reconexion, la gestion muestra CTA claro y mantiene agenda local.
- Estados canonicos: `new`, `contacted`, `qualified`, `diagnosis_booked`, `diagnosis_attended`, `proposal_sent`, `closed_won`, `closed_lost`, `disqualified`.
- `tools/sharepoint_import_crm_opportunities.mjs --dry-run` confirma 330 oportunidades, 173 contactos y enlace obligatorio por `lead_id`.
- `supabase/queries/crm_opportunities_verification.sql` valida RLS, grants, unicidad SharePoint, indice `lead_id`, ausencia de `anon`, `company_id` y `management`.
- `supabase/queries/crm_teams_agenda_verification.sql` valida token table service-role-only, RLS/grants de reuniones, FK a oportunidades y ausencia de `anon`, `company_id` y `management`.

## Perfil y Usuarios
- `/perfil` muestra preferencias estilo Edisol, guarda nombre, idioma, tema, modo, tamaño y contraseña.
- `/usuarios` lista usuarios Auth, crea usuarios nuevos y permite baja/reactivacion solo a `master`.
- `/usuarios/[id]` permite gestionar roles `master`, `admin`, `usuario`.
- No se permite desactivar el usuario actual ni el ultimo `master` activo.
- `app_user_roles` tiene RLS activo y se verifica desde `supabase/queries/verification.sql`.

## Visual/UI Gate
- Cualquier cambio user-facing declara uso de `frontend-design` antes de implementar.
- No queda scaffold visible, copy de starter, landing generica ni pantalla generica de auth.
- La primera ruta util es operativa y orientada a CORTE.Ges privada, no a marketing.
- La interfaz mantiene densidad operativa diaria y evita estética CRM/SaaS generica.
- Toda pantalla nueva cumple `.ai/VISUAL_CONTRACT.md`: `saas_atlas_blue_v2`, `data-font-size="medium"`, `Plus Jakarta Sans`, base 14px y azul Atlas como primario.
- Toda UI nueva hereda shell, tokens, campos y componentes actuales; no introduce paleta verde/jade, starter assets ni shadcn sin direccion visual.
- `npm run audit:visual` pasa cuando se toca UI, shell, layout, auth, navegacion, copy visible o tokens.
- Antes de enseñar una pantalla nueva se revisa desktop y mobile cuando la ruta sea ejecutable.
- En cambios backend/Supabase/scripts se confirma explicitamente que no se toca UI ni se introduce superficie visual.
