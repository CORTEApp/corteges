begin;

create table if not exists public.fiscal_tax_settings (
  id uuid primary key default gen_random_uuid(),
  tax_year integer not null,
  active boolean not null default true,
  profile_label text not null,
  irpf_brackets jsonb not null default '[]'::jsonb,
  source_note text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fiscal_tax_settings_year_check check (tax_year between 2000 and 2200),
  constraint fiscal_tax_settings_label_not_blank check (btrim(profile_label) <> ''),
  constraint fiscal_tax_settings_brackets_array_check check (jsonb_typeof(irpf_brackets) = 'array')
);

create unique index if not exists idx_fiscal_tax_settings_year
  on public.fiscal_tax_settings (tax_year);

create unique index if not exists idx_fiscal_tax_settings_active
  on public.fiscal_tax_settings (active)
  where active;

drop trigger if exists trg_fiscal_tax_settings_updated_at on public.fiscal_tax_settings;
create trigger trg_fiscal_tax_settings_updated_at
before update on public.fiscal_tax_settings
for each row execute function public.set_updated_at();

alter table public.fiscal_tax_settings enable row level security;
alter table public.fiscal_tax_settings force row level security;

revoke all on public.fiscal_tax_settings from anon, authenticated;
grant select, insert, update, delete on public.fiscal_tax_settings to authenticated;

drop policy if exists fiscal_tax_settings_authenticated_select on public.fiscal_tax_settings;
create policy fiscal_tax_settings_authenticated_select
on public.fiscal_tax_settings
for select
to authenticated
using (public.is_app_user());

drop policy if exists fiscal_tax_settings_authenticated_insert on public.fiscal_tax_settings;
create policy fiscal_tax_settings_authenticated_insert
on public.fiscal_tax_settings
for insert
to authenticated
with check (public.is_app_user());

drop policy if exists fiscal_tax_settings_authenticated_update on public.fiscal_tax_settings;
create policy fiscal_tax_settings_authenticated_update
on public.fiscal_tax_settings
for update
to authenticated
using (public.is_app_user())
with check (public.is_app_user());

drop policy if exists fiscal_tax_settings_authenticated_delete on public.fiscal_tax_settings;
create policy fiscal_tax_settings_authenticated_delete
on public.fiscal_tax_settings
for delete
to authenticated
using (public.is_app_user());

insert into public.fiscal_tax_settings (
  tax_year,
  active,
  profile_label,
  irpf_brackets,
  source_note
)
values (
  2026,
  true,
  'Estimacion IRPF general 2026',
  '[
    { "up_to": 12450, "rate": 19 },
    { "up_to": 20200, "rate": 24 },
    { "up_to": 35200, "rate": 30 },
    { "up_to": 60000, "rate": 37 },
    { "up_to": 300000, "rate": 45 },
    { "up_to": null, "rate": 47 }
  ]'::jsonb,
  'Perfil estimativo editable para reserva interna. No sustituye la liquidacion oficial ni las tablas autonomicas aplicables.'
)
on conflict (tax_year) do nothing;

commit;
