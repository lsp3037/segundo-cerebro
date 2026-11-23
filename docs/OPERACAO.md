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

### Fase 5: Finanças, Pessoal/Familiar e Revisão Semanal ✅
- [x] Migration `supabase/migrations/20261112120000_finance_family.sql` executada no SQL Editor do Supabase.
- [x] Finanças Pessoal & Familiar: abrir `/financas`, clicar em **Configurar ▾ → Contas Fixas & Dízimo** → **Carregar Modelo da Planilha**, preencher os valores de Entradas/Saídas e clicar em **Salvar & Gerar no Mês**.
- [x] Conferir cálculo automático de `10%` do Dízimo ao alterar Entradas, filtro por Pessoa (`Casa`, `Luan`, `Rayzza`), baixa rápida em 1 clique (`Pagar` ↔ `Pago`) e card **Contas da Semana** em `/hoje`.
- [x] Bancos e cartões, Orçamento e Análises: cadastrar saldo inicial/transferência, definir metas de orçamento (ex.: Supermercado), conferir comparativos entre períodos, distribuição por categoria e testar **Gerar diagnóstico do mês** (resumo local determinístico enquanto `ai_enabled = false` em Finanças).
- [x] Alternar entre `Pessoal` e `Trust Care` e ligar "Somar Trust Care" (antigo `Consolidado`) (e testar também via `/p/[folderId]` e no celular `390×844`): conferir cabeçalho único sem título duplicado, linhas responsivas de 2 linhas em `Lançamentos` / `Orçamento`, cadastro de notebook com preço de vitrine e venda com garantia/taxa de maquininha.
- [x] Importador OFX (`Configurar ▾ → Importar Extrato (.OFX)`): subir arquivo de extrato bancário, conferir detecção de novos e memorização de regras.
- [x] Revisão Semanal (/revisao): percorrer os 6 passos guiados de domingo e concluir.

### Shell Desktop e Usabilidade ✅
- [x] Menu lateral retrátil no desktop: alternar pelo botão da barra superior (`PanelLeftCloseIcon` / `PanelLeftOpenIcon`), transição suave entre `w-64` e `w-14` (apenas ícones), tooltips explicativos à direita e persistência no navegador via `localStorage`.
- [x] Ícones minimalistas outline Lucide nas áreas (`briefcase`, `user`, `wrench`, `wallet`) em substituição aos pontos coloridos, com destaque sutil de cor apenas no estado ativo.
- [x] Drawer lateral mantido no celular via botão de menu, sem conflitos com o modo desktop.

### Recorrentes (Finanças › Configurar › Contas Fixas)
- [x] Migration `20261113120000_finance_recurring_schedule.sql` executada no SQL Editor (início/fim, reajustes e meses pulados).
- [ ] Setinha de cada item: definir "Começa em" / "Termina em" e conferir que o lançamento pendente some fora do período.
- [ ] Mudar o valor de uma conta com "vale a partir de" num mês futuro: o mês atual não muda e o futuro vem com o valor novo (o histórico aparece na linha).
- [ ] "Pular este mês" e "Voltar a vencer neste mês"; dia de recebimento nas entradas (Salário, Bolsa).

### Notificações (sino da barra superior)
- [ ] Conferir o número vermelho no sino e o balanço quando chega aviso novo (atualiza ao abrir, a cada minuto e ao voltar para a aba).
- [ ] No painel: filtros, `Hoje` numa tarefa atrasada, `Pagar` numa conta, `Concluir` numa tarefa com horário e o `Desfazer` de cada um.
- [ ] `Marcar todas como lidas`, recarregar a página e ver que continuam lidas (fica em `profiles.settings.notifications_read`, vale no PC e no celular).

### Investimentos (Finanças › Pessoal › Investimentos)
- [x] Migration `20261113180000_finance_investments.sql` executada no SQL Editor (investimentos, movimentos e CDI, com RLS).
- [x] A linha "CDI de hoje" mostra a taxa ao ano e a data do Banco Central.
- [x] Cadastrar "[teste] Cofrinho" com R$ 8.730,00: "Próximo crédito" dá cerca de R$ 5,32.
- [x] "[teste] Aporte" de R$ 1.000,00 com data de 06/11/2026: em 13/11 o rendimento total é R$ 3,05 (rende a partir do dia útil seguinte; sábado, domingo e feriado não rendem).
- [x] "Resgatei" mais do que tem é recusado; "Resgatar tudo" preenche o valor de hoje; excluir um aporte que deixaria o saldo negativo é recusado.
- [x] "Acertar com o app" com um valor diferente cria um "Ajuste" no histórico.
- [x] "Mudar taxa" com data: antes dela a taxa não muda; na mesma data substitui a anterior. Testar um saldo acima de R$ 10.000 (o que passa rende 100%).
- [x] "Desfazer" ao remover investimento, movimento e taxa. Trocar para Trust Care (a aba some), filtro de pessoa, `/p/[folderId]` e celular `390×844`.
- [ ] **Conferência real:** cadastrar o Cofrinho com o saldo do dia, comparar o crédito do próximo dia útil com o app do Mercado Pago e confirmar em que dia um aporte novo começa a render. Se não bater, usar "Acertar com o app" e anotar a diferença.

### Lançamentos redesenhado (Finanças › Lançamentos)
- [x] Migration `20261123120000_finance_category_icon.sql` executada no SQL Editor (coluna `icon` em `finance_categories`).
- [x] **Lançar rápido (computador):** na linha do topo, digitar "[teste] Café" e R$ 8,00 e apertar Enter: entra como pago, em "Já feitos", e categoria, dia e tipo continuam. Clicar em "Desfazer" (10 s) remove.
- [ ] **Folha no celular (390×844):** "+ Lançar" abre de baixo para cima com o valor em foco; escolher categoria, dia e quem; marcar "Ainda não" troca por "Vence em"; "Mais opções" abre o formulário completo com o que foi digitado.
- [x] **Ícone da categoria:** no gerenciador de categorias, escolher outro ícone (e "Automático" para voltar ao do nome) e ver na lista.
- [x] **Régua do mês (só na tela larga):** clicar num ponto filtra o dia e mostra o chip "Dia 19 de novembro ✕"; o ✕ limpa. Cores: verde, rosa, rosa com anel (atrasado) e cinza (feito).
- [ ] **Atrasados:** criar "[teste] Conta velha" pendente com vencimento no mês passado; ela aparece em "Atrasado" só no mês atual e some ao ver outro mês.
- [x] O filtro abre em "Falta resolver" e os botões mostram as contagens.
- [ ] As setas ← → trocam o mês, menos com folha, linha rápida ou popover abertos.

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
| Rendimento diferente do app do banco (cerca de 20% a mais no dia) | O banco mostra o rendimento depois do imposto de renda e a opção "Descontar imposto de renda" está desligada (use **Mudar taxa** e marque, a partir da data do primeiro depósito). Outra causa comum: o saldo de hoje foi lançado como depósito de uma data antiga; lance só o que foi depositado, com as datas reais | Corrija os lançamentos e ligue o desconto em **Mudar taxa**; se sobrar uma diferença pequena, use **Acertar com o app**. |
| Rendimento diferente do app do banco (poucos reais) | O banco arredonda cada crédito, mudou as faixas ou o saldo inicial foi digitado diferente | Use **Acertar com o app** (grava a diferença como ajuste). Se o banco mudou a taxa, use **Mudar taxa** com a data em que mudou. |
| "Não consegui atualizar o CDI" ou "CDI desatualizado" | O Banco Central está fora do ar ou ainda não publicou o CDI do dia | Nada a fazer: o app usa o último CDI guardado e tenta de novo depois (no mínimo 5 min após uma falha). |
| Lançamento atrasado de mês passado não aparece | Atrasados de meses anteriores só entram quando o mês visto é o mês atual (limite de 200) | Volte para o mês atual e use o filtro "Falta resolver". |
| A régua do mês não aparece | Ela só existe no computador, com a lista em 896 px de largura ou mais | Alargue a janela ou recolha o menu lateral. No celular, use os filtros. |
| Ícone da categoria errado | Sem escolha, o app deduz o ícone pelo nome da categoria | No gerenciador de categorias, escolha outro ícone (ou "Automático" para voltar ao do nome). |
| O lançar rápido gravou "pago" mas era uma conta a pagar | A linha rápida do computador sempre grava como pago | Use "+ Lançamento" (formulário completo) ou, no celular, a folha com "Já foi pago? Ainda não". |
| A conta da SES deixou de conectar | A administração do Google da SES bloqueou apps externos | Plano B: compartilhar a agenda da SES com o Gmail pessoal. |

## 5. Pendências

| Item | Detalhe |
|---|---|
| Busca `Ctrl+K` incompleta | Falta procurar em fluxos, eventos e ideias de conteúdo, como pede a especificação. |
| API do Agente de Marketing | Ainda é versão de teste. Combinar rotas, formato e chave na Fase 6. |
| RLS no Gerenciador de O.S. | A tabela `order_status_transitions` do Supabase "Trust Care" está sem RLS: com a chave pública daquele app, dá para alterar as regras de status. Corrigir **no projeto do Gerenciador**, ligando o RLS e criando uma regra de leitura (ligar sem a regra bloqueia o próprio Gerenciador). |
| Variável sobrando na Vercel | `NEXT_PUBLIC_SUPABASE` (sem uso) pode ser apagada. |
| Investimentos: conferência real | Comparar o crédito do próximo dia útil e o primeiro rendimento de um aporte novo com o app do Mercado Pago (ver seção 3). |
| Fases 1 a 5 | Concluídas e em produção (Vercel). |
| Fase 6 (Próxima) | Telegram, busca semântica com IA, integração real do Agente de Marketing e PWA. |

## 6. Como trabalhamos

- Uma fase por vez, **com aprovação do Luan antes de começar** cada uma.
- Um commit por etapa, e o app funcionando no fim de cada fase.
- Ações fora do código (chaves, Google Cloud, Vercel) são feitas pelo Luan, **uma de cada vez**. Segredos nunca são colados no chat.
- Toda migration termina com `select private.assert_rls_enabled();`.
