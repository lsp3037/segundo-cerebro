# Segundo Cérebro

Sistema pessoal do Luan para organizar a vida profissional (SES-MT), pessoal, a Trust Care e as finanças em um só lugar.

- **Stack:** Next.js 16 (App Router) + TypeScript + Tailwind + shadcn/ui, Supabase (Postgres, Auth, RLS, Storage, pg_cron, Vault), Vercel, Gemini (`@google/genai`).
- **No ar:** https://segundo-cerebro-one-omega.vercel.app (no PC: http://localhost:3333).
- **Documentos:** [`docs/PRD.md`](docs/PRD.md) (o que o sistema faz e por quê) · [`docs/PLANO.md`](docs/PLANO.md) (plano técnico e decisões) · [`docs/OPERACAO.md`](docs/OPERACAO.md) (testes, problemas comuns e pendências).

| Fase | Conteúdo | Situação |
|---|---|---|
| 1. Fundação | Login fechado, layout com abas e árvore lateral, temas, cores por área, banco e RLS | ✅ |
| 2. Núcleo | Tarefas, Caixa de Entrada, Conhecimento, Aprender, Ideias, hábitos, busca no conteúdo | ✅ |
| 3. Agenda | Google Agenda nos dois sentidos, duas contas (pessoal e SES), blocos de tarefa | ✅ |
| 4. Trust Care | Atalhos e O.S., conteúdo, publicações, fluxos, assistente, Diretoria de Marketing | ✅ |
| 5. Finanças e Revisão Semanal | Fluxo familiar/pessoal ("Minhas Finanças"), revenda de notebooks, extrato OFX e revisão guiada | ✅ |
| 6. Extras | Telegram, busca com IA, Agente de Marketing real, PWA | ⏳ |

---

## Rodar no seu PC

Pré-requisitos: Node.js 20 ou mais novo e o Git.

```bash
npm install
```

```bash
copy .env.example .env.local
```

Preencha o `.env.local` (ver [Configuração](#configuração-passo-a-passo)) e rode:

```bash
npm run dev
```

Abra o endereço que aparecer no terminal (http://localhost:3333).

### Comandos úteis

| Comando | O que faz |
|---|---|
| `npm run dev` | Roda o app no seu PC, atualizando a cada alteração |
| `npm run build` | Compila como na Vercel (bom para conferir se está tudo certo) |
| `npm run lint` | Procura erros comuns no código |
| `npx tsc --noEmit` | Confere os tipos do TypeScript sem compilar |

---

## Configuração passo a passo

Faça uma etapa de cada vez. As etapas das fases futuras ficam marcadas e só são necessárias quando a fase chegar.

### 1. Supabase (Fase 1) ✅ já feito

O projeto **Segundo Cerebro** fica em São Paulo (`sa-east-1`). As tabelas já foram criadas pelas migrations em `supabase/migrations/`.

No `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: painel do Supabase › **Project Settings** › **API Keys**. A chave *publishable* é pública por natureza; quem protege os dados é o RLS.
- `ALLOWED_EMAILS`: os e-mails que podem entrar, separados por vírgula.

### 2. Lista de e-mails no banco (Fase 1) ✅ já feito

Além do `ALLOWED_EMAILS`, o banco tem a própria lista: um cadastro com e-mail fora dela é recusado. Para incluir outro e-mail, rode no **SQL Editor** do Supabase:

```sql
insert into private.allowed_emails (email) values ('outro.email@gmail.com');
```

### 3. Endereços de retorno do login (Fase 1) ✅

O Supabase só devolve o login para endereços autorizados.

1. Supabase › **Authentication** › **URL Configuration**.
2. **Site URL**: o endereço do app na Vercel (hoje `https://segundo-cerebro-one-omega.vercel.app`). Enquanto não houver deploy, use `http://localhost:3333`.
3. Em **Redirect URLs**, adicione:
   - `http://localhost:3333/**`
   - `https://segundo-cerebro-one-omega.vercel.app/**`

### 4. Login com Google (Fase 1) ✅

1. No [Google Cloud Console](https://console.cloud.google.com/), crie um projeto (ex.: "Segundo Cérebro").
2. **APIs e serviços › Tela de consentimento OAuth**: tipo **Externo**, preencha nome e e-mail de suporte. Na Fase 3 o app é **publicado** (ver etapa 8), porque em modo de teste o Google corta o acesso à Agenda a cada 7 dias.
3. **APIs e serviços › Credenciais › Criar credenciais › ID do cliente OAuth**, tipo **Aplicativo da Web**.
   - **URIs de redirecionamento autorizados**: `https://ynbxqftfhbpgnqdiqqlk.supabase.co/auth/v1/callback`
4. Copie o **ID do cliente** e a **chave secreta**.
5. Supabase › **Authentication** › **Sign In / Providers** › **Google**: ative e cole os dois valores.

> O mesmo projeto do Google Cloud será reaproveitado na Fase 3 (Agenda), com uma permissão a mais.

### 5. Depois de entrar pela primeira vez (Fase 1) ✅

Supabase › **Authentication** › **Sign In / Providers** › desligue **Allow new users to sign up**. Isso fecha a primeira camada do login. A sua conta continua funcionando.

### 6. Deploy na Vercel (Fase 1) ✅

1. Suba o código para um repositório **privado** no GitHub.
2. Na [Vercel](https://vercel.com/new), importe o repositório.
3. Em **Environment Variables**, cadastre as mesmas variáveis do `.env.local`.
4. A região das funções já vem como **São Paulo (gru1)** pelo `vercel.json`, perto do banco.
5. Depois do primeiro deploy, volte à etapa 3 e cadastre o endereço `*.vercel.app`.

### 7. Gemini (Fase 2) ✅

Chave criada em [Google AI Studio](https://aistudio.google.com/apikey) no projeto "Segundo Cerebro". `GEMINI_MODEL=gemini-3.5-flash` e `GEMINI_FALLBACK_MODEL=gemini-flash-latest` (o reserva entra quando o principal está sobrecarregado).

### 8. Google Agenda (Fase 3) ✅

Como funciona:
- **Conectar:** Configurações › Google Agenda › Conectar. É um login separado só para a Agenda; o token fica criptografado (`TOKEN_ENCRYPTION_KEY`) numa tabela que o navegador não lê.
- **Google → app:** o Google avisa `/api/google/webhook` quando algo muda (canais "watch", renovados automaticamente) e o app busca só o que mudou (`syncToken`).
- **Rotina de segurança:** o `pg_cron` do Supabase chama `/api/cron/google-sync` a cada 15 minutos (renova canais e sincroniza). Não usamos o cron da Vercel porque no plano gratuito ele roda só uma vez por dia.
- **App → Google:** criar, editar e apagar eventos grava primeiro no Google. Conflitos: vale a última edição; ficam registrados em `sync_log`.

Configuração (uma etapa de cada vez):
1. Supabase › Project Settings › API Keys › **Secret keys**: copie a chave `sb_secret_…` para `SUPABASE_SECRET_KEY` no `.env.local`.
2. Google Cloud › APIs e serviços › Biblioteca: ative a **Google Calendar API**.
3. Google Auth Platform › Acesso a dados: adicione o escopo `…/auth/calendar`.
4. Google Auth Platform › Público-alvo: **Publicar app** (em "Em teste", o Google corta o acesso a cada 7 dias). Aparece o aviso "app não verificado"; para uso pessoal é só continuar.
5. Google Auth Platform › Clientes › o cliente do Supabase: adicione os URIs de redirecionamento `https://segundo-cerebro-one-omega.vercel.app/api/google/callback` e `http://localhost:3333/api/google/callback`; copie ID e chave secreta para `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`.
6. Vercel › Environment Variables: `SUPABASE_SECRET_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY` e `CRON_SECRET` (os mesmos valores do `.env.local`) e `APP_URL=https://segundo-cerebro-one-omega.vercel.app`.
7. O endereço do app e o `CRON_SECRET` vão para o Vault do Supabase (usado pelo `pg_cron`) pela função `admin_set_secret`, chamada com a chave secreta.

### 9. Trust Care (Fase 4) ✅

- **Atalhos:** cards de acesso rápido. O card do Gerenciador de O.S. mostra abertas, atrasadas (abertas há mais de 7 dias, porque a API não informa a data prevista) e aguardando peça. Lê a API do Gerenciador (`GET /api/v1/orders`) com uma chave **só de leitura**; só os números aparecem, nenhum dado de cliente é guardado.
- **Ideias de Conteúdo** (com pilares) e **Planejamento de Publicações** (calendário e funil). O calendário fica aqui; o Agente de Marketing vira fonte de sugestões.
- **Agente de Marketing:** `lib/integrations/marketing-agent` tem a interface e uma versão de teste. A API real será combinada na Fase 6 (`MARKETING_AGENT_URL`, `MARKETING_AGENT_KEY`).
- **Fluxos de Atendimento** e **Assistente de Respostas:** antes de ir ao Gemini, a conversa passa por `lib/mask.ts`, que troca telefone, e-mail, CPF, CNPJ, CEP e endereço por marcadores. O texto original fica só no banco. O assistente só sugere; nada é enviado ao cliente.

Configuração:
1. No Gerenciador de O.S. (https://trustcare-one.vercel.app) › Configurações › API: crie uma chave marcando **só** "Consultar Ordens de Serviço" (`orders:read`).
2. Coloque `OS_API_URL=https://trustcare-one.vercel.app` e `OS_API_KEY=tc_live_…` no `.env.local` e na Vercel.

### 10. Finanças e Revisão Semanal (Fase 5) ✅

- **Finanças Pessoal & Familiar ("Minhas Finanças"):** cockpit completo inspirado no *Minhas Finanças* e integrado com a planilha da casa (`Casa`, `Luan`, `Rayzza`), contemplando:
  - **Contas & Cartões:** controle de saldos reais e faturas/limites de 4 cartões de crédito.
  - **Contas Fixas & Dízimo (10%):** modelo mensal predefinido com cálculo automático do dízimo sobre as entradas e geração no mês em lote.
  - **Baixa em 1 clique:** alternância rápida entre Pago e Pendente na listagem de vencimentos e card **Contas da Semana** integrado em `/hoje`.
  - **Orçamentos:** tetos mensais por categoria com comparativo planejado vs. realizado em tempo real.
  - **Relatórios & KPIs:** taxa de poupança, comprometimento fixo, burn rate e comparativo MoM / 3M. Diagnóstico mensal sob demanda com geração local determinística (respeitando a trava `ai_enabled = false`).
- **Revenda de Notebooks (Trust Care):** gestão do ciclo de vida dos aparelhos (`comprado`, `em reparo`, `à venda`, `vendido`) com preço anunciado de vitrine, alerta de capital parado (>30 dias), modal de venda com taxa de maquininha, registro de garantia de balcão e abatimento de despesas pós-venda.
- **Importador de Extrato Bancário (.OFX):** leitura local de arquivos `.ofx` sem tráfego de dados para IA externa, reconciliação inteligente por `FITID` e aprendizado automático de categorias via `finance_rules`.
- **Revisão Semanal (`/revisao`):** checklist guiado de 6 passos aos domingos (Caixa de Entrada, atrasadas, planejamento da semana, agenda, ideias de conteúdo e resumo financeiro).
- **Menu Lateral Retrátil no Desktop:** alternância suave entre árvore expandida (`w-64`) e trilho somente com ícones (`w-14` / 56px) com tooltips à direita, persistido no navegador, e ícones outline minimalistas substituindo os pontos coloridos das áreas.

### Próximas fases
- **Telegram, busca semântica com IA, Agente de Marketing real e PWA (Fase 6):** criar o bot com o [@BotFather](https://t.me/BotFather).

---

## Segurança e privacidade

- **Login fechado em 3 camadas:** cadastro desligado no Supabase, lista `ALLOWED_EMAILS` conferida a cada acesso, e o banco recusando e-mails fora de `private.allowed_emails`.
- **RLS em todas as tabelas:** cada linha tem um dono (`user_id`) e o banco só entrega as suas. Toda migration termina com `select private.assert_rls_enabled();`, que falha se alguma tabela ficar sem RLS.
- **Tokens do Google e mensagens do Telegram:** tabelas sem acesso pelo navegador; só o servidor lê.
- **LGPD:** a área Profissional mostra um aviso para não registrar dados de pacientes e nasce com a IA desligada. A trava de IA de cada área fica em **Configurações**.
- **Conversas de clientes e IA:** antes de ir para o Gemini, telefone, e-mail, CPF, CNPJ, CEP e endereço viram marcadores (`lib/mask.ts`). O texto original fica só no banco.
- **Integrações só de leitura:** o resumo de O.S. usa uma chave do Gerenciador com escopo `orders:read` e guarda só números.
- **Lixeira:** excluir uma pasta não apaga nada de vez; dá para restaurar em Configurações.

## Estrutura do projeto

```
app/
  (auth)/login/         tela de login
  auth/callback/        retorno do login
  (legal)/              privacidade e termos (públicas, exigidas pelo Google)
  (app)/                telas que exigem login (hoje, agenda, entrada, ideias, conhecimento, aprender, marketing, financas, revisao, configuracoes, p/[folderId])
  api/google/           conectar a agenda e receber avisos do Google
  api/cron/             chamado pelo pg_cron a cada 15 min (protegido por segredo)
  api/arquivos/         entrega anexos privados
components/
  app-shell/            barra superior (com botão retrátil), árvore lateral e busca Ctrl+K
  finance/              cockpit Minhas Finanças, cartões, orçamentos, relatórios, notebooks e OFX
  review/               revisão semanal guiada de domingo
  marketing/            Diretoria de Marketing (conteúdo, campanhas e Meta Ads)
  trustcare/            atalhos, O.S., conteúdo, publicações, fluxos, assistente
  tasks/ notes/ agenda/ …  uma pasta por módulo
  ui/                   componentes do shadcn/ui
lib/
  actions/              Server Actions (gravam no banco)
  data/                 leituras do banco
  ai/                   camada de IA (Gemini) com trava por área
  finance/              motor OFX, regras, diagnóstico local e cálculos familiares
  motion/               animações intencionais (transitions-ui-generation)
  google/               Google Agenda: API, sincronização, criptografia dos tokens
  integrations/         Gerenciador de O.S. (só leitura) e Agente de Marketing (teste)
  mask.ts               esconde dados pessoais antes de ir para a IA
  supabase/             clientes do Supabase e tipos gerados
supabase/migrations/    criação das tabelas, versionada
scripts/set-vault.mjs   grava endereço do app e CRON_SECRET no Vault
docs/
  PRD.md                o que o sistema faz e por quê
  PLANO.md              plano técnico e diário de decisões
  OPERACAO.md           rodar, testar, resolver problemas, pendências
  adr/                  Architecture Decision Records (OFX, peças de notebook)
  especificacao-original.md   o pedido original do Luan
```

## Banco de dados

- Migrations novas vão em `supabase/migrations/`, terminando com `select private.assert_rls_enabled();`.
- Tabelas novas: `select private.apply_owner_policy('public.nome_da_tabela');` aplica RLS, permissões, índice e `updated_at` de uma vez.
- Os tipos TypeScript ficam em `lib/supabase/database.types.ts` e são gerados a partir do banco.
