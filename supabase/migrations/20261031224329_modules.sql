-- Tabelas de todos os módulos (Fases 2 a 6). As telas chegam fase a fase;
-- o modelo fica pronto desde já e pode ser ajustado com novas migrations.
-- Colunas "search": busca textual em português, ignorando acentos.

-- ---------------------------------------------------------------------------
-- Agenda (Fase 3) — vem antes de tasks porque tasks aponta para events
-- ---------------------------------------------------------------------------

-- Tokens do Google: só o servidor (service role) lê e escreve. Sem política para o navegador.
create table public.google_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  google_email text not null,
  refresh_token_enc text not null,
  access_token_enc text,
  expires_at timestamptz,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, google_email)
);

create table public.calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  connection_id uuid not null references public.google_connections (id) on delete cascade,
  google_calendar_id text not null,
  name text not null,
  color text,
  default_area_id uuid references public.areas (id) on delete set null,
  sync_enabled boolean not null default true,
  sync_token text,
  watch_channel_id text,
  watch_resource_id text,
  watch_expires_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, google_calendar_id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  calendar_id uuid references public.calendars (id) on delete cascade,
  google_event_id text,
  etag text,
  area_id uuid references public.areas (id) on delete set null,
  kind text not null default 'event' check (kind in ('event', 'task_block', 'routine')),
  title text not null,
  description text,
  location text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  recurrence text[],
  recurring_event_id text,
  status text not null default 'confirmed' check (status in ('confirmed', 'tentative', 'cancelled')),
  google_updated_at timestamptz,
  local_updated_at timestamptz not null default now(),
  search tsvector generated always as (
    to_tsvector('portuguese', public.immutable_unaccent(coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(location, '')))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (end_at >= start_at),
  unique (calendar_id, google_event_id)
);

create table public.sync_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  calendar_id uuid references public.calendars (id) on delete cascade,
  event_id uuid references public.events (id) on delete set null,
  direction text not null check (direction in ('google_to_app', 'app_to_google')),
  action text not null,
  conflict boolean not null default false,
  winner text check (winner in ('google', 'app')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Núcleo (Fase 2)
-- ---------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area_id uuid not null references public.areas (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete set null,
  title text not null check (char_length(title) between 1 and 300),
  notes text,
  -- 1 urgente · 2 alta · 3 normal · 4 baixa
  priority smallint not null default 3 check (priority between 1 and 4),
  status text not null default 'todo' check (status in ('todo', 'doing', 'waiting', 'done', 'canceled')),
  due_date date,
  start_time time,
  duration_min int check (duration_min > 0),
  recurrence_rule text,
  recurrence_parent_id uuid references public.tasks (id) on delete set null,
  completed_at timestamptz,
  event_id uuid references public.events (id) on delete set null,
  sort_order int not null default 0,
  search tsvector generated always as (
    to_tsvector('portuguese', public.immutable_unaccent(coalesce(title, '') || ' ' || coalesce(notes, '')))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content text not null,
  url text,
  source text not null default 'web' check (source in ('web', 'telegram')),
  status text not null default 'new' check (status in ('new', 'processed', 'archived')),
  converted_to_type text check (converted_to_type in ('task', 'note', 'idea', 'content_idea', 'learning_item')),
  converted_to_id uuid,
  ai_suggestion jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area_id uuid not null references public.areas (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete set null,
  title text not null default 'Sem título',
  content_json jsonb,
  content_md text,
  content_text text,
  tags text[] not null default '{}',
  pinned boolean not null default false,
  template text,
  search tsvector generated always as (
    to_tsvector('portuguese', public.immutable_unaccent(coalesce(title, '') || ' ' || coalesce(content_text, '')))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.note_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  from_note_id uuid not null references public.notes (id) on delete cascade,
  to_note_id uuid not null references public.notes (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (from_note_id, to_note_id)
);

create table public.learning_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area_id uuid not null references public.areas (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete set null,
  topic text not null,
  reason text,
  resources jsonb not null default '[]'::jsonb,
  status text not null default 'wishlist' check (status in ('wishlist', 'learning', 'paused', 'done')),
  progress smallint not null default 0 check (progress between 0 and 100),
  target_date date,
  note_id uuid references public.notes (id) on delete set null,
  search tsvector generated always as (
    to_tsvector('portuguese', public.immutable_unaccent(coalesce(topic, '') || ' ' || coalesce(reason, '')))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Banco de ideias gerais (aba Ideias), de qualquer área.
create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area_id uuid not null references public.areas (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete set null,
  title text not null,
  notes text,
  status text not null default 'loose' check (status in ('loose', 'maturing', 'project', 'discarded')),
  tags text[] not null default '{}',
  links jsonb not null default '[]'::jsonb,
  search tsvector generated always as (
    to_tsvector('portuguese', public.immutable_unaccent(coalesce(title, '') || ' ' || coalesce(notes, '')))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area_id uuid not null references public.areas (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete set null,
  name text not null,
  frequency text not null default 'daily' check (frequency in ('daily', 'weekdays', 'times_per_week')),
  -- 0 = domingo … 6 = sábado (usado quando frequency = 'weekdays')
  weekdays smallint[] not null default '{}',
  times_per_week smallint check (times_per_week between 1 and 7),
  preferred_time time,
  color text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  date date not null,
  done boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, date)
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Trust Care (Fase 4)
-- ---------------------------------------------------------------------------

create table public.shortcuts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete set null,
  title text not null,
  url text not null,
  icon text,
  description text,
  widget text check (widget in ('os_summary')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.content_pillars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  color text,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.content_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete set null,
  title text not null,
  format text check (format in ('reel', 'carousel', 'post', 'story')),
  pillar_id uuid references public.content_pillars (id) on delete set null,
  status text not null default 'idea' check (status in ('idea', 'developing', 'approved', 'discarded')),
  notes text,
  "references" jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  marketing_agent_ref text,
  search tsvector generated always as (
    to_tsvector('portuguese', public.immutable_unaccent(coalesce(title, '') || ' ' || coalesce(notes, '')))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.publications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content_idea_id uuid references public.content_ideas (id) on delete set null,
  channel text not null check (channel in ('instagram', 'google_business')),
  scheduled_for timestamptz,
  caption text,
  status text not null default 'idea' check (status in ('idea', 'script', 'production', 'scheduled', 'published')),
  published_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.service_flows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  steps jsonb not null default '[]'::jsonb,
  questions jsonb not null default '[]'::jsonb,
  info_to_collect jsonb not null default '[]'::jsonb,
  message_templates jsonb not null default '[]'::jsonb,
  objections jsonb not null default '[]'::jsonb,
  next_steps jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  search tsvector generated always as (
    to_tsvector('portuguese', public.immutable_unaccent(coalesce(name, '') || ' ' || coalesce(description, '')))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, slug)
);

create table public.reply_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  service_flow_id uuid references public.service_flows (id) on delete set null,
  detected_flow_id uuid references public.service_flows (id) on delete set null,
  label text,
  conversation_text text,
  screenshot_paths text[] not null default '{}',
  ai_output jsonb,
  chosen_reply text,
  outcome text not null default 'open' check (outcome in ('open', 'won', 'lost')),
  outcome_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Finanças (Fase 5) — valores sempre em centavos
-- ---------------------------------------------------------------------------

create table public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ledger text not null check (ledger in ('pessoal', 'trustcare')),
  kind text not null check (kind in ('income', 'expense')),
  name text not null,
  color text,
  parent_id uuid references public.finance_categories (id) on delete set null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  type text check (type in ('pix', 'credit', 'debit', 'cash', 'transfer', 'boleto', 'other')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notebooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  brand text,
  model text not null,
  specs text,
  status text not null default 'bought' check (status in ('bought', 'repair', 'for_sale', 'sold')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ledger text not null check (ledger in ('pessoal', 'trustcare')),
  kind text not null check (kind in ('income', 'expense')),
  amount_cents bigint not null check (amount_cents > 0),
  date date not null,
  category_id uuid references public.finance_categories (id) on delete set null,
  payment_method_id uuid references public.payment_methods (id) on delete set null,
  description text not null,
  notes text,
  notebook_id uuid references public.notebooks (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index transactions_ledger_date_idx on public.transactions (user_id, ledger, date) where deleted_at is null;

-- Lucro por notebook: tudo vem dos lançamentos ligados a ele.
-- Entradas = venda; saídas = compra + peças/reparo.
create view public.notebook_profit
with (security_invoker = true)
as
select
  n.id as notebook_id,
  n.user_id,
  n.brand,
  n.model,
  n.status,
  coalesce(sum(t.amount_cents) filter (where t.kind = 'income'), 0) as income_cents,
  coalesce(sum(t.amount_cents) filter (where t.kind = 'expense'), 0) as expense_cents,
  coalesce(sum(t.amount_cents) filter (where t.kind = 'income'), 0)
    - coalesce(sum(t.amount_cents) filter (where t.kind = 'expense'), 0) as profit_cents
from public.notebooks n
left join public.transactions t
  on t.notebook_id = n.id and t.deleted_at is null
where n.deleted_at is null
group by n.id;

revoke all on public.notebook_profit from anon;
grant select on public.notebook_profit to authenticated;

-- ---------------------------------------------------------------------------
-- Revisão semanal, busca com IA e Telegram (Fases 5 e 6)
-- ---------------------------------------------------------------------------

create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null,
  checklist jsonb not null default '{}'::jsonb,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

-- Trechos indexados para a busca por significado. Só recebe conteúdo de áreas com ai_enabled.
create table public.content_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  area_id uuid references public.areas (id) on delete cascade,
  chunk_index int not null default 0,
  content text not null,
  content_hash text not null,
  embedding extensions.vector(768),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id, chunk_index)
);

create index content_chunks_embedding_idx
  on public.content_chunks using hnsw (embedding extensions.vector_cosine_ops);

create table public.telegram_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  telegram_message_id bigint not null,
  chat_id bigint not null,
  payload jsonb not null,
  inbox_item_id uuid references public.inbox_items (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (chat_id, telegram_message_id)
);

-- ---------------------------------------------------------------------------
-- Segurança e índices
-- ---------------------------------------------------------------------------

select private.apply_owner_policy(t)
  from unnest(array[
    'public.calendars', 'public.events', 'public.sync_log',
    'public.tasks', 'public.inbox_items', 'public.notes', 'public.note_links',
    'public.learning_items', 'public.ideas', 'public.habits', 'public.habit_logs',
    'public.attachments', 'public.shortcuts', 'public.content_pillars',
    'public.content_ideas', 'public.publications', 'public.service_flows',
    'public.reply_cases', 'public.finance_categories', 'public.payment_methods',
    'public.notebooks', 'public.transactions', 'public.weekly_reviews',
    'public.content_chunks'
  ]::regclass[]) as t;

-- Tokens e mensagens do Telegram: só o servidor. RLS ligada e nenhum acesso pelo navegador.
alter table public.google_connections enable row level security;
alter table public.telegram_messages enable row level security;
revoke all on public.google_connections, public.telegram_messages from anon, authenticated;
create index google_connections_user_id_idx on public.google_connections (user_id);
create index telegram_messages_user_id_idx on public.telegram_messages (user_id);
create trigger set_updated_at before update on public.google_connections
  for each row execute function private.set_updated_at();

-- Busca textual
create index tasks_search_idx on public.tasks using gin (search);
create index notes_search_idx on public.notes using gin (search);
create index ideas_search_idx on public.ideas using gin (search);
create index learning_items_search_idx on public.learning_items using gin (search);
create index content_ideas_search_idx on public.content_ideas using gin (search);
create index service_flows_search_idx on public.service_flows using gin (search);
create index events_search_idx on public.events using gin (search);

-- Consultas mais comuns
create index tasks_due_idx on public.tasks (user_id, due_date) where deleted_at is null and status not in ('done', 'canceled');
create index events_range_idx on public.events (user_id, start_at, end_at) where deleted_at is null;
create index inbox_items_open_idx on public.inbox_items (user_id, created_at desc) where status = 'new' and deleted_at is null;

select private.index_foreign_keys();
select private.assert_rls_enabled();
