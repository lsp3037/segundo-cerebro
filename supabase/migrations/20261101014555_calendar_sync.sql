-- Fase 3: Google Agenda nos dois sentidos.

-- Ocorrência alterada/cancelada de um evento que se repete: guarda o horário original
-- para a tela saber qual repetição ela substitui.
alter table public.events add column original_start_at timestamptz;
alter table public.events add column html_link text;
create index events_recurring_idx on public.events (user_id) where recurrence is not null and deleted_at is null;
create index events_overrides_idx on public.events (recurring_event_id, original_start_at) where recurring_event_id is not null;

alter table public.calendars add column is_primary boolean not null default false;
alter table public.calendars add column access_role text;
alter table public.calendars add column time_zone text;
alter table public.calendars add column last_error text;

-- Extensões para a rotina de segurança (pg_cron chama o app por HTTP com pg_net).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Grava segredos no Vault (cofre criptografado do Supabase). Só o servidor (service role) chama,
-- assim os valores nunca precisam aparecer em arquivos ou no SQL Editor.
create or replace function public.admin_set_secret(secret_name text, secret_value text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing uuid;
begin
  if secret_name not in ('cron_secret', 'app_url') then
    raise exception 'Segredo não permitido: %', secret_name;
  end if;

  select id into existing from vault.secrets where name = secret_name;
  if existing is null then
    perform vault.create_secret(secret_value, secret_name);
  else
    perform vault.update_secret(existing, secret_value);
  end if;
end;
$$;

revoke all on function public.admin_set_secret(text, text) from public, anon, authenticated;
grant execute on function public.admin_set_secret(text, text) to service_role;

-- A cada 15 minutos: renova os canais de aviso do Google e faz uma sincronização de segurança.
-- Só chama se o endereço do app e o segredo já estiverem no Vault.
create or replace function private.call_google_sync()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url');
  secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret');
begin
  if base_url is null or secret is null then
    return;
  end if;
  perform net.http_post(
    url := base_url || '/api/cron/google-sync',
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
end;
$$;

select cron.schedule('google-calendar-sync', '*/15 * * * *', 'select private.call_google_sync()');

select private.assert_rls_enabled();
