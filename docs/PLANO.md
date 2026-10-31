# Segundo Cérebro: proposta inicial (antes de qualquer código)

> Status: **aguardando aprovação do Luan**. Nada foi instalado nem criado ainda.
> Fonte: `prompt-segundo-cerebro.md`.

---

## 1. Decisões técnicas importantes (explicadas de forma simples)

| Decisão | O que significa na prática | Por quê |
|---|---|---|
| **Login fechado em 3 camadas** | (1) No Supabase, depois que sua conta existir, desligamos "novos cadastros". (2) O app confere se o e-mail está em `ALLOWED_EMAILS` a cada acesso. (3) Cada linha do banco tem um "dono" (`user_id`) e o banco só entrega linhas suas (RLS). | Se uma camada falhar, as outras seguram. |
| **Google Agenda conectado à parte do login** | O login com Google serve só para entrar. A Agenda tem um botão próprio "Conectar Google Agenda", que gera uma chave de acesso permanente (*refresh token*). Essa chave fica **criptografada** numa tabela que só o servidor lê; o navegador nunca a vê. | O Supabase Auth não guarda essa chave de forma reutilizável, e assim ela fica fora do alcance do front. |
| **Tarefas agendadas pelo Supabase (`pg_cron`), não pela Vercel** | Renovar os canais de aviso do Google e fazer a sincronização de segurança são tarefas que rodam sozinhas, a cada 15–30 min. | No plano gratuito (Hobby) da Vercel, o cron só roda **1 vez por dia** e sem horário preciso. Vou reconfirmar esse limite na Fase 3, mas como usaremos o `pg_cron` de qualquer forma, isso não muda o plano. |
| **IA com "trava por área"** | Cada área tem um interruptor "pode ir para a IA?". Profissional nasce **desligado** e o app bloqueia no servidor (não só esconde o botão). | LGPD e termos do Gemini gratuito. |
| **Busca com IA também respeita a trava** | Para buscar "por significado", o texto precisa ser enviado ao Google para virar números (*embeddings*). Por isso, conteúdo de área travada **nem é indexado**. Ele continua aparecendo na busca textual normal, que roda só no seu banco. | Mandar para gerar embedding também é mandar para o Google. |
| **Embeddings com 768 dimensões** | Detalhe técnico: o modelo `gemini-embedding-001` permite reduzir o tamanho do vetor. | O índice rápido do pgvector aceita até 2000 dimensões, e 768 é mais leve e quase tão preciso. |
| **Editor de notas: BlockNote** | Editor no estilo Notion: menu com `/`, arrastar blocos, `[[` para linkar notas. Salvamos o conteúdo do editor **e** uma cópia em Markdown/texto (para busca, IA e exportação). | Dá a experiência que você quer com menos código que o Tiptap puro. |
| **"Lixeira" em vez de apagar de verdade** | Excluir marca o item como apagado (`deleted_at`) e ele some da tela. Dá para restaurar. | Segurança contra exclusões acidentais. |
| **Valores em centavos** | R$ 1.250,90 é guardado como `125090`. | Evita erros de arredondamento em finanças. |
| **Fuso `America/Cuiaba`** | Todas as datas são exibidas no horário de Cuiabá (UTC-4). | — |
| **Atenção ao plano gratuito do Supabase** | O plano Free permite **2 projetos ativos por pessoa**, somando todas as organizações em que você é dono/admin (projetos pausados não contam). Ele também **pausa** um projeto após ~7 dias sem uso. | Hoje os 2 projetos ativos já estão em uso ("Trust Care" e "Marketing Trust Care"); ver seção 5. Com uso diário e os webhooks do Telegram/Google, o projeto não fica parado. |

---

## 2. Modelo de dados

Convenções de todas as tabelas (não repetidas abaixo): `id uuid`, `user_id uuid` (dono, padrão `auth.uid()`), `created_at`, `updated_at`, `deleted_at` (lixeira). RLS ativa em **todas**, com a regra `user_id = auth.uid()`. Nomes de tabelas em inglês (padrão de código); a interface fica toda em português.

### 2.1 Base

| Tabela | Para que serve | Campos principais |
|---|---|---|
| `profiles` | Suas preferências | `display_name`, `timezone`, `theme`, `settings jsonb` |
| `areas` | As 4 áreas | `slug` (profissional/pessoal/trustcare/financas), `name`, `color`, `icon`, `sort_order`, **`ai_enabled`**, `show_lgpd_notice` |
| `folders` | A árvore da barra lateral | `area_id`, `parent_id` (subpastas), `name`, `module`, `sort_order`, `icon`, `collapsed` |
| `attachments` | Arquivos no Storage | `entity_type`, `entity_id`, `storage_path`, `file_name`, `mime_type`, `size_bytes` |

**Como a árvore funciona:** cada pasta tem um `module` que define o que ela mostra (`tasks`, `notes`, `meetings`, `routine`, `learning`, `shortcuts`, `content_ideas`, `publications`, `service_flows`, `reply_assistant`, `finance`). Ex.: "Profissional › Demandas" é uma pasta `tasks` da área Profissional. Você pode criar "Profissional › Demandas › Projeto X" e ela herda o módulo.

**Abas × barra lateral:** as abas do topo (Hoje, Agenda…) mostram **tudo**. Clicar numa área/pasta na lateral **filtra** a aba. Pastas que não têm aba própria (Atalhos, Fluxos, Assistente) abrem sua própria tela.

### 2.2 Núcleo (Fase 2)

| Tabela | Campos principais |
|---|---|
| `tasks` | `area_id`, `folder_id`, `title`, `notes`, `priority` (1–4), `status` (a_fazer/fazendo/aguardando/feito/cancelado), `due_date`, `start_time`, `duration_min`, `recurrence_rule` (RRULE), `recurrence_parent_id`, `completed_at`, `event_id` (bloco na agenda), `sort_order` |
| `inbox_items` | `content`, `url`, `source` (web/telegram), `status` (nova/processada/arquivada), `converted_to_type`, `converted_to_id`, `ai_suggestion jsonb` |
| `notes` | `area_id`, `folder_id`, `title`, `content_json` (editor), `content_md`, `content_text`, `tags text[]`, `pinned`, `template` (ex.: "reunião"), busca `tsvector` em português |
| `note_links` | `from_note_id`, `to_note_id` (links `[[...]]` → mostra "quem aponta para esta nota") |
| `learning_items` | `area_id`, `folder_id`, `topic`, `reason`, `resources jsonb` [{título, link}], `status` (quero/aprendendo/pausado/concluído), `progress` 0–100, `target_date`, `note_id` (quando vira nota) |
| `ideas` | Banco de **ideias gerais** (aba Ideias), de qualquer área: `area_id`, `folder_id`, `title`, `notes`, `status` (solta/amadurecendo/virou projeto/descartada), `tags`, `links jsonb` |
| `habits` | Hábitos da Rotina: `area_id`, `folder_id`, `name`, `frequency` (todo dia / dias da semana / X vezes por semana), `weekdays int[]`, `times_per_week`, `preferred_time` (opcional), `color`, `active` |
| `habit_logs` | Uma marcação por hábito por dia: `habit_id`, `date`, `done`, `note` (único por hábito + dia) |

Recorrência de tarefa: ao concluir uma tarefa recorrente, o sistema cria a próxima ocorrência.

Hábitos: aparecem como checklist na aba **Hoje** e na pasta **Pessoal › Rotina**, com sequência atual ("7 dias seguidos") e um mapa de calor do mês. Se o hábito tiver horário, poderá virar um bloco na agenda na Fase 3.

### 2.3 Agenda (Fase 3)

| Tabela | Campos principais |
|---|---|
| `google_connections` | `google_email`, `refresh_token_enc`, `access_token_enc`, `expires_at`, `scopes`. **Sem acesso pelo navegador**; só o servidor lê. |
| `calendars` | `connection_id`, `google_calendar_id`, `name`, `color`, `default_area_id`, `sync_enabled`, `sync_token`, `watch_channel_id`, `watch_resource_id`, `watch_expires_at` |
| `events` | `calendar_id`, `google_event_id`, `etag`, `area_id`, `kind` (evento/bloco_tarefa/rotina), `task_id`, `title`, `description`, `location`, `start_at`, `end_at`, `all_day`, `recurrence text[]`, `recurring_event_id`, `google_updated_at`, `local_updated_at` |
| `sync_log` | `calendar_id`, `direction` (google→app / app→google), `action`, `event_id`, `conflict`, `winner`, `details jsonb` |

Rotinas = eventos recorrentes com `kind = rotina`.

**Duas contas Google:** `google_connections` aceita mais de uma conta. A ideia é conectar a pessoal (Gmail) e a da SES (`@ses.mt.gov.br`, Google Workspace). Os eventos da agenda da SES caem automaticamente na área **Profissional**, ficando travados para a IA. Ponto de atenção: a SES pode ter bloqueado o acesso de apps externos às contas institucionais. Isso só dá para saber testando na Fase 3. Se estiver bloqueado, o plano B é compartilhar a agenda da SES com o seu Gmail (se a política da SES permitir) ou deixar a agenda da SES só no Google.

### 2.4 Trust Care (Fase 4)

| Tabela | Campos principais |
|---|---|
| `shortcuts` | `folder_id`, `title`, `url`, `icon`, `description`, `widget` (ex.: `os_summary`), `sort_order` |
| `content_ideas` | Separado das ideias gerais: `title`, `format` (reel/carrossel/post/story), `pillar_id`, `status` (ideia/desenvolvendo/aprovada/descartada), `notes`, `references jsonb`, `tags`, `marketing_agent_ref` |
| `content_pillars` | `name`, `color`, `description` |
| `publications` | `content_idea_id`, `channel` (instagram/google_meu_negocio), `scheduled_for`, `caption`, `status` (ideia→roteiro→produção→agendado→publicado), `published_url`, `notes` |
| `service_flows` | `name`, `slug`, `description`, `steps jsonb`, `questions jsonb`, `info_to_collect jsonb`, `message_templates jsonb`, `objections jsonb`, `next_steps jsonb`, `active` |
| `reply_cases` | `service_flow_id`, `detected_flow_id`, `label` (apelido do caso), `conversation_text`, `screenshot_paths`, `ai_output jsonb` (opções, próximo passo, o que falta perguntar), `chosen_reply`, `outcome` (em andamento/fechou/não fechou), `outcome_notes` |

**Assistente de Respostas e LGPD:** o assistente não envia nada para o cliente; ele só sugere. Mas, para sugerir, o texto colado vai para o Gemini. Por isso, antes de enviar, o app **mascara automaticamente** telefones, e-mails, CPF e endereços (ex.: `(65) 9xxxx-1234` vira `[TELEFONE]`) e mostra um aviso curto. O texto original fica salvo só no seu banco.

### 2.5 Finanças (Fase 5)

| Tabela | Campos principais |
|---|---|
| `finance_categories` | `ledger` (pessoal/trustcare), `kind` (entrada/saída), `name`, `color`, `parent_id` |
| `payment_methods` | `name` (Pix, crédito Nubank, dinheiro…), `type` |
| `transactions` | `ledger`, `kind`, `amount_cents`, `date`, `category_id`, `payment_method_id`, `description`, `notes`, `notebook_id` (opcional) |
| `notebooks` | `brand`, `model`, `specs`, `status` (comprado/em reparo/à venda/vendido), `notes` |

**Lucro por notebook:** a compra, as peças e a venda são lançamentos normais em `transactions` ligados ao notebook. O lucro é calculado (venda − compra − peças) por uma *view* `notebook_profit`. Assim, o caixa da Trust Care e o lucro por aparelho usam os mesmos lançamentos, sem digitar duas vezes.

### 2.6 Revisão e busca (Fases 5 e 6)

| Tabela | Campos principais |
|---|---|
| `weekly_reviews` | `week_start`, `checklist jsonb`, `notes`, `completed_at` |
| `content_chunks` | `entity_type`, `entity_id`, `area_id`, `chunk_index`, `content`, `content_hash`, `embedding vector(768)` (índice HNSW) |
| `telegram_messages` (log) | `telegram_message_id`, `chat_id`, `payload jsonb`, `inbox_item_id` |

Busca textual: uma função `search_all(q)` no banco que procura em tarefas, notas, ideias, fluxos e eventos (português, ignorando acentos).

### 2.7 Diagrama das relações principais

```
areas ─┬─< folders (árvore, parent_id)
       ├─< tasks ──── events (bloco de tempo) >── calendars >── google_connections
       ├─< notes ──< note_links
       ├─< learning_items ── notes (quando concluído)
       ├─< ideas (gerais)
       ├─< habits ──< habit_logs
       └─< content_chunks (só áreas com ai_enabled)

content_ideas ──< publications
      └── content_pillars

inbox_items ──(converte em)──> tasks | notes | ideas | content_ideas | learning_items
service_flows ──< reply_cases
transactions >── finance_categories, payment_methods, notebooks
attachments ──(qualquer entidade)
```

---

## 3. Estrutura de pastas do projeto

```
segundo-cerebro/
├─ app/
│  ├─ (auth)/login/            tela de login
│  ├─ auth/callback/           retorno do login
│  ├─ (app)/                   tudo que exige login
│  │  ├─ layout.tsx            barra superior (abas + Ctrl+K) e árvore lateral
│  │  ├─ hoje/  agenda/  entrada/  ideias/  conhecimento/
│  │  ├─ aprender/  financas/  revisao/  configuracoes/
│  │  └─ p/[folderId]/         telas das pastas sem aba própria (Atalhos, Fluxos…)
│  └─ api/
│     ├─ google/               conectar agenda + webhook de avisos
│     ├─ telegram/webhook/
│     ├─ cron/                 chamado pelo pg_cron (protegido por segredo)
│     └─ ai/                   classificar, responder, perguntar
├─ components/
│  ├─ ui/                      componentes do shadcn
│  ├─ layout/                  abas, árvore, busca, troca de tema
│  └─ tasks/ notes/ calendar/ finance/ trustcare/ …
├─ lib/
│  ├─ supabase/                client (navegador), server, admin (só servidor)
│  ├─ ai/                      interface do provedor + gemini.ts + trava por área
│  ├─ integrations/
│  │  ├─ google-calendar/
│  │  ├─ telegram/
│  │  ├─ marketing-agent/      types.ts (interface) + mock.ts
│  │  └─ os-manager/           cliente Supabase somente-leitura
│  ├─ crypto.ts                criptografia dos tokens
│  └─ utils/                   datas (Cuiabá), dinheiro (centavos ↔ R$)
├─ supabase/
│  ├─ migrations/              criação das tabelas, versionada
│  └─ seed.sql                 áreas e pastas padrão
├─ public/                     ícones e manifest do PWA
├─ docs/PLANO.md               este arquivo
├─ .env.example
└─ README.md
```

---

## 4. Plano da Fase 1: Fundação

Cada item = 1 commit. Ao fim, o app está no ar na Vercel com login funcionando.

1. **Projeto base**: Next.js (versão estável atual) + TypeScript + Tailwind + shadcn/ui, `git init`, `.gitignore`, `.env.example`, README inicial.
2. **Supabase conectado**: clientes `client/server/admin`, proteção de rotas (só entra logado).
3. **Login**: Google + link mágico por e-mail, checagem de `ALLOWED_EMAILS`, tela "acesso negado" para outros e-mails.
4. **Banco**: migrations com **todas as tabelas** da seção 2 + RLS + índices, mais uma checagem automática que falha se alguma tabela ficar sem RLS. (As fases seguintes podem ajustar com novas migrations.)
5. **Seed**: as 4 áreas com cores padrão e a árvore de pastas do prompt.
6. **Layout**: barra superior com as 8 abas, botão/atalho `Ctrl+K` (na Fase 1 ele só navega entre telas e pastas), árvore lateral recolhível com criar, renomear, reordenar (arrastar) e subpastas.
7. **Tema e cores**: claro/escuro/sistema, tela Configurações para mudar a cor de cada área e o interruptor de IA por área.
8. **Aviso LGPD**: componente discreto pronto para os formulários da área Profissional.
9. **Deploy**: GitHub + Vercel, variáveis configuradas, README com o passo a passo.

**O que você vai testar ao final da Fase 1**
- Entrar com o seu e-mail (Google e link mágico) → funciona.
- Tentar entrar com outro e-mail → bloqueado.
- Criar, renomear, mover e apagar pastas na lateral; recarregar a página e ver que ficou salvo.
- Trocar tema claro/escuro e a cor de uma área.
- Abrir pelo celular a URL da Vercel e ver o layout se adaptar.

---

## 5. Respostas do Luan (2026-10-31)

| Tema | Decisão |
|---|---|
| Login | Só o Gmail pessoal entra no sistema. A conta `@ses.mt.gov.br` serve apenas para conectar a agenda da SES (Fase 3). |
| Agenda | Duas contas Google conectadas (pessoal + SES). Eventos da SES vão para a área Profissional. |
| Assistente de Respostas | Só auxilia (sugere respostas, entende o problema, guia o fluxo). Não envia mensagens. Mascaramento automático de dados pessoais antes de ir ao Gemini. |
| Finanças × IA | Nasce **travada** (como Profissional). Dá para liberar depois em Configurações. |
| Ideias | Duas coisas separadas: banco de ideias gerais (aba Ideias) e ideias de conteúdo da Trust Care. |
| Rotina | Hábitos marcados como feitos a cada dia (`habits` + `habit_logs`), entra na Fase 2. |
| Hospedagem | GitHub e Vercel já existem; endereço gratuito `*.vercel.app`. |
| Assistente × LGPD | Aprovado: mascaramento automático de telefone, e-mail, CPF e endereço antes de enviar ao Gemini. |
| Gerenciador de O.S. | É o projeto Supabase **"Trust Care"** (ref `dbxdqolktavqngrxknum`, sa-east-1). Precisa continuar ativo. |
| Supabase | Os 2 projetos gratuitos ativos estavam ocupados ("Trust Care" = O.S., "Marketing Trust Care"). **"Marketing Trust Care" pausado em 2026-10-31**, depois de exportar a tabela `settings` para CSV. O projeto do Segundo Cérebro usa a vaga liberada. |

### Agente de Marketing: o que foi encontrado (2026-10-31)

- Código em `C:\Users\luan_\OneDrive\Documentos\mkt_trustcare` (GitHub `lsp3037/Marketing-Trust-Care`). É um painel React + Vite que roda **só no PC** (`localhost:8007`), sem deploy.
- O Supabase é **opcional** nele: usa uma única tabela, `settings` (uma linha), para sincronizar configurações. Sem Storage, sem Edge Functions, sem login. Sem Supabase, ele grava tudo no `localStorage` do navegador.
- Por isso, **não vale a pena** montar um Supabase local no Docker só para isso (2 a 3 GB de RAM para guardar uma linha). Basta exportar a tabela `settings` e pausar o projeto.
- **Impacto na Fase 4:** o Agente **não tem API**. O adaptador `lib/integrations/marketing-agent` fica com o mock até decidirmos. Como o painel roda no PC e o Segundo Cérebro roda na internet, o caminho natural é o inverso: **o painel chama a API do Segundo Cérebro** (localhost → Vercel funciona; Vercel → localhost não).
- O painel também tem um **Planejador de Conteúdo do Instagram (30 dias)**, que se sobrepõe ao Planejamento de Publicações do Segundo Cérebro. Decidir na Fase 4 qual dos dois fica como principal.
