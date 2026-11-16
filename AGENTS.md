# AGENTS.md — contexto para agentes de código

Projeto: claude-account-switcher (Wails 3 + React 19 + Go). Bun 1.4.3 no
workspace raiz. Leia `docs/ui-contract.md` antes de qualquer mudança de UI.

## Comandos principais

- `bun run validate` — bateria local completa (lint, typecheck, vet, testes
  de UI/Go, build, knip, gates `check:ui`/`check:contract`).
- `bun run check:ui` — gate objetivo de contrato de UI (baseline prune-only
  contra merge-base com `origin/main`; requer histórico completo).
- `bun run check:pr-evidence` — gate de evidência de UI no corpo do PR
  (seção `## UI changes` + parecer independente ou waiver de incapacidade
  visual). Apenas em CI de `pull_request`.
- `bun run test:tools` — testes unitários de `scripts/` (inclui
  `check-ui.test.ts` e `check-pr-ui-evidence.test.ts`).
- `bun run test:visual` — matriz Playwright; baselines em
  `frontend/visual/**-snapshots/` são versionadas e só mudam por revisão
  explícita do diff de imagem.

## Plano de reuso antes de nova tela/componente

1. Consulte o inventário de reuso em `docs/ui-contract.md`; reutilize
   `WindowHeader`, ícones compartilhados, `t()` (i18n en+zh) e tokens de cor.
2. Só extraia componente compartilhado com ≥2 ocorrências reais.
3. Componentes de feature não importam entre features; reuso via `App.tsx`
   ou `shared/` (gate `check:architecture`).
4. Tela/componente novo de produção exige teste irmão
   (`Feature.tsx` → `Feature.test.tsx`) ou exceção justificada em
   `scripts/ui-baseline.json` (`uncovered`).

## Catálogo de cenários visuais

Matriz atual (Playwright, Chromium headless, Linux CI): 520×720, en-US,
claro — cenários `active-account`, `signed-out`, `busy-preferences`,
`preferences`, `switch-threshold`, `resume-chats`, `no-resume`,
`nearly-full` (`frontend/visual/screens.spec.ts`). Stories pontuais
escuras/estreitas em `frontend/src/screens.stories.tsx` são complemento.

## Limitações — não finja execução nativa

O Chromium do CI não executa Windows (WebView2), macOS (WebKit) nem
GTK/WebKit nativo do Linux: fontes, scrollbars e DPR diferem. Nunca
afirme validação visual nativa sem tê-la executado; deixe pendente no
checklist de `docs/ui-development.md` e, no corpo do PR, use a declaração
de incapacidade visual/aprovação pendente do template.

## Extensão da bandeja (GNOME Shell)

`packaging/gnome-shell/claude-account-switcher@snlperstripes.github.com` não
recarrega com `gnome-extensions disable/enable`: o shell importa o módulo uma vez
por processo e mantém em cache, e recusa uma versão diferente com "You need to
log out for changes to take effect" (`extensionSystem.js`, `_canLoad`). Mudança
na extensão só vale depois de logout/login — não afirme efeito sem essa sessão
nova. Wails 3.1.0 ignora `Title` em janelas frameless (`linux_purego_gtk3`), por
isso a extensão identifica o dropdown pelo PID do bus name
(`org.kde.StatusNotifierItem-<pid>-n`) e pelo menor tamanho de janela mapeada;
o que ela fez fica em `/tmp/claude-switcher-tray.log` (`log()` não chega ao
`journalctl`). No Wayland o compositor ignora posição pedida pelo cliente: só o
`move_frame` da extensão ancora o dropdown.

## Evoluções condicionais (fora de escopo agora)

Armazenamento alternativo de snapshots (ex.: S3/GH Pages), matriz multiresolução/tema
e comparação entre navegadores: dependem de infraestrutura comprovada;
não implemente sem decisão explícita.
