-- Diretoria de Marketing (Fase 4 - Trust Care)
-- Campanhas, Matriz de Ângulos de Anúncios e Métricas de Tráfego (Meta Ads).

-- 1. Campanhas de marketing estruturadas no tempo
create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete set null,
  name text not null,
  objective text not null default 'whatsapp_leads' check (
    objective in ('whatsapp_leads', 'brand_awareness', 'upgrades_maintenance', 'notebook_sales', 'custom')
  ),
  status text not null default 'draft' check (
    status in ('draft', 'scheduled', 'active', 'paused', 'completed', 'archived')
  ),
  budget_daily_cents bigint not null default 0 check (budget_daily_cents >= 0),
  budget_total_cents bigint not null default 0 check (budget_total_cents >= 0),
  start_date date not null,
  end_date date,
  target_audience text,
  meta_campaign_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 2. Matriz de Ângulos de Criativos e Comunicação
create table if not exists public.campaign_angles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  campaign_id uuid not null references public.marketing_campaigns (id) on delete cascade,
  title text not null,
  target_avatar text,
  hook_angle text not null default 'dor_urgencia' check (
    hook_angle in ('dor_urgencia', 'custo_beneficio', 'prova_social', 'autoridade_tecnica', 'oportunidade')
  ),
  headline text,
  body_copy text,
  call_to_action text,
  creative_format text not null default 'video_reel' check (
    creative_format in ('video_reel', 'carousel', 'single_image', 'story')
  ),
  asset_url text,
  meta_ad_id text,
  status text not null default 'draft' check (
    status in ('draft', 'testing', 'winner', 'paused', 'discarded')
  ),
  metrics_cached jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 3. Métricas consolidadas do Meta Ads (via MCP ou Graph API direta)
create table if not exists public.meta_ads_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  campaign_id uuid references public.marketing_campaigns (id) on delete set null,
  meta_campaign_id text not null,
  meta_ad_id text,
  date_reported date not null,
  spend_cents bigint not null default 0 check (spend_cents >= 0),
  impressions bigint not null default 0 check (impressions >= 0),
  clicks bigint not null default 0 check (clicks >= 0),
  ctr numeric(5,2) not null default 0 check (ctr >= 0),
  cpc_cents bigint not null default 0 check (cpc_cents >= 0),
  conversions bigint not null default 0 check (conversions >= 0),
  cost_per_conversion_cents bigint not null default 0 check (cost_per_conversion_cents >= 0),
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 4. Extensão de content_ideas com suporte a roteiros e conexão com ângulos
alter table public.content_ideas
  add column if not exists campaign_angle_id uuid references public.campaign_angles (id) on delete set null,
  add column if not exists script_data jsonb not null default '{}'::jsonb;

-- 5. Atualização da função seed para criar a pasta da Diretoria de Marketing
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
    (uid, a_tc, 'Diretoria de Marketing', 'marketing_director', 'megaphone', 6, '{}'),
    (uid, a_fin, 'Pessoal', 'finance', 'piggy-bank', 0, '{"ledger": "pessoal"}'),
    (uid, a_fin, 'Trust Care', 'finance', 'store', 1, '{"ledger": "trustcare"}');
end;
$$;

-- Criar pasta para áreas existentes da Trust Care caso ainda não exista
insert into public.folders (user_id, area_id, name, module, icon, sort_order, config)
select a.user_id, a.id, 'Diretoria de Marketing', 'marketing_director', 'megaphone', 6, '{}'::jsonb
from public.areas a
where a.slug = 'trustcare'
  and not exists (
    select 1 from public.folders f
    where f.area_id = a.id and f.module = 'marketing_director'
  );

-- 6. Índices para queries frequentes
create index if not exists marketing_campaigns_status_idx
  on public.marketing_campaigns (user_id, status)
  where deleted_at is null;

create index if not exists marketing_campaigns_dates_idx
  on public.marketing_campaigns (user_id, start_date, end_date)
  where deleted_at is null;

create index if not exists campaign_angles_campaign_idx
  on public.campaign_angles (campaign_id, status)
  where deleted_at is null;

create index if not exists meta_ads_metrics_campaign_date_idx
  on public.meta_ads_metrics (campaign_id, date_reported desc);

create index if not exists meta_ads_metrics_ad_date_idx
  on public.meta_ads_metrics (meta_ad_id, date_reported desc);

create index if not exists content_ideas_campaign_angle_idx
  on public.content_ideas (campaign_angle_id)
  where deleted_at is null;

-- 7. Segurança (RLS) e integridade de chaves estrangeiras
select private.apply_owner_policy('public.marketing_campaigns');
select private.apply_owner_policy('public.campaign_angles');
select private.apply_owner_policy('public.meta_ads_metrics');

select private.index_foreign_keys();
select private.assert_rls_enabled();
