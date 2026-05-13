begin;

insert into public.mail_outboxes (
  provider,
  email_address,
  display_name,
  mode,
  connection_user_id,
  active,
  created_by,
  updated_by
)
select
  'microsoft_graph',
  lower(btrim(c.microsoft_email)),
  nullif(btrim(c.display_name), ''),
  'user_mailbox',
  c.user_id,
  true,
  c.user_id,
  c.user_id
from public.microsoft_user_connections c
where c.status = 'connected'
  and nullif(btrim(c.microsoft_email), '') is not null
on conflict (provider, lower(btrim(email_address))) do update
set display_name = coalesce(excluded.display_name, public.mail_outboxes.display_name),
    connection_user_id = excluded.connection_user_id,
    active = true,
    updated_by = excluded.updated_by,
    updated_at = now();

commit;
