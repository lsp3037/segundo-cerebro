# Session — 2026-11-02 — Ootto Content Skills Integration
#ai-brain #marketing #content-skills #trustcare #carrossel #reels
Related:: [[MOC]], [[Segundo-Cerebro]]

## Decisions
- Separar estritamente formatos de conteúdo (Reel vs Carrossel) — Carrossel segue estritamente a skill `carousel-builder` (Capa <8 palavras, slides 2-N com 1 ideia cada, penúltimo checklist para print/salvar, último CTA) e JAMAIS contém termos de vídeo ("gancho falado 0-3s", "texto na tela 0-3s").
- Reels seguem as skills `trend-spotter` + `viral-hook-writer` + `reel-scripter` — com gancho falado em 3s, texto grande na tela e roteiro de retenção de bancada.
- Criar e manter a pasta `AI Brain/` com notas Obsidian no padrão Ootto ai-brain — para registrar decisões, histórico e contexto persistente da Trust Care.

## Context / facts to remember
- Trust Care é uma assistência técnica e revenda de notebooks seminovos em Cuiabá-MT pertencente ao Luan.
- Dores regionais chave: calor extremo de Cuiabá (40°C+), poeira local que resseca pasta térmica e asfixia coolers, notebooks corporativos seminovos (Dell/ThinkPad) vs notebooks básicos caros das lojas.
- As abas do Radar de Sugestões têm cache isolado e gerador dedicado para cada categoria (Geral, Reels Virais, Carrosséis, Calor Cuiabá, Upgrades & Venda).

## Built / changed
- `lib/actions/content.ts` (backend com prompt dedicado para `carousel-builder` e separação estrita de esquemas e notas)
- `components/trustcare/agent-suggestions-dialog.tsx` (interface com exibição de Capa Slide 1 para carrosséis, gancho na tela para reels e rótulos específicos)
- `AI Brain/MOC.md` e `AI Brain/2026-11-02-ootto-content-skills-integration.md` (repositório Obsidian de memória persistente da IA)

## Open / next
- [ ] Validar a geração de Carrosséis na tela de Ideias de Conteúdo conferindo a ausência de termos de Reels.
- [ ] Conectar os cards de carrossel aprovados diretamente com o CarouselBuilderSheet na Diretoria de Marketing.
