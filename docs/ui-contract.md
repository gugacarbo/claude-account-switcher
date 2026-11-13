# Contrato de UI

Fonte única de verdade para composição, tokens, estados e cobertura de telas.
Complementa `docs/ui-development.md` (workflow) e `docs/ui-validation.md`
(catálogo de validação); conflitos entre fontes devem ser resolvidos aqui.

Alterações de UI precisam seguir este contrato. As regras objetivas são
aplicadas por `bun run check:ui` (incluído em `validate` e pre-commit); as
regras de julgamento (reuso, densidade, acessibilidade) ficam para revisão.

## Composição de tela

- Toda tela renderiza `shared/WindowHeader` como cabeçalho: título via prop
  `title` (o componente é o único lugar com `<h1>`), ações no slot de ações,
  `children` para conteúdo adicional do cabeçalho.
- Conteúdo abaixo do cabeçalho usa os contêineres `.app`/`.header` existentes;
  não recrie cabeçalhos paralelos.
- Sem diálogos nativos de browser (`alert`, `confirm`, `prompt`) em código de
  produção: estados e confirmações são componentes na própria tela.

## Tokens e cores

- Cores vivem apenas em `frontend/src/style.css` como custom properties
  (`--bg`, `--card`, `--text`, `--muted`, `--line`, `--accent`, `--accent-soft`,
  `--green`, `--shadow`), com variantes claro/escuro em
  `@media (prefers-color-scheme: dark)`.
- Componentes e TS/TSX referenciam cores via `var(--token)`; literais hex novas
  fora de `style.css` falham no gate.
- Valores dinâmicos legítimos (ex.: `--wails-draggable`, tamanhos, espaçamentos)
  podem permanecer inline; a regra cobre cor, não todo `style` inline.

## Estados

- Busy: desabilitar controles (`button:disabled` já padroniza opacidade e
  cursor) e comunicar progresso no campo `note` do estado.
- Erro e vazio: renderizados na composição real da tela, não em modais do
  browser; ver `docs/ui-validation.md` para os cenários catalogados.
- Foco visível: `:focus-visible` global em `style.css` cobre botões e inputs;
  componentes novos não devem removê-lo.

## Idiomas e textos

- Todo texto de UI passa por `t(en, zh)` (`shared/i18n.ts`): inglês e chinês
  simplificado sempre juntos.
- Nomes e títulos longos precisam truncar/quebrar sem estourar a largura; o
  cabeçalho usa `min-width: 0` para permitir isso em filhos flex.

## Temas e dimensões reais das janelas

- Temas: claro e escuro (prefers-color-scheme); nenhum tema fixo no app.
- Dimensões extraídas de `internal/app/desktop_runtime.go`:
  - Telas: 420×640 inicial, mínimo 360×360.
  - Dropdown de tray: mínimo 180×96.
- A matriz visual global do Playwright é 520×720, en-US, claro
  (`frontend/playwright.config.ts`); stories pontuais escuras/estreitas são
  complemento, não matriz completa.

## Cobertura de tela nova

Toda tela ou componente de produção precisa de cenário executável: um teste
com o mesmo basename (`Feature.tsx` → `Feature.test.tsx`). Arquivos de stories
(`*.stories.tsx`) não exigem teste irmão. Sem o teste, o gate `check:ui`
exige uma exceção registrada em `scripts/ui-baseline.json` (`uncovered`), com
motivo explícito. Não adicione exceções apenas para silenciar o gate.

## Crescimento e bootstrap da baseline

A baseline é prune-only: o gate compara a baseline vigente com a do
merge-base entre HEAD e uma ref base explícita — `UI_BASE_REF` (variável de
ambiente) ou `origin/main` por padrão. Entradas novas em `allowed` ou
`uncovered` em relação à base falham o gate; remoções (poda) são permitidas.
Ref base inexistente ou merge-base impossível falha o gate (fail closed).

Bootstrap: se a baseline não existe no commit base, o conjunto vigente é o
inicial explícito e auditado — não pode conter entradas em `allowed` (zero
violações herdadas) e toda entrada em `uncovered` precisa de motivo não
vazio. O bootstrap é um evento único de adoção; após o merge da baseline, vale
a regra de crescimento acima.

## Inventário de reuso

Comece simples: reutilize, compose e só extraia componente com duplicação
comprovada (≥2 ocorrências reais).

| Componente | Local | Uso recomendado | Story de referência |
| --- | --- | --- | --- |
| `WindowHeader` | `frontend/src/shared/WindowHeader.tsx` | Cabeçalho de qualquer tela (drag, fechar, voltar) | `WindowHeaderInteractive`, `UnifiedNavigationStates` |
| `BackIcon` / `CloseIcon` / `SettingsIcon` | `frontend/src/shared/Icons.tsx` | Ícones padronizados de ações | `WindowHeaderInteractive` |
| `t` (i18n) | `frontend/src/shared/i18n.ts` | Todo texto visível (en + zh) | todas |
| `AccountCard` | `frontend/src/features/accounts/AccountCard.tsx` | Cartão de conta na tela principal | `ActiveAccount`, `SignedOut`, `LongTitles` |
| `Meter` | `frontend/src/features/accounts/Meter.tsx` | Barra de uso dentro de `AccountCard` | `ActiveAccount`, `NearlyFull` |
| `Resume` | `frontend/src/features/resume/Resume.tsx` | Tela de retomada de chats | `ResumeChats`, `NoResume` |
| `Settings` | `frontend/src/features/settings/Settings.tsx` | Tela de preferências | `Preferences`, `BusyPreferences` |
| `Threshold` | `frontend/src/features/settings/Threshold.tsx` | Controle de threshold dentro de `Settings` | `SwitchThreshold` |
| `TrayMenu` | `frontend/src/features/tray/TrayMenu.tsx` | Menu do tray (render nativo) | — |

Storybook: `frontend/src/screens.stories.tsx`. Componentes de feature não são
importados entre features (gate `check:architecture`); reuso acontece via
`App.tsx` ou extração para `shared/`.

## Gates objetivos

| Regra | Gate | Baseline |
| --- | --- | --- |
| Diálogos browser em produção | `browser-dialog` | sem exceções permitidas |
| Cor literal fora de `style.css` | `raw-color` | legado existente congelado em `scripts/ui-baseline.json` |
| `<h1>` fora de `WindowHeader` | `header-pattern` | sem exceções permitidas |
| Cobertura de tela nova | teste irmão ou exceção em `uncovered` | exceções listadas com motivo |

Comandos: `bun run check:ui` (verifica), `bun run check:ui -- --prune-baseline`
(remove entradas obsoletas da baseline; nunca adiciona). CI e pre-commit
executam o gate via `validate`/`validate:staged`.
