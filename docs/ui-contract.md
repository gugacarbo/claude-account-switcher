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
  - Dropdown de tray: 340 de largura, altura calculada pelo número de contas
    (`menuHeight`, até 6 linhas antes de rolar), mínimo 180×96.
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
| `TrayMenu` | `frontend/src/features/tray/TrayMenu.tsx` | Dropdown do tray: resumo das contas, troca com um clique, Abrir/Sair | — |

Storybook: `frontend/src/stories/`, separado entre `app/`, `components/` e `variants/`. Componentes de feature não são
importados entre features (gate `check:architecture`); reuso acontece via
`App.tsx` ou extração para `shared/`.

## shadcn/ui (kit de primitives)

Instalado via CLI (`components.json` em `frontend/`, estilo `radix-nova`,
biblioteca Radix). Primitives em `frontend/src/components/ui/`, importáveis
por `@/components/ui/<nome>`; `cn` vem de `@/lib/utils`. Componentes
adicionados espelham o que as telas usam: `button`, `card`, `progress`,
`checkbox`, `slider`, `input`, `label`, `badge`, `avatar`, `separator`,
`alert`. As telas (`App`, `WindowHeader`, accounts, settings, threshold,
resume) já consomem esses primitives; a aparência continua vindo das
classes unlayered do app, que vencem as utilities do kit (E7 da epic). O
dropdown do tray usa o design de troca rápida de perfil (botões nativos,
navegação por teclado) e ainda não foi migrado para o kit.

Regras de integração (todas verificadas por gate ou teste irmão):

- Tailwind v4 entra **sem preflight** (`@layer theme, base, …` +
  `tailwindcss/theme.css` + `tailwindcss/utilities.css` em `style.css`): o
  reset do app e a matriz visual versionada não mudam. Os defaults globais
  do app (`button`, `input`, foco) vivem em `@layer base` para que as
  utilities vençam nos componentes shadcn sem afetar as telas atuais.
- Tema escuro segue `prefers-color-scheme` (`@custom-variant dark` por
  media query); não existe classe `.dark`.
- Tokens semânticos do shadcn (`--background`, `--primary`, `--border`,
  `--ring`, `--destructive`…) são derivados dos tokens do app em
  `style.css`. Colisões de nome preservam o significado do app: `--muted`
  continua sendo texto secundário e `--accent` o terracota da marca; as
  utilities de superfície mapeiam `bg-muted → --line` e
  `bg-accent → --accent-soft` no `@theme inline`.
- Cada componente de `components/ui` tem teste irmão (regra de cobertura
  abaixo vale igual para o kit) e nenhum hex literal fora de `style.css`.
- Bases aparadas (desvio deliberado, mantido em reinstall): para preservar
  os pixels versionados, a base de cada primitive foi reduzida ao mínimo
  estrutural (`data-slot` + estrutura Radix), deferindo sizing/cor/borda/raio
  às classes do app — ex.: `.setting [data-slot="checkbox"]`,
  `.threshold-card [data-slot="slider"]`, `.meter [data-slot="progress"]`.
  As variantes nomeadas (`variant`/`size` do `Button`) permanecem para telas
  novas. `Progress` repassa `value` ao Root (aria-valuenow); o `Slider`
  encaminha `aria-label`/`aria-labelledby` ao thumb (role=slider focável); o
  import de `cn` passa por `@/lib/utils`.

Para adicionar um componente: `bunx --bun shadcn@latest add <nome>` em
`frontend/`, criar o teste irmão, revisar tokens/classes geradas contra
este contrato e rodar `bun run validate` + `bun run test:visual`.

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

## Evidência em PRs de UI

PRs que alteram `frontend/src` ou snapshots em `frontend/visual/**-snapshots/`
precisam, no corpo, da seção `## UI changes` do template (tela irmã/reuso,
evidências antes/depois e parecer de revisão independente OU declaração
explícita de incapacidade visual, com aprovação visual pendente). O gate
`bun run check:pr-evidence` (workflow `pr-ui-evidence`) atesta a existência
dessas seções — **não** valida o conteúdo nem garante aprovação visual, que
permanece responsabilidade do revisor humano.

Limitações da matriz visual: o Playwright executa Chromium headless em
Linux CI (520×720, en-US, claro). Ele **não** executa Windows (WebView2),
macOS (WebKit) nem Linux GTK/WebKit nativos; comparação de pixels entre
essas renderizações não é coberta e não deve ser afirmada em PRs. Aceitação
visual nativa segue o checklist de `docs/ui-development.md`.
