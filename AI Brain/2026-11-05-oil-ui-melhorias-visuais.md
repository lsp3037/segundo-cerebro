# Session — 2026-11-05 — Melhorias Visuais e de Usabilidade Oil UI
#ai-brain #ui-ux #oil-ui #design-system #usabilidade #segundo-cerebro
Related:: [[MOC]], [[Segundo-Cerebro]]

## Decisions
- Topbar & Abas: reduzir breakpoint de colapso de texto para `hidden md:inline` (em vez de `2xl`), garantindo que em qualquer laptop/tablet todas as 8 seções sejam lidas por extenso sem obrigar o usuário a memorizar ícones.
- Visão Hoje: inverter a ordem responsiva via CSS grid (`order-1 xl:order-2` no aside) para que Agenda do Google e Hábitos do dia fiquem no topo em telas menores (< xl), divididos em `sm:grid-cols-2`, sem que fiquem soterrados após a lista de tarefas.
- Mobile: incluir Floating Action Button (FAB) circular fixo no canto inferior direito (`md:hidden`) para captura rápida de pensamentos e ideias pelo polegar com 1 toque.
- Diretoria de Marketing: eliminar acúmulo de bordas e gradientes ("caixa dentro de caixa"), adotando padrão Stripe/Linear com KPIs expressivos em tipografia limpa.
- Caixa de Entrada: empty state modernizado com CTA primário "Capturar agora (Alt+N)" e diálogo integrado.
- Modo Escuro: aumento da luminosidade de `--muted-foreground` para `oklch(0.76 0 0)` no dark mode para evitar fadiga visual em textos secundários.

## Built / changed
- `components/app-shell/topbar.tsx` (rótulos de abas visíveis em laptops e tablets, tipografia ativa e logo com largura adaptativa)
- `components/tasks/tasks-board.tsx` & `app/(app)/hoje/page.tsx` (Agenda do Google e Hábitos acessíveis no topo em telas < xl via grid responsivo)
- `components/app-shell/app-shell.tsx` (FAB flutuante de captura rápida para celulares)
- `components/trustcare/marketing/marketing-director-hub.tsx` (header executivo limpo, sem ruído de caixilhos)
- `components/inbox/inbox-list.tsx` (empty state com botão centralizado de captura rápida)
- `app/globals.css` (contraste aprimorado no tema escuro)
