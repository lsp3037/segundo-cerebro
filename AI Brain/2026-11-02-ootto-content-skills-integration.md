# Session — 2026-11-02 — Ootto Content Skills Integration
#ai-brain #marketing #content-skills #trustcare #carrossel #reels
Related:: [[MOC]], [[Segundo-Cerebro]]

## Decisions
- Separar estritamente formatos de conteúdo (Reel vs Carrossel) — Carrossel segue estritamente a skill `carousel-builder` (Capa <8 palavras, slides 2-N com 1 ideia cada, penúltimo checklist para print/salvar, último CTA) e JAMAIS contém termos de vídeo ("gancho falado 0-3s", "texto na tela 0-3s").
- Reels seguem as skills `trend-spotter` + `viral-hook-writer` + `reel-scripter` — com gancho falado em 3s, texto grande na tela e roteiro de retenção de bancada.
- Criar e manter a pasta `AI Brain/` com notas Obsidian no padrão Ootto ai-brain — para registrar decisões, histórico e contexto persistente da Trust Care.
- Blindar a ação `createContentIdea` com `user_id: user.id` explícito e `status: "idea"` default, além de feedback visual imediato (`addingRef`, spinner e `toast.success`).
- Injetar no prompt da IA diretrizes anti-genéricas de alta precisão ancoradas em 2026: valores reais em R$ (R$ 380 upgrade vs R$ 3.800 novo), 42°C de Cuiabá com poeira avermelhada de MT, thermal throttling (0.79 GHz), e marcas de peças reais (Kingston NV2, Crucial, SnowDog).
- Implementar a aba e formato dedicado de Stories seguindo a skill `story-sequencer`: arco de 4 quadros (Gancho com Enquete interativa -> Sintoma real -> Solução técnica de bancada -> The Tap / CTA com link ou caixinha de perguntas).
- Blindar geração contra travamento infinito (loading eterno): no frontend, envolver `fetchFocus` em bloco `try ... finally { setLoading(false) }`; no backend, envolver requisições da IA com `withTimeout(..., 12000)` caindo suavemente para os modelos validados da Trust Care sem congelar o modal.

## Context / facts to remember
- Trust Care é uma assistência técnica e revenda de notebooks seminovos em Cuiabá-MT pertencente ao Luan.
- Dores regionais chave: calor extremo de Cuiabá (40°C+), poeira local que resseca pasta térmica e asfixia coolers, notebooks corporativos seminovos (Dell/ThinkPad) vs notebooks básicos caros das lojas.
- As abas do Radar de Sugestões têm cache isolado e gerador dedicado para cada categoria: Geral (Hype), Reels Virais, Carrosséis, Stories, Calor Cuiabá, Upgrades & Venda.

## Built / changed
- `lib/actions/content.ts` (backend com suporte completo a Stories via `story-sequencer`, timeout de proteção de 12s, prompt dedicado para `carousel-builder` e banco de fallbacks hiper-específicos de Cuiabá)
- `components/trustcare/agent-suggestions-dialog.tsx` (adicionada aba Stories com ícone de smartphone, visualização de Enquete/Sticker nos cards, proteção `try/finally` para nunca travar o loading e limpeza de cache ao forçar nova geração)
- `components/trustcare/content-ideas-board.tsx` (notificação de sucesso após inserção no quadro)
- `AI Brain/MOC.md` e `AI Brain/2026-11-02-ootto-content-skills-integration.md` (repositório Obsidian de memória persistente da IA)

## Open / next
- [x] Corrigir a ação do botão Adicionar com feedback visual e inserção garantida.
- [x] Eliminar respostas genéricas ancorando em 2026 com dados de hardware e números reais de Cuiabá.
- [x] Adicionar aba dedicada de Stories com a skill `story-sequencer` (4 quadros + enquetes reais).
- [x] Destravar o modal de geração com timeout de segurança e garantia de liberação de loading no frontend.
- [ ] Conectar os cards de carrossel aprovados diretamente com o CarouselBuilderSheet na Diretoria de Marketing.
