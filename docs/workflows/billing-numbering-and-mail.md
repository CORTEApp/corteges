# Numeracion de facturacion y envio de correos

## Numeracion

Supabase es la fuente unica para la numeracion de proformas y facturas. La tabla
`public.billing_number_sequences` conserva el ultimo valor por `document_type`,
`series` y `number_year`, y las funciones RPC de facturacion son las unicas piezas
que deben reservar numeros.

- Proformas: serie `P`, formato `P-YYYY/N`.
- Facturas: serie `F`, formato `F-YYYY/N`.
- La app no debe calcular ni reservar numeros fuera de Postgres.
- La creacion de proformas usa `public.create_billing_proforma`, que reserva el
  numero, crea el documento y crea sus lineas dentro de una unica transaccion.
- La emision de facturas desde proformas pagadas sigue usando
  `public.issue_invoice_from_paid_proforma`, tambien transaccional.

## Envio de correos

La base preparada para envios usa Microsoft Graph, no SMTP.

- `public.mail_outboxes` define los buzones emisores disponibles.
- Las conexiones Microsoft existentes se backfillean como buzones propios
  activos cuando tienen `microsoft_email`.
- `public.mail_outbox_module_settings` asigna el buzon activo que usa cada
  modulo operativo. De momento los modulos canonicos son `billing` y `crm`.
- `public.set_mail_outbox_module_settings` guarda Facturacion y CRM en una
  unica transaccion.
- `public.mail_dispatch_jobs` registra la cola, estado, destinatarios, adjuntos,
  intentos y errores.
- Los PDFs adjuntos salen de `public.billing_document_files` con
  `source_kind = 'generated'`.
- Los helpers server-only de configuracion viven en `lib/mail/settings.ts`:
  `listMailOutboxes`, `upsertMailOutbox`, `setModuleOutbox` y
  `getModuleOutbox`.
- Los helpers de facturacion viven en `lib/mail/billing.ts`:
  `listBillingOutboxes`, `enqueueBillingDocumentEmail` y
  `sendQueuedBillingEmail`. Si no se pasa un buzon explicito,
  `enqueueBillingDocumentEmail` resuelve `module = 'billing'`.

Los buzones compartidos requieren permisos de Exchange Online para enviar como el
buzon compartido y una conexion Microsoft con scopes `Mail.Send` y
`Mail.Send.Shared`.
