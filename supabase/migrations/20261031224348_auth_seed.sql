-- Login fechado (camada do banco) e dados iniciais de cada usuário.

-- Lista de e-mails que podem criar conta. Fica no schema privado: o navegador não enxerga.
-- Os e-mails NÃO ficam neste arquivo; são inseridos à parte (ver README).
create table private.allowed_emails (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

-- Bloqueia qualquer cadastro com e-mail fora da lista.
create or replace function private.enforce_allowed_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null
     or not exists (select 1 from private.allowed_emails where email = lower(new.email)) then
    raise exception 'E-mail não autorizado' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger enforce_allowed_email
  before insert on auth.users
  for each row execute function private.enforce_allowed_email();

-- Cria perfil, áreas e a árvore de pastas padrão para um usuário.
create or replace function private.seed_user(uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a_prof uuid;
  a_pess uuid;
  a_tc uuid;
  a_fin uuid;
begin
  insert into public.profiles (user_id) values (uid) on conflict do nothing;

  if exists (select 1 from public.areas where user_id = uid) then
    return;
  end if;

  insert into public.areas (user_id, slug, name, color, icon, sort_order, ai_enabled, show_lgpd_notice)
  values (uid, 'profissional', 'Profissional', '#2563EB', 'briefcase', 0, false, true)
  returning id into a_prof;

  insert into public.areas (user_id, slug, name, color, icon, sort_order)
  values (uid, 'pessoal', 'Pessoal', '#7C3AED', 'user', 1)
  returning id into a_pess;

  insert into public.areas (user_id, slug, name, color, icon, sort_order)
  values (uid, 'trustcare', 'Trust Care', '#EA580C', 'wrench', 2)
  returning id into a_tc;

  insert into public.areas (user_id, slug, name, color, icon, sort_order, ai_enabled)
  values (uid, 'financas', 'Finanças', '#059669', 'wallet', 3, false)
  returning id into a_fin;

  insert into public.folders (user_id, area_id, name, module, icon, sort_order, config) values
    (uid, a_prof, 'Demandas', 'tasks', 'list-checks', 0, '{}'),
    (uid, a_prof, 'Reuniões', 'meetings', 'users', 1, '{}'),
    (uid, a_pess, 'Demandas', 'tasks', 'list-checks', 0, '{}'),
    (uid, a_pess, 'Rotina', 'routine', 'repeat', 1, '{}'),
    (uid, a_pess, 'Coisas a aprender', 'learning', 'graduation-cap', 2, '{}'),
    (uid, a_tc, 'Atalhos', 'shortcuts', 'link', 0, '{}'),
    (uid, a_tc, 'Ideias de Conteúdo', 'content_ideas', 'lightbulb', 1, '{}'),
    (uid, a_tc, 'Planejamento de Publicações', 'publications', 'calendar-range', 2, '{}'),
    (uid, a_tc, 'Repositório da Empresa', 'notes', 'library', 3, '{}'),
    (uid, a_tc, 'Fluxos de Atendimento', 'service_flows', 'workflow', 4, '{}'),
    (uid, a_tc, 'Assistente de Respostas', 'reply_assistant', 'message-square-text', 5, '{}'),
    (uid, a_fin, 'Pessoal', 'finance', 'piggy-bank', 0, '{"ledger": "pessoal"}'),
    (uid, a_fin, 'Trust Care', 'finance', 'store', 1, '{"ledger": "trustcare"}');
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.seed_user(new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Storage: bucket privado de anexos. Cada arquivo fica em <user_id>/...
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 52428800)
on conflict (id) do nothing;

create policy "dono lê anexos" on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "dono envia anexos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "dono altera anexos" on storage.objects
  for update to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "dono apaga anexos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

select private.assert_rls_enabled();
