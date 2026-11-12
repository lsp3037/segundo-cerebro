# Segundo Cérebro: plano técnico e diário de decisões

> Status (2026-11-12): **Fases 1 a 5 concluídas**; Fase 6 (Extras: Telegram, PWA e Busca com IA) a seguir. As seções 1 a 4 são a proposta inicial (com estrutura de pastas e modelo de dados atualizados conforme as entregas); as seções 5 em diante registram respostas e entregas.
> Fonte: [`especificacao-original.md`](especificacao-original.md). O "o quê" e o "porquê" estão no [`PRD.md`](PRD.md); o dia a dia, no [`OPERACAO.md`](OPERACAO.md).

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

### 2.5 Finanças (Fase 5 + Minhas Finanças)

| Tabela | Campos principais |
|---|---|
| `finance_categories` | `ledger` (pessoal/trustcare), `kind` (entrada/saída), `name`, `color`, `parent_id` |
| `payment_methods` | `name` (Pix, crédito Nubank, dinheiro…), `type` |
| `finance_accounts` | `name`, `kind` (checking/savings/cash/credit_card), `ledger`, `balance_cents`, `credit_limit_cents`, `closing_day`, `due_day`, `color`, `is_active` |
| `finance_recurring_bills` | `name`, `ledger`, `kind`, `amount_cents`, `percentage_of_income` (ex.: `10%` Dízimo), `due_day`, `category_id`, `account_id`, `member_label` (Casa/Luan/Rayzza), `active` |
| `finance_budgets` | `category_id`, `ledger`, `month` (YYYY-MM), `limit_cents`, `member_label` |
| `finance_rules` | `pattern`, `ledger`, `kind`, `category_id`, `account_id`, `member_label` (regras aprendidas pelo importador OFX) |
| `transactions` | `ledger`, `kind`, `amount_cents`, `date`, `status` (paid/pending), `due_date`, `paid_at`, `category_id`, `payment_method_id`, `account_id`, `member_label`, `recurring_bill_id`, `installment_group_id`, `installment_index`, `installment_total`, `bank_fitid`, `description`, `notes`, `notebook_id` (opcional) |
| `notebooks` | `brand`, `model`, `specs`, `status` (comprado/em reparo/à venda/vendido), `asking_price_cents`, `buyer_name`, `buyer_contact`, `warranty_days`, `sold_at`, `machine_fee_cents`, `notes` |

**Lucro por notebook:** a compra, as peças, eventuais custos pós-venda (garantia) e a venda (descontando taxa de maquininha) são lançamentos ligados ao notebook em `transactions` / `notebooks`. O lucro real e o de vitrine são calculados diretamente a partir dos mesmos dados, sem redigitação.

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

> Atualizada em 2026-11-12 para refletir o código real das Fases 1 a 5. Diferenças em relação à proposta inicial: o Gerenciador de O.S. é lido pela **API dele** (não por um cliente Supabase), a integração com o Google ficou em `lib/google/`, as áreas e pastas padrão são criadas por gatilho na migration `auth_seed` (não há `seed.sql`), e a IA é chamada por Server Actions (não há `api/ai`). As pastas do Telegram e do PWA chegam na Fase 6.

```
segundo-cerebro/
├─ app/
│  ├─ (auth)/login/            tela de login
│  ├─ auth/callback/           retorno do login
│  ├─ acesso-negado/           e-mail fora da lista
│  ├─ (legal)/privacidade/ termos/   páginas públicas exigidas pelo Google
│  ├─ (app)/                   tudo que exige login
│  │  ├─ layout.tsx            shell (topbar + sidebar retrátil + Ctrl+K)
│  │  ├─ hoje/  agenda/  entrada/  ideias/  conhecimento/  aprender/
│  │  ├─ marketing/            Diretoria de Marketing (conteúdo, campanhas, Meta Ads)
│  │  ├─ financas/  revisao/   Finanças (Minhas Finanças + Trust Care) e Revisão Semanal
│  │  ├─ configuracoes/        áreas, trava de IA, lixeira, Google Agenda
│  │  └─ p/[folderId]/         telas das pastas (Atalhos, Fluxos, Publicações…)
│  └─ api/
│     ├─ google/connect|callback|webhook/   conectar a agenda e receber avisos
│     ├─ cron/google-sync/     chamado pelo pg_cron (protegido por segredo)
│     └─ arquivos/[...path]/   entrega anexos privados do Storage
├─ components/
│  ├─ ui/                      componentes do shadcn
│  ├─ app-shell/               barra superior com botão retrátil, árvore lateral e Ctrl+K
│  ├─ tasks/ habits/ inbox/ notes/ learning/ ideas/ agenda/
│  ├─ marketing/               planejador de conteúdo, matriz de ângulos e Meta Ads
│  ├─ finance/                 cockpit Minhas Finanças, notebooks, orçamentos, relatórios e OFX
│  ├─ review/                  checklist guiado de revisão semanal
│  └─ trustcare/               atalhos, conteúdo, publicações, fluxos, assistente
├─ lib/
│  ├─ supabase/                client (navegador), server, admin (só servidor), tipos
│  ├─ actions/                 Server Actions (gravam no banco)
│  ├─ data/                    leituras do banco
│  ├─ ai/                      interface do provedor + gemini.ts + trava por área
│  ├─ finance/                 motor OFX, regras, cálculos familiares e diagnóstico local
│  ├─ motion/                  animações sob demanda (ui-generation)
│  ├─ google/                  API do Calendar, sincronização, criptografia dos tokens
│  ├─ integrations/
│  │  ├─ os-manager.ts         resumo das O.S. pela API do Gerenciador (só leitura)
│  │  └─ marketing-agent/      interface + mock (API real na Fase 6)
│  ├─ mask.ts                  máscara de dados pessoais antes da IA
│  ├─ service-flows.ts         formato e fluxos de atendimento sugeridos
│  └─ dates.ts recurrence.ts events-expand.ts …   datas em Cuiabá e repetições
├─ supabase/migrations/        banco versionado (tabelas, RLS, seed por usuário, cron)
├─ scripts/set-vault.mjs       grava app_url e cron_secret no Vault do Supabase
├─ docs/                       PRD, plano, operação, ADRs e especificação original
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

---

## 6. Fase 1 concluída (2026-10-31)

- Produção: https://segundo-cerebro-one-omega.vercel.app (Vercel, funções em `gru1`). Repositório privado: `lsp3037/segundo-cerebro`.
- Supabase "Segundo Cerebro" (`ynbxqftfhbpgnqdiqqlk`, sa-east-1): 29 tabelas com RLS, seed por usuário, bucket privado `attachments`.
- Login: link mágico e Google (ligados à mesma conta), novos cadastros desligados, `ALLOWED_EMAILS` + `private.allowed_emails`.
- Desenvolvimento local na porta **3333** (a 3000 é de outro projeto).
- Decisões tomadas durante a fase: Next.js 16 com `cacheComponents` desligado (conteúdo é todo pessoal e dinâmico); `proxy.ts` no lugar do antigo middleware; migrations aplicadas pelo Supabase e versionadas em `supabase/migrations/`.
- Testado pelo Luan: login (PC e Vercel), árvore de pastas (criar, renomear, arrastar, mover, excluir e restaurar), tema, cores e Ctrl+K.

## 7. Fase 2 concluída (2026-11-01)

- **Tarefas:** visões Hoje, Semana, Mês, Lista e Kanban; atrasadas em destaque; repetição (RRULE simples) que cria a próxima ocorrência ao concluir; painel lateral de edição.
- **Hábitos:** diário, dias da semana ou X vezes por semana; checklist na aba Hoje; sequência e mapa do mês na pasta Rotina.
- **Caixa de Entrada:** captura por botão, `Alt+N` ou `Ctrl+K`; organizar em tarefa, nota, ideia, ideia de conteúdo ou aprendizado.
- **Conhecimento:** editor BlockNote em português (`/` blocos, `@` link para outra nota), anexos no bucket privado via `/api/arquivos/...`, notas que apontam para esta, tags, modelo de reunião.
- **Aprender e Ideias gerais**, e as pastas mostrando o próprio conteúdo (com subpastas).
- **Busca `Ctrl+K`** no conteúdo (`public.search_all`).
- **IA:** camada `lib/ai` (Gemini via `@google/genai`) com trava por área; o botão "Sugerir com IA" da Caixa de Entrada fica ativo quando `GEMINI_API_KEY` e `GEMINI_MODEL` estiverem configurados.
- "Sair" agora desconecta só o navegador atual.

## 8. Fase 3 concluída (2026-11-01)

- **Agenda:** visões dia, semana e mês; criar, editar e apagar eventos (inclusive repetidos); tarefas com horário viram blocos na agenda ("Bloquear na agenda").
- **Duas contas Google conectadas:** Gmail pessoal (6 agendas ligadas) e `@ses.mt.gov.br` (agenda principal na área Profissional). A SES **não** bloqueou o acesso, então o plano B não foi necessário.
- **Sincronização:** aviso instantâneo do Google (`/api/google/webhook`, canais de 7 dias renovados sozinhos) + rotina do `pg_cron` a cada 15 min (`/api/cron/google-sync`, com `cron_secret` e `app_url` no Vault). Testado nos dois sentidos pelo Luan.
- **Google Cloud:** app publicado ("Em produção"), sem verificação (uso pessoal, abaixo de 100 usuários); páginas públicas `/privacidade` e `/termos` exigidas pelo Google.
- Lição: ao colar o ID do cliente do arquivo JSON do Google, conferir que não veio junto o trecho `client_id":"`.

## 9. Fase 4 concluída (2026-11-01)

- **Atalhos** com card do Gerenciador de O.S.: abertas, atrasadas e aguardando peça, lidos pela API do Gerenciador (`GET /api/v1/orders`, chave só `orders:read`). Decisão: "atrasada" = aberta há mais de 7 dias, porque a API não devolve a data prevista. Só números; nenhum dado de cliente é guardado.
- **Ideias de Conteúdo** com pilares e **Planejamento de Publicações** (calendário + funil). Decisão: o calendário principal fica no Segundo Cérebro; o Agente de Marketing vira fonte de sugestões.
- **Agente de Marketing:** interface + versão de teste em `lib/integrations/marketing-agent`. A API real fica para a Fase 6.
- **Fluxos de Atendimento** (5 sugeridos) e **Assistente de Respostas**: aceita tanto texto quanto prints/capturas do WhatsApp (`Ctrl+V`, arrastar e upload de fotos). A IA (Gemini Vision multimodal) analisa o print diretamente, extrai o sintoma/problema do cliente, cruza com o Repositório da Empresa e gera respostas prontas no tom de voz do Luan, exibindo as imagens salvas no histórico. Se enviado como texto puro, mantém o mascaramento prévio por `lib/mask.ts`.
- **Diretoria de Marketing (2026-11-02)**: Hub completo sob a Trust Care integrando: (1) Planejador de Conteúdo para Reels, Stories (4 atos) e Carrosséis (slide a slide) com auxílio de IA; (2) Linha do tempo de Campanhas com orçamentos em centavos e Matriz de Ângulos de copy/anúncios; (3) Analisador Meta Ads com KPIs de tráfego, conexão MCP e diagnósticos consultivos gerados por IA.
- Alerta para o projeto do Gerenciador (fora deste repositório): a tabela `order_status_transitions` está sem RLS no Supabase "Trust Care".

---

## 10. Fase 5 concluída: Finanças, Notebooks e Revisão Semanal (2026-11-09)

> Definido e alinhado via `/grill-with-docs` com ADRs 0001 e 0002.
> O app entrega gestão do fluxo de caixa, controle ponta a ponta dos notebooks de revenda da Trust Care, importação local de extratos bancários OFX e revisão guiada de domingo.

### 10.1 Decisões e Modelo de Domínio
1. **Notebooks de Revenda**: Ativos próprios de estoque para compra, reforma e revenda com margem (separados das O.S. de clientes da assistência técnica).
2. **Peças e Insumos**: Lançamentos financeiros diretos vinculados ao notebook (`transactions.notebook_id`), sem chamada de API para o sistema da Trust Care (ver ADR 0002).
3. **Preço Pretendido e Vitrine**: Campo `asking_price_cents` para cálculo de margem esperada na bancada e indicador de "Dias em Estoque" (com alerta de capital parado após 30 dias).
4. **Fechamento de Venda e Pós-Venda**: Modal dedicado de venda com registro do comprador, contato, garantia de balcão (padrão 90 dias), data, valor bruto e taxa da maquininha de cartão. Custos pós-venda (garantia acionada) abatem a margem real do aparelho.
5. **Importador de Extrato Bancário (OFX)**: Leitor local de arquivos `.ofx` no servidor Next.js sem envio para modelos de IA externos (`ai_enabled = false`), com anti-duplicação por `FITID`, correspondência com lançamentos manuais já existentes e aprendizado automático de categorias via `finance_rules` (ver ADR 0001).
6. **Ledger e Salários**: Salário da SES e gastos pessoais ficam em `pessoal`. Retiradas da Trust Care para uso pessoal são transferências internas (pró-labore), sem inflar o consolidado.

### 10.2 Etapas Entregues
1. **Migration e Tipos (`20261109103000_finance_phase5.sql`)**: `asking_price_cents`, `buyer_name`, `buyer_contact`, `warranty_days`, `sold_at`, `machine_fee_cents` em `public.notebooks`; `bank_fitid` em `public.transactions`; tabela `finance_rules` com RLS e atualização de `lib/supabase/database.types.ts`.
2. **Ciclo de Vida de Notebooks**: Preço anunciado, dias em estoque (alerta >30 dias), modal de venda com taxa de maquininha e comprador, e suporte a despesas de garantia pós-venda no `NotebooksTracker`.
3. **Parser e Motor de Extrato OFX**: Parsing local de `.ofx` (SGML/XML) extraindo `FITID`, data, valor em centavos e descrição, com lógica de reconciliação.
4. **Interface de Importação e Regras**: Modal interativo com prévia, auto-categorização via `finance_rules`, salvamento em lote e aprendizado de regras.
5. **Revisão Semanal**: Tela `/revisao` com checklist guiado de domingo integrando tarefas pendentes, Caixa de Entrada e resumo financeiro da semana.

---

## 11. Finanças Pessoal & Familiar ("Minhas Finanças" · 2026-11-12)

> Evolução do ledger `pessoal` calibrada com a planilha familiar de Luan & Rayzza.

- **Modelo de Dados (`20261112120000_finance_family.sql`):** `finance_accounts` (contas correntes, reserva, dinheiro e 4 cartões de crédito com limite e dia de vencimento), `finance_recurring_bills` (contas/entradas fixas mensais + regra percentual automática de `10%` para o Dízimo), `finance_budgets` (tetos mensais por categoria) e extensão de `transactions` (`status` Pago/Pendente, `due_date`, `paid_at`, `account_id`, `member_label` Casa/Luan/Rayzza, `recurring_bill_id` e parcelamentos `installment_group_id` / `installment_index` / `installment_total`). Todas as tabelas novas com RLS (`private.apply_owner_policy`).
- **5 Visões em `/financas`:** (1) `Visão Geral` (alertas de vencimento, resposta principal do mês + faixa dividida de KPIs, baixa rápida em 1 clique, entradas base e distribuição por pessoa), (2) `Contas & Cartões` (saldos reais, transferência entre contas e faturas dos cartões), (3) `Orçamentos` (planejado vs. realizado com barras proporcionais honestas e lista adaptada ao celular), (4) `Relatórios & KPIs` (Diagnóstico do mês sob demanda com trava de privacidade via `assertAreaAllowsAi` / análise local determinística, Taxa de Poupança, Comprometimento Fixo, Burn Rate, comparativo Mês Atual vs. Anterior vs. Média 3M, tendência 6 meses e distribuição por categoria) e (5) `Fluxo & Vencimentos` (tabela desktop + linhas compactas de 2 linhas no mobile e quitação direta).
- **Reorganização visual e hierarquia (`2026-11-12`):**
  - Shell único de 56px em `/financas` e `/p/[folderId]` (módulo `finance`), sem título duplicado de pasta e sem o botão flutuante global de captura no celular sobreposto à lista financeira.
  - Abas filtradas por ledger (`Pessoal`, `Trust Care`, `Consolidado`), menu único **Configurar ▾** e apenas 1 CTA primário invertido no topo (`+ Lançamento` ou `+ Notebook`).
  - Reconciliação completa de dados: filtro por pessoa aplicado no servidor em `getFinanceSummary` e `getTransactions`, gráficos ancorados no mês selecionado (`?m=`) sem barras mínimas falsas em meses zerados, e resumo dividido real no `Consolidado`.
  - Efeito `transitions-ui-generation` em `lib/motion/ui-generation/` restrito a dois momentos intencionais sob demanda: geração do diagnóstico mensal e primeiro carregamento do modelo de contas fixas.
- **Integração com `/hoje`:** Card lateral **Contas da Semana** destacando contas atrasadas ou vencendo nos próximos 7 dias.

---

## 12. Shell Desktop Retrátil e Ícones Minimalistas (2026-11-12)

- **Menu lateral retrátil (`components/app-shell/`):**
  - O `<aside>` desktop em `app-shell.tsx` alterna suavemente entre `w-64` (expandido) e `w-14` / `56px` (retraído, modo apenas ícones) com `transition-[width] duration-200 ease-out`.
  - Persistência sincronizada via `useSyncExternalStore` em `localStorage` (`segundo-cerebro:sidebar-collapsed`), evitando erros de hidratação SSR e efeitos colaterais de `setState`.
  - O atalho `Ctrl+B` não foi associado de propósito para preservar o negrito do editor BlockNote em `/conhecimento`; o controle fica em botão acessível (`hidden md:inline-flex`, `aria-expanded`) na `topbar.tsx`.
- **Ícones minimalistas e rail recolhido (`sidebar.tsx`):**
  - Os pontos coloridos (`span.size-2.rounded-full`) nos cabeçalhos das áreas foram substituídos pelos ícones outline Lucide (`briefcase`, `user`, `wrench`, `wallet`, com fallback em `AREA_DEFAULT_ICON`), combinando com os subícones das pastas (`size-3.5` expandido, `size-4` recolhido) e destacando `text-(--area)` apenas quando ativo.
  - No estado recolhido, as áreas, subpastas (`CollapsedFolderRail`) e `Configurações` exibem apenas ícones centralizados com `<Tooltip side="right">` utilizando o `<TooltipProvider>` raiz do layout.


