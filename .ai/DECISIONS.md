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

## 2026-05-08

1. La integracion SharePoint -> Supabase se implementa como flujo manual idempotente: export JSON, generacion SQL, aplicacion de migracion e import con upsert.
2. El alcance de SharePoint incluye listas visibles y bibliotecas documentales visibles; se excluyen listas ocultas/sistema.
3. El modelo usa dos capas: `sharepoint_import` para staging sin acceso cliente y tablas `public.sp_*` generadas con RLS y trazabilidad SharePoint.
4. Los adjuntos y documentos se inventarian como metadata; la migracion de binarios a Supabase Storage queda fuera de esta fase.
5. El importador exige `SUPABASE_SECRET_KEY` y no usa claves publicables para operaciones server-side.
6. El modulo Clientes usa modelo propio (`clients`, `client_documents` y trazabilidad histórica) y no replica la UI ni la estructura de PowerApps.
7. La ficha de cliente se separa en listado `/clientes`, alta `/clientes/nuevo` y detalle editable `/clientes/[id]`.
8. Pagos quedan como estado administrativo sin integracion Stripe/SEPA real.
9. Documentos de cliente se suben a Supabase Storage privado en bucket `client-documents`.
10. El despliegue de Supabase remoto se hizo con `npx supabase db push --db-url SESSION_POOLER --include-all`, sin depender de link local de CLI.
11. CORTE.Ges queda en modo privado de uso propio: sin tenants, empresas, memberships ni bootstrap de empresa.
12. Se elimina `bootstrap_first_company` y cualquier dependencia de `company_id`; el acceso se gobierna por Supabase Auth + RLS simple.
13. CORTE.Ges es una app operativa privada, no una landing ni una demo SaaS.
14. `frontend-design` queda como gate obligatorio para cualquier pantalla, componente, layout, navegación, login, UX, copy visible o revisión por captura.
15. En tareas puramente backend/Supabase/scripts se debe registrar el checkpoint: no se toca UI ni se introduce superficie visual nueva.
16. La referencia visual obligatoria para la app privada es `C:\GitHub\edisolv2\edisol`: tokens, shell, page headers, cards, filtros, tablas y formulario operativo se alinean con ese sistema.
17. CORTE.Ges fija por defecto el preset visual `saas_atlas_blue_v2`, `fontSize=medium` y `themeMode=system`.
18. El contrato visual queda versionado en `.ai/VISUAL_CONTRACT.md` y se hace exigible con `npm run audit:visual`; cualquier UI futura debe heredar Atlas Blue, `Plus Jakarta Sans`, escala 14px y componentes/shell actuales.
19. `/perfil` queda aprobado como excepcion controlada al selector visual: puede guardar preferencias estilo Edisol, con Atlas Blue como fallback obligatorio.
20. `/usuarios` introduce roles simples de app (`master`, `admin`, `usuario`) sobre Supabase Auth, sin tenants ni empresas; solo `master` gestiona usuarios.

## 2026-05-09

1. Los modulos privados con entidad adoptan flujo Dorado: listado -> ficha read-only -> edicion separada.
2. `Clientes` mantiene `/clientes/nuevo`, usa `/clientes/[id]` como ficha de lectura y `/clientes/[id]/edit` para datos y documentos.
3. `Usuarios` separa alta en `/usuarios/nuevo`, ficha read-only en `/usuarios/[id]` y edicion de roles/acceso en `/usuarios/[id]/edit`.
4. `Perfil` no se fuerza a listado/ficha; se organiza por tabs internas (`Preferencias`, `Seguridad`, `Acceso`).
5. El historico de clientes usa `clients.current_history_entry_id` y `client_history_entries.is_current`; las ediciones manuales crean nueva linea historica `source_kind='manual'`.
6. Clientes no emite ni gestiona facturas; la ficha debe funcionar como mini-dashboard operativo con tabs `Ficha`, `Histórico` y `Documentos`.
7. `Facturables` abre el modulo Facturacion como catalogo de conceptos, no como emision fiscal ni facturas.
8. `Facturables` no gestiona IVA ni total; el catálogo solo conserva precio base y unidad. La fiscalidad se resolverá en módulos posteriores.
9. El borrado de PowerApps se traduce a desactivacion logica (`active=false`) para conservar catalogo historico.
10. La marca visible de la app privada es `CORTE.Ges`; la estetica operativa sigue heredando tokens Edisol Atlas Blue.
11. Facturacion adopta documentos propios (`billing_documents`) y no reutiliza `client_invoices`.
12. Las proformas mantienen serie comercial `P-YYYY/n`; las facturas fiscales usan serie `F-YYYY/n`.
13. En 2026 la serie fiscal continua el historico SharePoint (`F-2026/137` siguiente); el reset anual de facturas empieza en 2027 (`F-2027/1`).
14. V1 solo admite pago completo antes de emitir factura; los pagos parciales quedan como estado historico `legacy_partial`.
15. La emision de factura desde proforma pagada se hace mediante RPC transaccional con bloqueo de la proforma para evitar doble factura.
16. SharePoint queda como fuente historica/importable; esta fase no escribe de vuelta en SharePoint ni genera PDF/email.
17. El historico SharePoint puede contener descuentos/facturas negativas y varias facturas para una misma proforma; las constraints permiten importarlo, mientras la UI nueva mantiene pago completo y una sola factura nueva por proforma.
18. `Suscripciones` se modela como modulo operativo propio (`billing_subscriptions`), no como visor directo de `sp_suscripciones`.
19. La vista por defecto de Suscripciones muestra solo registros activos hoy; futuras y finalizadas se consultan por filtro.
20. La baja de una suscripcion fija `end_date` y conserva historico/trazabilidad; no hay borrado fisico en la UI ni grant `DELETE`.
21. En el estado actual del repo, Suscripciones precarga importes desde `billing_facturables.unit_price * cantidad`; el total recurrente puede sobrescribirse por acuerdos especiales.
22. V1 de Suscripciones no genera proformas/facturas recurrentes, PDF, email ni escritura de vuelta a SharePoint.

## 2026-05-10

1. `Proveedores` se modela como maestro operativo propio (`suppliers`), no como visor directo de `sp_proveedores`.
2. La navegacion crea una seccion `Gastos` y coloca `/proveedores` como primer item; no se conectan todavia gastos, recurrentes ni licencias.
3. La referencia visible es `Stripe`; el campo historico SharePoint `PayPal` se conserva solo como origen legado y se importa en `stripe_reference`.
4. Proveedores permite eliminacion confirmada en la base local; la accion no escribe de vuelta en SharePoint.
5. El acceso usa los roles canonicos existentes (`master`, `admin`, `usuario`) mediante `public.is_app_user()`; no se introduce `management` ni multiempresa.
6. La importacion de Proveedores consolida duplicados por `tax_id`: gana una fila activa frente a una inactiva y, entre filas equivalentes, la modificacion SharePoint mas reciente.
7. La migracion remota de Proveedores queda aplicada por SQL directo via `SESSION_POOLER` porque el historial remoto contiene una version no presente localmente; `00000000000017_suppliers_module.sql` sigue siendo el contrato canonico del esquema.

## 2026-05-11

1. `Gastos individuales` corresponde a la lista SharePoint `Gastos`; `Gastos recurrentes` y `Licencias` quedan fuera de este modulo.
2. Todo gasto individual requiere `supplier_id`; el import historico enlaza por `CIF` contra `suppliers` y conserva snapshot fiscal de proveedor.
3. El total historico importado se preserva aunque no cuadre con `Precio + TipoIVA`; las altas y ediciones manuales recalculan `total_amount` desde base e IVA.
4. Los adjuntos historicos de SharePoint se conservan como `legacy_has_attachment`; la primera entrega de gastos permitia subir nuevos documentos al bucket privado `expense-documents`.
5. La seccion `Gastos` contiene `Individuales` y `Proveedores`; el borrado de proveedores queda bloqueado cuando existan gastos individuales asociados.
6. La migracion de binarios SharePoint se hace en fase propia: descarga desde SharePoint o carpeta local, subida a Supabase Storage e inventario canonico en `sharepoint_import.binary_files`.
7. Los binarios con entidad funcional se enlazan a `expense_individual_documents`, `client_documents` o `billing_document_files`; los demas quedan archivados en el bucket privado `sharepoint-binaries`.
8. La subida manual nueva se mantiene solo en la ficha/edicion de `Gastos > Individuales`, con multiples archivos; no se crea cola central de conciliacion.
9. Facturas muestra adjuntos historicos en modo lectura mediante URLs firmadas; no se introduce subida manual de facturas en esta entrega.
10. `CRM` se crea como seccion propia de navegacion con `/crm/oportunidades` como primera pantalla; `/crm` redirige ahi.
11. `Oportunidades` no replica el PowerApp antiguo: la pantalla inicial es un tablero pipeline editable con columnas operativas.
12. `Potenciales` es la entidad principal y `Prospectos` se importa como historial de contactos enlazado por `lead_id`.
13. `diagnostic_candidate` se normaliza a `qualified`, preservando el valor original en `legacy_status`.
14. CRM no borra fisicamente oportunidades desde UI; se cierran como ganadas, perdidas o descartadas.
15. CRM V1 no convierte oportunidades ganadas en clientes ni escribe de vuelta en SharePoint.
16. `lead_id` queda indexado pero no es unico: SharePoint contiene duplicado historico en los items 400 y 401, y la unicidad canonica se mantiene por origen SharePoint.
17. Temperaturas importadas fuera de rango 0-10 se tratan como dato sucio y se importan como `null`.

## 2026-05-12

1. La agenda dentro de Gestion de oportunidad es mixta: datos locales CRM, reuniones Teams creadas desde CORTE.Ges y calendario Microsoft del usuario conectado.
2. Las reuniones de Teams se crean como eventos de calendario en Microsoft Graph (`/me/events`) con `isOnlineMeeting=true`; no se usan reuniones standalone.
3. La integracion Microsoft es OAuth delegado por usuario y queda separada del login Supabase actual.
4. Los refresh tokens Microsoft se guardan cifrados en `microsoft_user_connections`, tabla service-role-only sin grants a `authenticated` ni `anon`.
5. Crear una reunion de tipo `diagnosis` actualiza la oportunidad a `diagnosis_booked` si sigue abierta y registra una actividad `meeting_online`.
6. V1 no edita ni cancela eventos de Outlook de forma bidireccional; solo crea, visualiza y enlaza a Teams/Outlook.
7. El metodo canonico para traer PDFs historicos de facturas desde SharePoint es PnP PowerShell con `DeviceLogin`, filtrado a la lista `Facturas` (`918d3f77-aa39-4e86-8b1a-831aef7ad68c`) y extension `.pdf`.
8. `AppOnly` queda reservado para metadata/export cuando aplique; no es canonico para adjuntos de lista porque el tenant devuelve `Access is denied`. `Interactive` tampoco es canonico mientras la app Entra no tenga redirect URI valido (`AADSTS500113`).
9. La subida canonica de PDFs de facturas usa `sharepoint_upload_binaries.mjs` filtrado a `Facturas` + `.pdf`, bucket `billing-documents` y tabla funcional `billing_document_files`, enlazando por `sharepoint_list_id + sharepoint_item_id` contra `billing_documents`.
10. `sharepoint_import.binary_files` es inventario auxiliar de auditoria; si PostgREST no expone el schema `sharepoint_import`, se permite omitirlo sin bloquear el enlace operativo en `billing_document_files`.
