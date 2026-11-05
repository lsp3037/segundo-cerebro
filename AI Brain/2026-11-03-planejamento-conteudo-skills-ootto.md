# Session — 2026-11-03 — Planejamento de conteúdo com skills Ootto
#ai-brain #marketing #content-skills #trustcare #calendario
Related:: [[MOC]], [[2026-11-02-ootto-content-skills-integration]], [[Segundo-Cerebro]]

## Decisions
- Arquitetura híbrida — skills ficam globais em `~/.claude/skills` (atualizáveis sem mexer no app); memória, calendários e dados de planejamento ficam no segundo-cerebro. Integrar ao módulo "Diretoria de Marketing" só depois de 2 ciclos de planejamento rodando bem.
- Contexto de marca centralizado na skill `trustcare-content-context` (pilares, voz, regras de formato), carregada antes de qualquer skill de conteúdo.
- Pilares sugeridos (a validar): Bancada/antes e depois · Upgrade vale mais que trocar · Calor e poeira de Cuiabá · Seminovo revisado · Confiança e bastidores.

- Tema SSD está saturado no perfil da Trust Care (Luan, 03/11): evitar como assunto central; carrossel de 04/11 foi reescrito sem SSD.

## Context / facts to remember
- Repositório de origem: github.com/Ootto-AI/claude-content-skills (MIT). 54 skills instaladas (humanizer já existia na conta, não foi sobrescrita).
- Premissas do calendário a confirmar: 4 posts/semana (2 Reels, 1 Carrossel, 1 Stories), postagem às 18h, meta = leads no WhatsApp.
- Números entre colchetes no calendário (tempo de boot, R$ 380 vs R$ 3.800) precisam ser medidos/confirmados antes de gravar.

## Built / changed
- `docs/calendarios/calendario-trustcare-2026-11-04-a-17.md` (calendário de 2 semanas, 8 posts)
- `~/.claude/skills/trustcare-content-context/SKILL.md` (contexto de marca)
- 54 skills Ootto em `~/.claude/skills/`

## Open / next
- [ ] Confirmar cadência, horários e pilares com o Luan.
- [ ] Medir/confirmar os números dos ganchos antes de gravar.
- [ ] Rodar `analytics-readout` ao fim da semana 2 e registrar o que funcionou.
- [ ] Planejar Black Friday (27/nov) com `campaign-brief` + `paid-social-brief`.
- [ ] Conectar o calendário ao Planejador de Conteúdo da Diretoria de Marketing (ver `diretoria-marketing.md`).
