# Segundo Cérebro

Sistema pessoal do Luan para organizar a vida profissional (SES-MT), pessoal, a Trust Care e as finanças em um só lugar.

- **Stack:** Next.js 16 (App Router) + TypeScript + Tailwind + shadcn/ui, Supabase (Postgres, Auth, Storage), Vercel.
- **Plano completo e decisões:** [`docs/PLANO.md`](docs/PLANO.md).

| Fase | Conteúdo | Situação |
|---|---|---|
| 1. Fundação | Login fechado, layout com abas e árvore lateral, temas, cores por área, banco e RLS | ✅ |
| 2. Núcleo | Tarefas, Caixa de Entrada, Conhecimento, Aprender, hábitos | — |
| 3. Agenda | Google Agenda nos dois sentidos | — |
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
2. **Site URL**: o endereço do app na Vercel (ex.: `https://segundo-cerebro.vercel.app`). Enquanto não houver deploy, use `http://localhost:3333`.
3. Em **Redirect URLs**, adicione:
   - `http://localhost:3333/**`
   - `https://SEU-APP.vercel.app/**` (depois do deploy)

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

### Próximas fases

- **Google Agenda (Fase 3):** ativar a Google Calendar API no mesmo projeto do Google Cloud e gerar `TOKEN_ENCRYPTION_KEY` e `CRON_SECRET`.
- **Gemini (Fases 2 e 6):** criar a chave em [Google AI Studio](https://aistudio.google.com/apikey).
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
