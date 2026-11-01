-- Busca textual da Fase 2 (Ctrl+K): tarefas, notas, ideias, aprendizados e Caixa de Entrada.
-- Cada palavra digitada vira um prefixo ("reun" acha "reunião"), sem diferenciar acentos.
-- security invoker: roda com as permissões de quem chama, então o RLS continua valendo.

create or replace function public.search_all(q text, max_results int default 20)
returns table (
  kind text,
  id uuid,
  title text,
  snippet text,
  area_id uuid,
  folder_id uuid,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with words as (
    select w
      from regexp_split_to_table(public.immutable_unaccent(lower(coalesce(q, ''))), '[^a-z0-9]+') as w
     where w <> ''
  ),
  query as (
    select
      (select to_tsquery('portuguese', string_agg(w || ':*', ' & ')) from words) as tsq,
      '%' || replace(replace(public.immutable_unaccent(lower(trim(coalesce(q, '')))), '%', ''), '_', '') || '%' as pattern
  ),
  hits as (
    select 'task'::text as kind, t.id, t.title, left(coalesce(t.notes, ''), 160) as snippet,
           t.area_id, t.folder_id, t.updated_at, ts_rank(t.search, query.tsq) as rank
      from public.tasks t, query
     where t.deleted_at is null
       and (t.search @@ query.tsq or public.immutable_unaccent(lower(t.title)) like query.pattern)
    union all
    select 'note', n.id, n.title, left(coalesce(n.content_text, ''), 160),
           n.area_id, n.folder_id, n.updated_at, ts_rank(n.search, query.tsq)
      from public.notes n, query
     where n.deleted_at is null
       and (n.search @@ query.tsq or public.immutable_unaccent(lower(n.title)) like query.pattern)
    union all
    select 'idea', i.id, i.title, left(coalesce(i.notes, ''), 160),
           i.area_id, i.folder_id, i.updated_at, ts_rank(i.search, query.tsq)
      from public.ideas i, query
     where i.deleted_at is null
       and (i.search @@ query.tsq or public.immutable_unaccent(lower(i.title)) like query.pattern)
    union all
    select 'learning', l.id, l.topic, left(coalesce(l.reason, ''), 160),
           l.area_id, l.folder_id, l.updated_at, ts_rank(l.search, query.tsq)
      from public.learning_items l, query
     where l.deleted_at is null
       and (l.search @@ query.tsq or public.immutable_unaccent(lower(l.topic)) like query.pattern)
    union all
    select 'inbox', b.id, left(b.content, 120), null,
           null, null, b.updated_at, 0
      from public.inbox_items b, query
     where b.deleted_at is null and b.status = 'new'
       and public.immutable_unaccent(lower(b.content)) like query.pattern
  )
  select kind, id, title, snippet, area_id, folder_id, updated_at
    from hits
   order by rank desc, updated_at desc
   limit least(greatest(max_results, 1), 50);
$$;

grant execute on function public.search_all(text, int) to authenticated;
grant execute on function public.immutable_unaccent(text) to authenticated;

select private.assert_rls_enabled();
