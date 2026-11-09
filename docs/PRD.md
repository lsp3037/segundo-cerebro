# Segundo Cérebro: documento de produto (PRD)

> Atualizado em 2026-11-01, com as Fases 1 a 4 concluídas.
> Fonte: a especificação original do Luan ([`especificacao-original.md`](especificacao-original.md)) e as decisões tomadas durante o projeto ([`PLANO.md`](PLANO.md)).
> Este documento diz **o que** o sistema faz e **por quê**. O **como** (tecnologia, banco, telas) fica no PLANO.md, e o dia a dia (rodar, testar, resolver problemas) no [`OPERACAO.md`](OPERACAO.md).

---

## 1. Visão

Um lugar só para organizar as quatro frentes da vida do Luan: o trabalho na SES-MT, a vida pessoal, a Trust Care e as finanças. Tudo que chega (tarefa, ideia, link, compromisso, lead) entra rápido, é organizado depois e reaparece quando precisa: no dia, na semana, na agenda ou na revisão de domingo.

## 2. Para quem

**Um único usuário: o Luan.** Mora em Cuiabá-MT e trabalha com apoio administrativo na Saúde Digital da SES-MT. Faz mestrado e é dono da Trust Care (manutenção de PCs, upgrades e revenda de notebooks). É formado em Administração, não em Computação.

Consequências para o produto:
- Não há cadastro, convites nem permissões entre usuários. O acesso é fechado ao e-mail dele.
- O uso principal é no **PC**. O celular serve para consultar e capturar (PWA e Telegram, na Fase 6).
- A linguagem da interface é simples, em português, sem jargão técnico.

## 3. Objetivos

| Objetivo | Como saber que funcionou |
|---|---|
| Capturar sem atrito | Qualquer coisa entra na Caixa de Entrada em poucos segundos (`Alt+N`, `Ctrl+K` ou, na Fase 6, pelo Telegram). |
| Ver o que fazer hoje | A aba **Hoje** junta tarefas do dia, atrasadas, hábitos e agenda. |
| Uma agenda só | Os eventos do Gmail pessoal e da conta da SES aparecem juntos e mudam nos dois sentidos. |
| Atender leads da Trust Care melhor e mais rápido | O Assistente devolve respostas prontas para o WhatsApp, e o histórico mostra o que fecha. |
| Saber se a Trust Care dá lucro | Resumo mensal e lucro por notebook revendido (Fase 5). |
| Manter o sistema em dia | Revisão Semanal guiada no domingo (Fase 5). |

## 4. Fora do escopo

- **Loja online** e **sistema de precificação de notebooks**: são projetos separados. Aqui aparecem só como atalho e como ideias.
- **Gerenciador de O.S.**: é outro sistema. Aqui só lemos um resumo (números), sem editar nada.
- **Enviar mensagens a clientes**: o Assistente de Respostas só sugere. Quem envia é o Luan, no WhatsApp.
- **Integração bancária**: lançamentos manuais. Importar CSV fica como bônus futuro.
- **Uso por outras pessoas**.

## 5. Regras que valem para o sistema todo

1. **Acesso fechado:** só o e-mail do Luan entra. O app confere em três camadas: cadastro desligado, lista no servidor e lista no banco.
2. **Cada dado tem dono:** RLS em todas as tabelas, sem exceção.
3. **Segredos nunca no navegador:** os tokens do Google ficam criptografados e só o servidor lê.
4. **LGPD e IA:**
   - A área **Profissional** nunca guarda dados de pacientes (há um aviso nos formulários) e nunca vai para a IA.
   - Cada área tem a trava "pode ir para a IA". Profissional e Finanças nascem travadas.
   - Antes de qualquer conversa de cliente ir para a IA, telefone, e-mail, CPF, CNPJ, CEP e endereço são **mascarados**. O texto original fica só no banco.
5. **Nada se perde por engano:** excluir manda para a lixeira (`deleted_at`), e dá para restaurar.
6. **Horário de Cuiabá** (UTC-4) em todas as datas.
7. **Dinheiro em centavos** (Fase 5).

## 6. Organização

- **Abas no topo:** Hoje · Agenda · Caixa de Entrada · Ideias · Conhecimento · Aprender · Finanças · Revisão Semanal.
- **Busca `Ctrl+K`** sempre disponível.
- **Árvore lateral por área**, com pastas personalizáveis (criar, renomear, reordenar, subpastas):
  - Profissional › Demandas · Reuniões
  - Pessoal › Demandas · Rotina · Coisas a aprender
  - Trust Care › Atalhos · Diretoria de Marketing (Conteúdo, Campanhas, Meta Ads) · Ideias de Conteúdo · Planejamento de Publicações · Repositório da Empresa · Fluxos de Atendimento · Assistente de Respostas
  - Finanças › Pessoal · Trust Care
- Visual neutro, tema claro e escuro, e uma cor de destaque por área.

## 7. Módulos

Legenda: ✅ entregue · 🟡 entregue em parte · ⏳ fase futura.

### 7.1 Tarefas (Hoje, Semana, Mês) ✅ Fase 2
- Campos: título, área, pasta, prioridade, status, data, horário opcional, repetição e notas.
- Visões Hoje, Semana, Mês, Lista e Kanban, com as atrasadas em destaque.
- Uma tarefa com horário vira bloco na agenda ("Bloquear na agenda", Fase 3).
- **Pronto quando:** dá para criar, repetir, concluir e mover entre status, e a atrasada aparece em destaque.

### 7.2 Hábitos e rotina ✅ Fase 2
- Marcados como feitos a cada dia, com sequência e mapa do mês. Aparecem na aba Hoje.

### 7.3 Agenda (Google, duas vias) ✅ Fase 3
- Duas contas conectadas: o Gmail pessoal e a conta `@ses.mt.gov.br`. Os eventos da SES caem na área Profissional.
- Criar, editar e apagar no app muda o Google, e o caminho inverso aparece em segundos (aviso do Google). Uma rotina de segurança roda a cada 15 minutos.
- Em conflito, vale a última edição, e o conflito fica registrado.
- Visões de dia, semana e mês, com cor por área. Eventos que se repetem são suportados.

### 7.4 Caixa de Entrada ✅ Fase 2
- Captura por botão, `Alt+N` ou `Ctrl+K`. Depois, cada item vira tarefa, nota, ideia, ideia de conteúdo ou aprendizado.
- Botão "Sugerir com IA" para a classificação (respeita a trava por área).

### 7.5 Conhecimento (Repositório) ✅ Fase 2
- Editor rico (BlockNote), tags, área, pasta, links entre notas e anexos privados.
- O **Repositório da Empresa** (serviços, preços, garantia, tom de voz) é a base que o Assistente de Respostas consulta.

### 7.6 Aprender e Ideias gerais ✅ Fase 2
- Aprender: tema, motivo, recursos, status e progresso. Um aprendizado concluído vira nota.
- Ideias gerais ficam separadas das ideias de conteúdo da Trust Care.

### 7.7 Trust Care: Atalhos e resumo de O.S. ✅ Fase 4
- Cards para o Gerenciador de O.S., o Agente de Marketing, a Loja online e outros que o Luan cadastrar.
- O card do Gerenciador mostra **abertas**, **atrasadas** e **aguardando peça**. Ele lê a API do Gerenciador com uma chave **só de leitura** e guarda só os números.
- **Decisão:** "atrasada" é a O.S. aberta há mais de 7 dias, porque a API não informa a data prevista.

### 7.8 Ideias de Conteúdo e Planejamento de Publicações ✅ Fase 4
- Ideias com formato (Reel, carrossel, post, story), pilar, status, notas, referências e tags.
- Calendário editorial e funil (ideia → roteiro → produção → agendado → publicado) para Instagram e Google Meu Negócio.
- **Decisão:** o calendário principal fica no Segundo Cérebro, e o Agente de Marketing vira fonte de sugestões.

### 7.9 Agente de Marketing 🟡 Fase 4 (tomada) / ⏳ Fase 6 (ligação real)
- Já existe a "tomada" (`lib/integrations/marketing-agent`), com sugestões e envio de ideias em versão de teste.
- **Pendente:** o Agente ainda não tem API e roda só no PC. Na Fase 6, combinar rotas, formato e chave. O caminho mais provável é o painel chamar a API do Segundo Cérebro.

### 7.10 Fluxos de Atendimento e Assistente de Respostas ✅ Fase 4
- Fluxos por tipo de serviço: etapas, perguntas, informações a coletar, mensagens-modelo, objeções e próximos passos.
- Assistente: o Luan cola o print da conversa (`Ctrl+V`, arrastar ou selecionar imagem) ou texto, escolhe o fluxo (ou deixa a IA identificar) e recebe de 2 a 3 respostas para o WhatsApp, o próximo passo e o que falta perguntar.
- A IA (Gemini Vision multimodal) lê a imagem diretamente, identifica a dúvida e o serviço e sugere respostas prontas para o WhatsApp no estilo do Luan. O print fica salvo no histórico do caso.
- Histórico com o resultado: fechou, não fechou ou em andamento.

### 7.11 Busca `Ctrl+K` 🟡 Fase 2 (textual) / ⏳ Fase 6 (perguntar à IA)
- Hoje procura em tarefas, notas, ideias gerais, aprendizados e Caixa de Entrada.
- **Pendente:** a especificação pede busca também em **fluxos, eventos e ideias de conteúdo**.
- Fase 6: modo "perguntar", com respostas baseadas no próprio conteúdo, citando as notas. Áreas travadas para a IA nem são indexadas.

### 7.12 Finanças ⏳ Fase 5
- Pessoal: entradas e saídas com categoria, data, forma de pagamento e observação.
- Trust Care: receitas de serviços, custos de peças e **lucro por notebook** (compra + peças/reparo vs. venda).
- Resumo mensal por área, com entradas, saídas, saldo e um gráfico simples. A área nasce travada para a IA.

### 7.13 Revisão Semanal ⏳ Fase 5
- Checklist de domingo:
  - esvaziar a Caixa de Entrada;
  - revisar as atrasadas;
  - planejar a semana;
  - olhar a agenda;
  - revisar as ideias de conteúdo;
  - ver o resumo financeiro.
- Cada revisão fica salva, com anotações.

### 7.14 Bot do Telegram ⏳ Fase 6
- Recebe texto, link e foto e joga na Caixa de Entrada. Aceita só o chat do Luan.
- Comandos `/tarefa`, `/ideia` e `/hoje`.

### 7.15 PWA ⏳ Fase 6
- Instalável no celular, para consulta e captura.

### 7.16 Diretoria de Marketing (Trust Care) ✅ Fase 4
- **Planejador de Conteúdo:** Roteirização rica em 3 formatos: Reels (Gancho 3s, Retenção em bancada, CTA), Stories (Sequência em 4 quadros com enquetes/links) e Carrosséis (Slide a slide com gancho visual). Integração com IA para geração de ideias e roteiros.
- **Campanhas e Matriz de Ângulos:** Agendamento cronológico de campanhas com orçamento em centavos, datas no fuso de Cuiabá, público-alvo e Matriz de Ângulos de copy/anúncios (Dor/Lentidão, Custo-benefício de Upgrade, Confiança/Garantia, etc.).
- **Analisador Meta Ads com MCP e IA:** Painel de KPIs de tráfego pago (Spend, Cliques, CTR, CPC, Leads de WhatsApp, CPL), integração via MCP Meta Ads e diagnóstico executivo gerado por IA com recomendações táticas.

## 8. Roadmap

| Fase | Conteúdo | Situação |
|---|---|---|
| 1. Fundação | Login fechado, layout, temas, cores, banco e RLS | ✅ 2026-10-31 |
| 2. Núcleo | Tarefas, hábitos, Caixa de Entrada, Conhecimento, Aprender, Ideias, busca | ✅ 2026-11-01 |
| 3. Agenda | Google Agenda nas duas contas, duas vias | ✅ 2026-11-01 |
| 4. Trust Care | Atalhos e O.S., conteúdo, publicações, fluxos, assistente | ✅ 2026-11-01 |
| 5. Finanças e Revisão Semanal | Fluxo de caixa, revenda de notebooks, importador OFX e revisão guiada | ✅ 2026-11-09 |
| 6. Extras | Telegram, busca com IA, Agente de Marketing real, PWA | ⏳ |

## 9. Decisões de produto tomadas

| Data | Decisão |
|---|---|
| 2026-10-31 | O login é só pelo Gmail pessoal. A conta da SES serve só para a agenda. |
| 2026-10-31 | O Assistente de Respostas só sugere e mascara os dados pessoais antes da IA. |
| 2026-10-31 | Finanças nasce travada para a IA. |
| 2026-10-31 | Dois bancos de ideias: as gerais e as de conteúdo da Trust Care. |
| 2026-10-31 | Hábitos são marcados a cada dia. Endereço gratuito `*.vercel.app`. |
| 2026-11-01 | O app do Google foi publicado sem verificação (uso pessoal, abaixo de 100 usuários). |
| 2026-11-01 | O resumo de O.S. vem da API do Gerenciador, com chave só de leitura. "Atrasada" = aberta há mais de 7 dias. |
| 2026-11-01 | O calendário de publicações principal é o do Segundo Cérebro. |
| 2026-11-02 | O Assistente de Respostas aceita prints de conversas (Ctrl+V ou upload), analisados diretamente pelo Gemini com visão multimodal. |
| 2026-11-02 | Criação da Diretoria de Marketing na Trust Care: Planejador de Conteúdo (Reels, Stories, Carrosséis), Matriz de Ângulos de Anúncios e Analisador Meta Ads via MCP com IA. |

## 10. Pendências e riscos

| Item | Tipo | Onde decidir ou resolver |
|---|---|---|
| Busca `Ctrl+K` sem fluxos, eventos e ideias de conteúdo | Lacuna da especificação | Próxima fase (sugestão: junto da Fase 5) |
| API do Agente de Marketing | Depende do Agente | Fase 6 |
| Tabela `order_status_transitions` sem RLS no Supabase "Trust Care" | Risco de segurança, **em outro projeto** | No projeto do Gerenciador de O.S. |
| Plano gratuito do Gemini: limites e modelos que mudam | Risco operacional | Modelo reserva já configurado. Acompanhar. |
| A administração da SES pode bloquear apps externos no futuro | Risco | Plano B: compartilhar a agenda da SES com o Gmail |
