# Plano: acesso da esposa às Finanças

Status: **aprovado e implementado** (etapas 1 a 3 publicadas). Etapa 4: conta de teste criada e ligada; falta o teste completo. Etapa 5: Rayzza cadastrada no banco e na Vercel; falta o primeiro login dela. Situação atual em [`OPERACAO.md`](OPERACAO.md).
Elaborado em 2026-11-23 a partir de um mapeamento completo do código (`explorer-agent`).

## 1. O que o Luan decidiu

- Ela entra com a conta Google dela e vê **só a área Finanças**. Não vê Profissional, Trust Care (Atalhos, Ideias, Publicações, Repositório, Fluxos, Assistente de Respostas, Marketing, O.S.), Agenda, Caixa de Entrada, notas, tarefas nem Revisão Semanal.
- Dentro de Finanças, ela tem acesso a **todo o Pessoal**: lançamentos de Casa, Luan e Rayzza, contas fixas, Dízimo, orçamento, bancos e cartões, análises e o Cofrinho e os investimentos.
- Ela **não** tem acesso às **Finanças da Trust Care**: o livro Trust Care, a visão Consolidado e os Notebooks.
- O que ela cria fica junto com o que o Luan cria. Por enquanto, não precisa marcar quem criou.

**Premissa a confirmar:** dentro do Pessoal ela faz tudo o que o Luan faz. Isso inclui lançar, dar baixa, editar e excluir, mudar categorias, metas, contas fixas e bancos, e usar Guardei/Resgatei, Mudar taxa e a importação de extrato.

## 2. Como funciona hoje (o que impede)

- **Lista de e-mails permitidos:** o login só aceita o e-mail do Luan, em dois lugares: `ALLOWED_EMAILS` (Vercel e PC) e `private.allowed_emails` (banco).
- **Dono de cada registro:** todas as tabelas têm `user_id`, e o banco só mostra cada registro ao dono (política "dono acessa"). Hoje ela veria um app vazio.
- **Primeiro login:** o banco cria para quem entra pela primeira vez áreas, pastas e categorias padrão. Para ela, isso criaria um "Finanças paralelo", que o Luan nunca veria.
- **Pessoal e Trust Care:** os dois livros ficam nas mesmas tabelas (`transactions`, `finance_categories`, `finance_rules`), separados pela coluna `ledger`. A parede tem de ficar no banco, e não só na tela.
- **Saldos dos bancos:** são somados a partir dos lançamentos. Se algum banco ou cartão também recebe lançamentos da Trust Care, o saldo que ela vê ficaria diferente do que o Luan vê. Isso é conferido na etapa 3.

## 3. Modelo recomendado

**Uma tabela de membros, mantendo o Luan como dono de tudo.** O que ela lança é gravado como do Luan.

- Tabela nova `finance_members` com `owner_id` (Luan), `email` (dela), `member_id` (preenchido no primeiro login dela) e `active`.
- **Regras extras no banco**, que se somam à atual "dono acessa", valendo só para membros ativos:

  | Tabela | O que ela pode |
  |---|---|
  | `transactions`, `finance_categories`, `finance_rules` | tudo, só com `ledger = 'pessoal'`. O banco recusa ler ou gravar Trust Care, inclusive trocar um lançamento de livro. |
  | `finance_accounts`, `finance_recurring_bills`, `finance_budgets`, `payment_methods` | tudo (são do Pessoal) |
  | `finance_investments`, movimentos e `finance_cdi_daily` | tudo |
  | `notebooks` (e a visão de lucro) | nada |
  | todas as outras tabelas do app | nada (continua valendo só "dono acessa") |

- **Gatilho no banco:** quando ela grava, o `user_id` vira o do Luan. Assim nada fica "solto" com o id dela.
- **No app:** um ponto único, `getFinanceScope()`, diz que o dono é o Luan e que o acesso é só ao Pessoal. Os cerca de 67 filtros `user_id` de Finanças passam a usá-lo.
- O cálculo do **Dízimo** continua igual, porque ela enxerga todas as entradas do Pessoal, como o Luan.

Descartado: pôr um "id da casa" em cada tabela. Mexeria em umas 12 tabelas, nos índices únicos e em uns 93 pontos do código, sem ganho para um casal.

## 4. Etapas

Cada etapa é testada e publicada antes da seguinte, e o app continua funcionando para o Luan o tempo todo. O acesso dela só é ligado na etapa 4.

1. **Banco: membros, regras e primeiro login.**
   - Migration com `finance_members`, as regras extras por livro, o gatilho de dono e o ajuste do primeiro login: um membro não ganha áreas, pastas nem categorias próprias.
   - **Ação do Luan:** rodar 1 SQL no Supabase. Ainda sem nenhum e-mail novo, então o acesso fica desligado.
2. **App: "escopo" de Finanças.**
   - Criar `getFinanceScope()` e trocar os filtros `user_id` de Finanças.
   - Para membro, não rodam a criação de categorias padrão nem a limpeza de categorias duplicadas. A geração das contas do mês roda em nome do dono.
   - O "Desfazer" passa a avisar quando nada foi restaurado.
   - Para o Luan, nada muda: o teste é ver que todos os números continuam iguais.
3. **App: a visão dela.**
   - O login dela vai direto para `/financas`. Qualquer outra rota volta para Finanças, conferido no servidor e não só no menu.
   - Sem as abas do topo e as áreas do menu lateral, sem a busca e a captura globais (Ctrl+K e Alt+N), sem Configurações. O sino mostra só os avisos de Finanças.
   - Só o Pessoal: sem o seletor Pessoal/Trust Care/Consolidado e sem Notebooks. A página força o Pessoal mesmo que a URL peça outro livro, e a pasta Finanças › Trust Care não aparece.
   - As integrações com chave do servidor (O.S. da Trust Care, Meta Ads e IA) recusam membro no servidor.
   - Conferir se algum banco ou cartão recebe lançamentos da Trust Care. Se sim, o saldo passa a ser calculado pelo banco, para ela ver o mesmo número que o Luan.
4. **Ligar e testar com uma conta de teste.**
   - Antes do e-mail dela, testar com um **segundo e-mail Google do Luan** como "membro de teste".
   - Confirmar, com a conta de teste:
     - nada do Trust Care aparece, nem forçando a URL;
     - o banco recusa ler ou gravar no livro Trust Care, mesmo com um formulário forjado;
     - lançar, dar baixa, editar e excluir funcionam, e aparecem para o Luan;
     - o Dízimo, os totais e os saldos são iguais aos do Luan;
     - as outras áreas e rotas voltam para Finanças.
   - **Ações do Luan:** acrescentar o e-mail de teste em `ALLOWED_EMAILS` na Vercel e cadastrar o membro, com o passo a passo pronto.
5. **Ativar a esposa e documentar.**
   - Trocar o e-mail de teste pelo dela, nos mesmos lugares.
   - Ela entra uma vez com o Google, e o Luan confere com ela.
   - Atualizar PLANO, OPERACAO e PRD.

## 5. Riscos

- **Vazamento do Trust Care por esquecimento de um filtro.** Mitigação: a parede fica no banco, por livro, e a etapa 4 testa com uma conta real de membro, inclusive forçando URLs.
- **Números do Luan mudarem.** Mitigação: na etapa 2, comparar o Resumo, o Orçamento, o Dízimo e os saldos antes e depois.
- **Primeiro login dela criando dados soltos.** Mitigação: o ajuste da etapa 1, testado com a conta de teste.
- **IA:** nada de Finanças vai para a IA (`ai_enabled = false`), e isso não muda.
