# Segundo Cérebro

Sistema pessoal do Luan para organizar a vida profissional (SES-MT), pessoal, a Trust Care e as finanças em um só lugar.

- **Stack:** Next.js 16 (App Router) + TypeScript + Tailwind + shadcn/ui, Supabase (Postgres, Auth, Storage), Vercel.
- **Plano completo e decisões:** [`docs/PLANO.md`](docs/PLANO.md).

| Fase | Conteúdo | Situação |
|---|---|---|
| 1. Fundação | Login fechado, layout com abas e árvore lateral, temas, cores por área, banco e RLS | ✅ |
| 2. Núcleo | Tarefas, Caixa de Entrada, Conhecimento, Aprender, Ideias, hábitos, busca no conteúdo | ✅ |
| 3. Agenda | Google Agenda nos dois sentidos | 🚧 |
| 4. Trust Care | Atalhos e O.S., conteúdo, publicações, fluxos, assistente | — |
| 5. Finanças e Revisão Semanal | | — |
| 6. Extras | Telegram, busca com IA, Agente de Marketing, PWA | — |

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

### 3. Endereços de retorno do login (Fase 1)

O Supabase só devolve o login para endereços autorizados.

1. Supabase › **Authentication** › **URL Configuration**.
2. **Site URL**: o endereço do app na Vercel (hoje `https://segundo-cerebro-one-omega.vercel.app`). Enquanto não houver deploy, use `http://localhost:3333`.
3. Em **Redirect URLs**, adicione:
   - `http://localhost:3333/**`
   - `https://segundo-cerebro-one-omega.vercel.app/**`

### 4. Login com Google (Fase 1)

1. No [Google Cloud Console](https://console.cloud.google.com/), crie um projeto (ex.: "Segundo Cérebro").
2. **APIs e serviços › Tela de consentimento OAuth**: tipo **Externo**, preencha nome e e-mail de suporte e adicione seu Gmail como **usuário de teste**.
3. **APIs e serviços › Credenciais › Criar credenciais › ID do cliente OAuth**, tipo **Aplicativo da Web**.
   - **URIs de redirecionamento autorizados**: `https://ynbxqftfhbpgnqdiqqlk.supabase.co/auth/v1/callback`
4. Copie o **ID do cliente** e a **chave secreta**.
5. Supabase › **Authentication** › **Sign In / Providers** › **Google**: ative e cole os dois valores.

> O mesmo projeto do Google Cloud será reaproveitado na Fase 3 (Agenda), com uma permissão a mais.

### 5. Depois de entrar pela primeira vez (Fase 1)

Supabase › **Authentication** › **Sign In / Providers** › desligue **Allow new users to sign up**. Isso fecha a primeira camada do login. A sua conta continua funcionando.

### 6. Deploy na Vercel (Fase 1)

1. Suba o código para um repositório **privado** no GitHub.
2. Na [Vercel](https://vercel.com/new), importe o repositório.
3. Em **Environment Variables**, cadastre as mesmas variáveis do `.env.local`.
4. A região das funções já vem como **São Paulo (gru1)** pelo `vercel.json`, perto do banco.
5. Depois do primeiro deploy, volte à etapa 3 e cadastre o endereço `*.vercel.app`.

### 7. Gemini (Fase 2) ✅

Chave criada em [Google AI Studio](https://aistudio.google.com/apikey) no projeto "Segundo Cerebro". `GEMINI_MODEL=gemini-3.5-flash` e `GEMINI_FALLBACK_MODEL=gemini-flash-latest` (o reserva entra quando o principal está sobrecarregado).

### 8. Google Agenda (Fase 3)

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

### Próximas fases
- **Telegram (Fase 6):** criar o bot com o [@BotFather](https://t.me/BotFather).

---

## Segurança e privacidade

- **Login fechado em 3 camadas:** cadastro desligado no Supabase, lista `ALLOWED_EMAILS` conferida a cada acesso, e o banco recusando e-mails fora de `private.allowed_emails`.
- **RLS em todas as tabelas:** cada linha tem um dono (`user_id`) e o banco só entrega as suas. Toda migration termina com `select private.assert_rls_enabled();`, que falha se alguma tabela ficar sem RLS.
- **Tokens do Google e mensagens do Telegram:** tabelas sem acesso pelo navegador; só o servidor lê.
- **LGPD:** a área Profissional mostra um aviso para não registrar dados de pacientes e nasce com a IA desligada. A trava de IA de cada área fica em **Configurações**.
- **Lixeira:** excluir uma pasta não apaga nada de vez; dá para restaurar em Configurações.

## Estrutura do projeto

```
app/
  (auth)/login/         tela de login
  auth/callback/        retorno do login
  (app)/                telas que exigem login (abas, pastas, configurações)
components/
  app-shell/            barra superior, árvore lateral, busca Ctrl+K
  ui/                   componentes do shadcn/ui
lib/
  actions/              Server Actions (gravam no banco)
  data/                 leituras do banco
  supabase/             clientes do Supabase e tipos gerados
supabase/migrations/    criação das tabelas, versionada
docs/PLANO.md           plano e decisões
```

## Banco de dados

- Migrations novas vão em `supabase/migrations/`, terminando com `select private.assert_rls_enabled();`.
- Tabelas novas: `select private.apply_owner_policy('public.nome_da_tabela');` aplica RLS, permissões, índice e `updated_at` de uma vez.
- Os tipos TypeScript ficam em `lib/supabase/database.types.ts` e são gerados a partir do banco.
