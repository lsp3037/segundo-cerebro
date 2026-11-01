# Prompt — Segundo Cérebro do Luan

> Cole este prompt no Claude Code (de preferência em **Plan Mode**) dentro de uma pasta vazia do novo repositório.

---

## Contexto

Sou Luan, de Cuiabá-MT. Tenho três frentes de vida e quero um **Segundo Cérebro** pessoal (uso só meu) que organize tudo num lugar:

1. **Profissional** — apoio administrativo no setor de Saúde Digital da SES-MT.
2. **Pessoal** — rotina, estudos (mestrado), aprendizados, vida pessoal.
3. **Trust Care - Consultoria em T.I** — minha empresa solo de manutenção de PCs, upgrades e revenda de notebooks.
4. **Finanças** — pessoal e da Trust Care.

Não sou da área de Computação (sou de Administração), então explique decisões técnicas importantes de forma simples e me pergunte quando algo depender de mim.

## Stack (obrigatória)

- **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui**
- **Supabase**: Postgres, Auth, RLS, Storage, pgvector, Edge Functions, pg_cron
- **Vercel** para deploy, código no **GitHub**
- **Gemini API (free tier)** via SDK oficial `@google/genai`, com o modelo configurável por variável de ambiente e uma camada `lib/ai` que permita trocar de provedor no futuro
- Uso principal no **PC** (desktop-first), mas responsivo e instalável como PWA para consultas no celular

## Acesso e segurança

- Usuário único: login com Supabase Auth (Google ou e-mail), aceitando **apenas o meu e-mail** (lista permitida em variável de ambiente).
- RLS ativa em todas as tabelas.
- Tokens do Google guardados de forma segura (nunca no front).
- **LGPD**: a área Profissional nunca guarda dados de pacientes. Mostre um aviso discreto nos formulários dessa área. Não envie conteúdo da área Profissional para o Gemini free tier (os dados podem ser usados pelo Google para melhorar produtos); deixe isso como configuração por área.

## Estrutura de navegação (referência: site Bench Promos, do Lucas Ishi)

- **Barra superior com abas**: Hoje · Agenda · Caixa de Entrada · Ideias · Conhecimento · Aprender · Finanças · Revisão Semanal
- **Busca global `Ctrl+K`** no topo (ver módulo de busca).
- **Barra lateral em árvore de pastas recolhíveis**, filtrando o conteúdo pela área:
  - Profissional › Demandas · Reuniões
  - Pessoal › Demandas · Rotina · Coisas a aprender
  - Trust Care › Atalhos · Ideias de Conteúdo · Planejamento de Publicações · Repositório da Empresa · Fluxos de Atendimento · Assistente de Respostas
  - Finanças › Pessoal · Trust Care
- Pastas personalizáveis (criar, renomear, reordenar, subpastas).
- Visual **neutro, com tema claro/escuro**, e cada área com sua **cor de destaque** (configurável). Limpo, denso o suficiente para uso no PC, sem cara de template.

## Módulos

### 1. Hoje / Semana / Mês (demandas)
- Tarefas com: título, área, pasta, prioridade, status, data, horário opcional, recorrência, notas.
- Visões: **Hoje**, **Semana** e **Mês**, além de lista e kanban por status.
- Tarefas atrasadas em destaque.
- Tarefa com horário pode ser enviada para a agenda como bloco de tempo.

### 2. Agenda (sincronização em duas vias com o Google Agenda)
- OAuth do Google com escopo de Calendar.
- Compromissos, tarefas com horário e **rotinas** (eventos recorrentes).
- Duas vias: criar/editar/excluir no sistema reflete no Google, e mudanças no Google aparecem no sistema.
- Use sincronização incremental (`syncToken`) + notificações push do Google (canais `watch`) num endpoint webhook, com renovação dos canais e uma sincronização de segurança periódica via **Supabase pg_cron** (verifique os limites de cron do plano Hobby da Vercel antes de usar cron da Vercel).
- Resolver conflitos pela última edição e registrar em log.
- Visões de dia, semana e mês, com cor por área.

### 3. Caixa de Entrada rápida
- Campo único sempre acessível (atalho de teclado) para jogar qualquer coisa: ideia, tarefa, link, anotação.
- Depois eu classifico: vira tarefa, nota, ideia de conteúdo, conhecimento ou item de aprendizado, em qualquer área.
- Botão opcional "sugerir classificação" com Gemini.

### 4. Bot no Telegram (captura pelo celular)
- Bot que recebe minhas mensagens (texto, link, foto) e joga na Caixa de Entrada.
- Aceitar apenas o meu chat ID.
- Webhook numa Edge Function do Supabase ou rota da Vercel.
- Comandos simples: `/tarefa`, `/ideia`, `/hoje` (lista as tarefas do dia).

### 5. Ideias de Conteúdo + Planejamento de Publicações (Trust Care)
- Banco de ideias de conteúdo (título, formato: Reel/carrossel/post/story, pilar, status, notas, referências).
- **Calendário editorial** para **Instagram** e **Google Meu Negócio**: data, canal, legenda, status (ideia → roteiro → produção → agendado → publicado).
- **Integração com meu Agente de Marketing** (app próprio com API): criar um adaptador em `lib/integrations/marketing-agent` que envia ideias e recebe sugestões. Endpoint e chave ficam em variáveis de ambiente (`MARKETING_AGENT_URL`, `MARKETING_AGENT_KEY`). **Antes de implementar, me pergunte o formato da API** (rotas, payload, autenticação); até lá, deixe o adaptador com interface definida e um mock.

### 6. Repositório de Conhecimento
- Notas em Markdown com editor rico (ex: Tiptap ou BlockNote), tags, área, pasta e links entre notas.
- Usos: conhecimentos de T.I., repositório da empresa Trust Care (serviços, preços, políticas, garantia, tom de voz), notas de reuniões da SES-MT.
- Anexos no Supabase Storage.

### 7. Aprender
- Lista de coisas a aprender: tema, motivo, recursos (links), status, progresso.
- Possibilidade de transformar um aprendizado concluído em nota no Repositório.

### 8. Trust Care — Atalhos
- Cards de atalho para: Gerenciador de O.S., Agente de Marketing, Loja online (site), Sistema de precificação de notebooks.
- **Card do Gerenciador de O.S. com resumo**: O.S. abertas, atrasadas e aguardando peça, lidas do Supabase do Gerenciador (outro projeto). Usar um cliente Supabase separado, **somente leitura**, com credenciais próprias em variáveis de ambiente. **Me pergunte os nomes das tabelas/colunas antes de implementar**.
- A loja online e a precificação **não** são módulos deste sistema, são projetos separados; aqui entram só como atalho e como ideias/projetos.

### 9. Fluxos de Atendimento + Assistente de Respostas (Trust Care)
- **Fluxos de atendimento por tipo de serviço** (ex: formatação, limpeza/manutenção, upgrade SSD/RAM, diagnóstico, notebook à venda): etapas, perguntas a fazer, informações a coletar, mensagens-modelo, objeções comuns e próximos passos.
- **Assistente de Respostas**: eu colo o caso do Lead/Cliente (texto da conversa do WhatsApp e/ou print), escolho o tipo de serviço (ou deixo a IA identificar) e o Gemini, usando o fluxo correspondente + o Repositório da empresa como contexto, devolve:
  - 2 ou 3 opções de resposta prontas para o WhatsApp (tom humano, em primeira pessoa, direto, sem cara de propaganda);
  - o próximo passo recomendado no funil;
  - informações que ainda faltam perguntar.
- Histórico dos casos, com marcação do resultado (fechou / não fechou / em andamento) para eu melhorar os fluxos depois.

### 10. Finanças
- **Pessoal**: entradas e saídas com categoria, data, forma de pagamento e observação.
- **Trust Care**: caixa e lucro — receitas de serviços, custos de peças, e **compra e revenda de notebooks** (custo de compra + peças/reparo vs. preço de venda = lucro por aparelho).
- Resumo mensal por área: entradas, saídas, saldo e gráfico simples.
- Sem integração bancária (lançamento manual, com importação de CSV como bônus futuro).

### 11. Revisão Semanal guiada
- Checklist de domingo: esvaziar a Caixa de Entrada, revisar tarefas atrasadas, planejar a semana seguinte, olhar a agenda, revisar ideias de conteúdo e o resumo financeiro da semana.
- Salvar cada revisão com anotações para histórico.

### 12. Busca global com IA (`Ctrl+K`)
- Busca textual instantânea em tarefas, notas, ideias, fluxos e eventos.
- Modo "perguntar": pergunta em linguagem natural respondida com base no meu próprio conteúdo (RAG com embeddings do Gemini + pgvector), citando as notas usadas e respeitando a configuração de áreas que não vão para a IA.

## Fases de entrega

Trabalhe em fases, com um commit por etapa e o app funcionando ao fim de cada fase:

1. **Fundação**: projeto, Supabase, Auth com e-mail permitido, layout (abas + árvore lateral), temas claro/escuro, cores por área, modelo de dados e RLS.
2. **Núcleo**: tarefas (Hoje/Semana/Mês), Caixa de Entrada, Repositório de Conhecimento, Aprender.
3. **Agenda**: Google Agenda em duas vias.
4. **Trust Care**: atalhos + resumo de O.S., Ideias de Conteúdo, Planejamento de Publicações, Fluxos de Atendimento, Assistente de Respostas.
5. **Finanças** e **Revisão Semanal**.
6. **Extras**: bot do Telegram, busca com IA, integração real com o Agente de Marketing, PWA.

## Como quero que você trabalhe

1. Comece **sem escrever código**: leia este prompt, proponha o modelo de dados (tabelas e relações), a estrutura de pastas do projeto e o plano da Fase 1, e liste as dúvidas que tiver.
2. Espere minha aprovação antes de executar cada fase.
3. Crie um `README.md` com passo a passo de configuração (Supabase, Google Cloud OAuth, Gemini, Telegram, Vercel) explicado de forma simples, e um `.env.example` com todas as variáveis.
4. Quando eu precisar fazer algo fora do código (criar chave, configurar OAuth etc.), me dê **uma ação por vez**, bem detalhada.
5. Ao fim de cada fase, me diga o que testar e como.
