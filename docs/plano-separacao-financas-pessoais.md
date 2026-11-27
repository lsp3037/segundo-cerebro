# Plano: separação das Finanças Pessoais em app próprio

> Status (2026-11-27): **aprovado pelo Luan** — iniciando **Fase 1**.
> Decisões tomadas: (1) separar **só o livro Pessoal** (`ledger = 'pessoal'`), mantendo **Trust Care + Notebooks** no Segundo Cérebro; (2) usar o **mesmo banco Supabase** atual (`Caminho A`, sem migração de tabelas nem vaga extra no plano gratuito); (3) exibir um **painel-resumo leve** em Finanças › Pessoal no Segundo Cérebro com botão para abrir o novo app.

---

## 1. Por que separar agora

- O módulo de **Finanças Pessoais / Familiares** cresceu e virou um produto completo: contas fixas e Dízimo automático de 10%, 4 cartões de crédito, orçamentos por categoria, análises e comparativos, importador local de extrato `.OFX`, Cofrinho/CDI com imposto regressivo e acesso compartilhado com a esposa (Rayzza).
- Tirar o Pessoal para um app dedicado (**Minhas Finanças**) traz três ganhos diretos:
  1. **Segundo Cérebro mais leve e 100% do Luan:** desaparece a necessidade de manter travas de acesso de membro convidado espalhadas pelo Segundo Cérebro para proteger SES-MT e Trust Care.
  2. **Experiência melhor para o casal:** a Rayzza entra direto no app próprio da casa (fácil de fixar no celular), vendo só o que é da família, sem esbarrar em telas empresariais.
  3. **Evolução independente:** melhorias no controle financeiro da casa não pesam nem arriscam quebrar o Segundo Cérebro.

## 2. Arquitetura escolhida

- **Novo projeto:** `c:\projetos\minhas-financas` (desenvolvimento local na porta `3334`), repositório privado separado no GitHub e deploy independente na Vercel.
- **Banco de dados (Caminho A):** continua usando o mesmo projeto Supabase (`ynbxqftfhbpgnqdiqqlk`, sa-east-1) com as tabelas `finance_*`, `transactions` (`ledger = 'pessoal'`) e `finance_members` + RLS já ativos. Os lançamentos, contas, cartões, investimentos e cadastro da Rayzza continuam valendo imediatamente, com zero risco de perda e sem consumir uma nova vaga no plano gratuito do Supabase.
- **Separação por API:** no código, os dois sistemas conversam apenas por API HTTP privada (`x-api-key`), seguindo o mesmo modelo já adotado com o Gerenciador de O.S. (`os-manager.ts`). Se um dia houver necessidade de mover o banco de Finanças para um Supabase próprio, basta apontar o app novo sem reescrever o Segundo Cérebro.
- **Trust Care:** o livro empresarial (`ledger = 'trustcare'`) e o controle de **Notebooks** permanecem completos dentro do Segundo Cérebro.

## 3. O que o Segundo Cérebro lê do Minhas Finanças

A integração cruza apenas os dados essenciais para a rotina diária:

1. **Aba Hoje (`/hoje`):** card lateral **Contas da Semana** (contas atrasadas e próximas a vencer).
2. **Sino de notificações:** avisos de contas vencendo hoje/amanhã ou atrasadas, mantendo o botão rápido **Pagar** (e **Desfazer**).
3. **Revisão Semanal (`/revisao`):** totais do mês (Entradas, Saídas e Saldo), somando o resumo pessoal vindo da API com o caixa local da Trust Care.
4. **Aba Finanças › Pessoal:** um **painel-resumo leve** (sobra prevista do mês, totais, contas da semana com baixa rápida e botão de destaque **Abrir Minhas Finanças ↗**).

## 4. Plano em 4 Fases (uma por vez)

### Fase 1 — Criar e publicar o novo app `Minhas Finanças`
- Criar o projeto Next.js enxuto (`c:\projetos\minhas-financas`, porta `3334`), sem dependências pesadas do Segundo Cérebro (sem BlockNote, Gemini, Google Agenda ou Meta Ads).
- Login fechado via Supabase (Google + e-mails autorizados do Luan e da Rayzza em `ALLOWED_EMAILS`), reutilizando `finance_member_owner` para que ambos vejam e gravem os mesmos dados da casa.
- Portar todas as telas e ações do livro Pessoal: **Resumo**, **Lançamentos** (grupos, lançar rápido, régua do mês), **Orçamento**, **Bancos e cartões**, **Investimentos** (Cofrinho/CDI), **Análises** (diagnóstico local, sem IA), **Contas Fixas & Dízimo 10%**, **Categorias**, **Importação `.OFX`** e **Sino de contas**.
- Garantir filtro fixo `ledger = 'pessoal'` em todas as leituras e gravações (inclusive nos saldos bancários).
- *O Segundo Cérebro permanece intacto durante toda a Fase 1.*

### Fase 2 — Criar a API privada no `Minhas Finanças`
- Criar rotas sob `/api/v1` protegidas pelo cabeçalho `x-api-key` (`FINANCE_API_KEY`) apenas no servidor:
  - `GET /api/v1/summary?month=YYYY-MM`: roda `ensureMonthBills` para o mês solicitado (mantendo contas fixas e Dízimo em dia automaticamente) e devolve os totais do mês + contas atrasadas e dos próximos 30 dias.
  - `POST /api/v1/transactions/:id/pay`: permite marcar/desmarcar uma conta pessoal como paga a partir do Segundo Cérebro.

### Fase 3 — Conectar o Segundo Cérebro à API + painel-resumo leve
- Criar o cliente de servidor `lib/integrations/finance-api.ts` (`FINANCE_API_URL` + `FINANCE_API_KEY`).
- Atualizar `/hoje`, o Sino e `/revisao` para consumirem os dados pessoais via `finance-api.ts`.
- Transformar **Finanças › Pessoal** no Segundo Cérebro no **painel-resumo leve** com atalho **Abrir Minhas Finanças ↗**, mantendo **Finanças › Trust Care** e **Notebooks** completos.

### Fase 4 — Limpeza do Segundo Cérebro e documentação
- Remover do Segundo Cérebro telas, ações e componentes exclusivos do Pessoal (Orçamentos, Bancos/Cartões, Contas Fixas/Dízimo, Investimentos/CDI, régua familiar).
- Remover o e-mail de membro de `ALLOWED_EMAILS` do Segundo Cérebro e simplificar a lógica de membro convidado em `proxy.ts` e `scope.ts` (mantendo a proteção no banco como camada extra).
- Atualizar [`PRD.md`](PRD.md), [`PLANO.md`](PLANO.md) e [`OPERACAO.md`](OPERACAO.md).
