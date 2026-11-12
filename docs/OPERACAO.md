# Segundo Cérebro: operação do dia a dia

> Como testar cada fase, o que fazer quando algo dá errado e o que está pendente.
> A instalação e a configuração ficam no [README](../README.md). O produto está descrito no [PRD](PRD.md).

---

## 1. Endereços e serviços

| O quê | Onde |
|---|---|
| App no ar | https://segundo-cerebro-one-omega.vercel.app |
| App no PC | http://localhost:3333 (a porta 3000 é de outro projeto) |
| Banco | Supabase "Segundo Cerebro" (`ynbxqftfhbpgnqdiqqlk`, São Paulo) |
| Código | GitHub `lsp3037/segundo-cerebro` (privado, branch `main`). Cada envio publica sozinho na Vercel. |
| Google | Projeto "Segundo Cerebro" no Google Cloud. App **publicado**, sem verificação. |
| Gerenciador de O.S. | https://trustcare-one.vercel.app (Supabase "Trust Care", `dbxdqolktavqngrxknum`). Só lemos a API dele. |
| Rotina automática | `pg_cron` "google-calendar-sync", a cada 15 min, chama `/api/cron/google-sync` |

## 2. Variáveis de ambiente

As variáveis ficam no `.env.local` (PC) e em Vercel › Settings › Environment Variables (site). A lista completa, com explicação, está no [`.env.example`](../.env.example).

- `APP_URL` muda entre os dois lugares: `http://localhost:3333` no PC e o endereço `https` na Vercel.
- As demais variáveis têm o **mesmo valor** nos dois lugares, principalmente `TOKEN_ENCRYPTION_KEY` e `CRON_SECRET`. Se `TOKEN_ENCRYPTION_KEY` mudar, as contas Google precisam ser conectadas de novo.
- O Vault do Supabase também guarda `app_url` e `cron_secret`, usados pelo `pg_cron`. Para regravar: `node scripts/set-vault.mjs https://segundo-cerebro-one-omega.vercel.app`.
- Depois de mudar uma variável na Vercel, é preciso **publicar de novo** (Deployments › ⋯ › Redeploy).

## 3. O que testar em cada fase

### Fase 1: Fundação
- [ ] Entrar com Google (Gmail pessoal) no PC e no site.
- [ ] Um e-mail fora da lista cai em "Acesso negado".
- [ ] Árvore de pastas: criar, renomear, arrastar, mover, excluir e restaurar em Configurações.
- [ ] Tema claro/escuro, cor de cada área e `Ctrl+K` para navegar.

### Fase 2: Núcleo
- [ ] Tarefas: criar, repetir (a próxima aparece ao concluir), Kanban e atrasadas em destaque.
- [ ] Hábitos: marcar o dia na aba Hoje e ver a sequência na pasta Rotina.
- [ ] Caixa de Entrada: `Alt+N`, organizar em tarefa, nota, ideia etc., e "Sugerir com IA".
- [ ] Conhecimento: `/` para blocos, `@` para ligar notas, anexar arquivo.
- [ ] Aprender: concluir e transformar em nota.
- [ ] `Ctrl+K` acha conteúdo pelo texto.

### Fase 3: Agenda
- [ ] Um evento criado no app aparece no Google (e o inverso, em segundos, no site).
- [ ] Editar e apagar nos dois sentidos, inclusive em evento que se repete.
- [ ] "Bloquear na agenda" numa tarefa com horário.
- [ ] Conta da SES: os eventos aparecem na área Profissional.
- [ ] Configurações › Google Agenda: ligar e desligar agendas.

### Fase 4: Trust Care
- [ ] Atalhos: o card do Gerenciador mostra abertas, atrasadas e aguardando peça.
- [ ] Ideias de Conteúdo: pilares, formato, "Sugestões do Agente" (teste) e "Planejar publicação".
- [ ] Publicações: clicar num dia cria a publicação, mudar status e ver no funil.
- [ ] Fluxos: editar etapas, mensagens-modelo (copiar) e objeções.
- [ ] Assistente: colar print via Ctrl+V ou upload de imagem (ou texto). O Gemini analisa o atendimento, gera 2 a 3 respostas para o WhatsApp, "Copiar" e salva o print no histórico.
- [ ] Diretoria de Marketing: acessar a pasta e testar:
  - [ ] Planejador de Conteúdo: criar roteiro de Reel, sequência de Stories em 4 atos e Carrossel; testar "Gerar com IA".
  - [ ] Campanhas & Ângulos: cadastrar campanha com orçamento e datas; criar ângulos de teste e usar "Sugerir com IA".
  - [ ] Analisador Meta Ads: visualizar KPIs (Spend, Cliques, CTR, CPC, Leads, CPL); testar botão de sincronização e diagnóstico da IA.

### Fase 5: Finanças, Pessoal/Familiar e Revisão Semanal
- [ ] Executar a migration `supabase/migrations/20261112120000_finance_family.sql` no SQL Editor do Supabase.
- [ ] Finanças Pessoal & Familiar: abrir `/financas`, clicar em **Contas Fixas & Dízimo** → **Carregar Modelo da Planilha**, preencher os valores de Entradas/Saídas e clicar em **Salvar & Gerar no Mês**.
- [ ] Conferir cálculo automático de `10%` do Dízimo ao alterar Entradas, filtro por Pessoa (`Casa`, `Luan`, `Rayzza`), baixa rápida em 1 clique (`Pagar` ↔ `Pago`) e card **Contas da Semana** em `/hoje`.
- [ ] Contas & Cartões, Orçamentos e Relatórios: cadastrar saldo inicial/transferência, definir metas de orçamento (ex.: Supermercado) e conferir comparativos entre períodos.
- [ ] Trust Care & Notebooks: alternar para Trust Care, cadastrar notebook com preço de vitrine, registrar venda com garantia/taxa de maquininha e conferir lucro real.
- [ ] Importador OFX: subir arquivo de extrato bancário, conferir detecção de novos e memorização de regras.
- [ ] Revisão Semanal (/revisao): percorrer os 6 passos guiados de domingo e concluir.

**Dica para testes:** comece os dados de teste com `[teste]`, para achá-los e apagá-los depois.

## 4. Problemas comuns

| Sintoma | Causa | Solução |
|---|---|---|
| O app no PC mostra erros estranhos depois de um `npm run build` | O build e o `npm run dev` dividem a pasta `.next` | Pare o app, apague a pasta `.next` e rode `npm run dev` de novo. Não rode build com o app ligado. |
| O Chrome não abre `localhost:3333` | Particularidade do Chrome deste PC | Teste pelo painel do navegador do app do Claude ou pelo site publicado. |
| "Erro 401: invalid_client" ao conectar a Agenda | O ID do cliente foi colado com sobra do arquivo JSON (`client_id":"`) | Deixe a linha do `.env.local` só com o ID, que termina em `.apps.googleusercontent.com`. |
| "O Google não verificou este app" | Esperado: app pessoal sem verificação | Clique em **Avançado › Acessar Segundo Cérebro**. |
| Login volta para o site em vez do PC | Falta `http://localhost:3333/**` nas Redirect URLs do Supabase | Supabase › Authentication › URL Configuration. |
| "A IA não conseguiu responder agora" | O Gemini gratuito fica sobrecarregado (erro 503/429) | Tente de novo. O app já tenta o modelo reserva (`GEMINI_FALLBACK_MODEL`). Se um modelo for descontinuado, troque `GEMINI_MODEL`. |
| A agenda parou de atualizar sozinha | O aviso do Google venceu ou o `pg_cron` falhou | Configurações › Google Agenda mostra o erro. A rotina de 15 min renova os avisos. Se a rotina falhar com 401, confira se o `CRON_SECRET` é igual na Vercel e no Vault. |
| Card de O.S. com "Resumo desligado" ou "Chave recusada" | Falta ou expirou a `OS_API_KEY` | Crie uma chave nova no Gerenciador (só "Consultar Ordens de Serviço") e atualize no PC e na Vercel. |
| Card de O.S. com "Muitas consultas seguidas" | Limite de 30 consultas por minuto do Gerenciador | Espere um minuto. O app guarda o resumo por 5 minutos. |
| A conta da SES deixou de conectar | A administração do Google da SES bloqueou apps externos | Plano B: compartilhar a agenda da SES com o Gmail pessoal. |

## 5. Pendências

| Item | Detalhe |
|---|---|
| Busca `Ctrl+K` incompleta | Falta procurar em fluxos, eventos e ideias de conteúdo, como pede a especificação. |
| API do Agente de Marketing | Ainda é versão de teste. Combinar rotas, formato e chave na Fase 6. |
| RLS no Gerenciador de O.S. | A tabela `order_status_transitions` do Supabase "Trust Care" está sem RLS: com a chave pública daquele app, dá para alterar as regras de status. Corrigir **no projeto do Gerenciador**, ligando o RLS e criando uma regra de leitura (ligar sem a regra bloqueia o próprio Gerenciador). |
| Variável sobrando na Vercel | `NEXT_PUBLIC_SUPABASE` (sem uso) pode ser apagada. |
| Fases 5 e 6 | Finanças e Revisão Semanal; Telegram, busca com IA, Agente real e PWA. |

## 6. Como trabalhamos

- Uma fase por vez, **com aprovação do Luan antes de começar** cada uma.
- Um commit por etapa, e o app funcionando no fim de cada fase.
- Ações fora do código (chaves, Google Cloud, Vercel) são feitas pelo Luan, **uma de cada vez**. Segredos nunca são colados no chat.
- Toda migration termina com `select private.assert_rls_enabled();`.
