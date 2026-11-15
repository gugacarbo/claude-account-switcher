# Epic: UI consistente por construção, com contrato, gates e evidência visual

## Contexto e oportunidade

Adaptar https://github.com/gugacarbo/dscursos-monorepo/issues/302 à escala deste app Wails/React. Preservar a aparência atual e reduzir divergências de UI independentemente do agente que implementa, sem copiar a estrutura de um monorepo.

### Base existente e lacunas observadas

Análise estática local; não constitui execução das suítes ou validação visual/nativa.

| Base existente | Oportunidade |
| --- | --- |
| `frontend/src/shared/WindowHeader.tsx` e organização por features | Consolidar tabela de reuso e evitar cabeçalhos paralelos |
| Tokens claro/escuro em `frontend/src/style.css` | Regras para novas cores e estilos, respeitando valores dinâmicos legítimos |
| `frontend/src/screens.stories.tsx` | Algumas stories reconstroem composição/navegação; adicionar stories do App real |
| `frontend/visual/screens.spec.ts` | Acrescentar overflow, erros inesperados e estados |
| `frontend/playwright.config.ts` | Globalmente 520×720, en-US e claro; stories pontuais escuras/estreitas não equivalem à matriz de telas completas |
| `.github/workflows/visual.yml` | Já roda em PR/main e envia diferenças quando falha; ampliar evidências e definir política de baseline |
| `scripts/check-architecture.ts` | Já verifica imports entre features e acesso direto ao runtime; complementar com regras de UI |
| `.github/pull_request_template.md` | Falta evidência visual, plano de reuso e parecer independente |
| `docs/ui-development.md` e `docs/ui-validation.md` | Consolidar contrato de composição e catálogo atualizado de cenários |

O App já trata conexão pendente, erro e vazio. O objetivo é tornar esses estados reproduzíveis e verificáveis, não presumir que estão ausentes. Inglês e chinês simplificado já fazem parte do produto.

## Resultado da Epic

Alterações de UI reutilizam os padrões existentes, demonstram estados relevantes na composição real e apresentam evidência automatizada e revisão independente. Violações objetivas são bloqueadas por scripts/CI; limitações visuais ou nativas ficam explícitas.

## Escopo e restrições

Inclui frontend, fixtures, Storybook, Playwright, scripts, pre-commit, CI, documentação e fluxo de PR.

- Preservar aparência, comportamento e fronteiras de segurança da bridge.
- Não usar contas, tokens, cookies ou operações reais para validar layout.
- Enforcement em scripts/CI, independente de agente; hooks específicos são auxiliares.
- Não proibir controles HTML nativos ou todo `style` inline: ambos podem ser legítimos aqui.
- Não inferir cobertura de estados apenas buscando nomes no código; preferir cenários executáveis.
- Não introduzir dependências de monorepo, catálogo complexo ou padrões de página sem necessidade comprovada.

## Entregas e critérios de aceite

Proposta de divisão para refinamento; não há issues-filhas criadas, responsáveis ou estimativas definidos.

### E1 — Contrato compacto e inventário de reuso
- [ ] Documentar cabeçalho, conteúdo, ações, espaçamento, tokens, estados, busy/disabled, foco e acessibilidade.
- [ ] Tabela com componentes existentes, localização, uso recomendado e story de referência, incluindo componentes de feature.
- [ ] Definir quando reutilizar, compor ou extrair componente, evitando abstrações sem duplicação comprovada.
- [ ] Documentar idiomas, textos longos, temas e dimensões extraídas das janelas reais.
- [ ] Ligar contrato, documentação de desenvolvimento e catálogo de testes sem fontes conflitantes.

### E2 — Fixtures compartilhadas e stories do App real
- [ ] Bridge de teste reutilizável entre stories/testes, sem acesso a operações nativas reais.
- [ ] Stories de tela renderizam a composição real do App, sem reproduzir sua lógica de navegação.
- [ ] Cobrir conexão pendente, falha inicial, vazio, múltiplas contas, nomes longos, signed-out/erro de uso, busy e erro de comando.
- [ ] Cobrir configurações, threshold válido/inválido e retomada ausente/presente/com lista longa, conforme aplicável.
- [ ] Respostas, eventos e relógio determinísticos; produção continua sem modo de contas fictícias.
- [ ] Manter stories isoladas de componentes onde agregam valor.

### E3 — Matriz visual e qualidade
- [ ] Telas principais em claro/escuro, inglês/chinês e dimensões mínimas/usuais reais; documentar combinações selecionadas e custo de CI.
- [ ] Falhar com overflow horizontal, exceções não tratadas e erros inesperados no console; exceções intencionais são específicas e justificadas.
- [ ] Exercitar navegação, teclado, foco visível e operações desabilitadas.
- [ ] Capturas determinísticas com fontes, relógio e animações estabilizados.
- [ ] Demonstrar que os novos gates detectam falhas introduzidas deliberadamente em fixtures de teste.

### E4 — Catraca de composição e tokens
- [ ] Regras pequenas e testadas para impedir diálogos de browser (`alert`, `confirm`, `prompt`) na UI de produção, cobrindo formas de chamada definidas no contrato.
- [ ] Detectar cores literais novas fora dos locais permitidos e desvios objetivos do padrão de cabeçalho.
- [ ] Nova tela tem cenário verificável ou exceção explícita com motivo.
- [ ] Preservar isolamento entre features e runtime/bridge.
- [ ] Checks têm casos positivos/negativos, escopo claro para testes/stories e mensagens acionáveis.
- [ ] Se houver legado, medir e criar baseline mínimo; impedir crescimento contra merge-base, sem editar allowlist apenas para silenciar regra.
- [ ] Integrar comandos existentes de validação, pre-commit e CI; não depender de hook de agente.

### E5 — Capturas e regressão no CI
- [ ] Comando reproduzível captura tela/story e matriz selecionada, com modo antes/depois.
- [ ] Usar fixtures da bridge; nenhum login/storageState de contas reais.
- [ ] Disponibilizar relatórios, capturas e diferenças como artefatos com retenção explícita.
- [ ] Definir aprovação/atualização de baseline, sem sobrescrita automática para ocultar regressões.
- [ ] Avaliar baseline da main como artefato. Hoje há snapshots no repositório: só migrar após validar recuperação, disponibilidade e comparação da alternativa.
- [ ] Não versionar capturas ad hoc ou dados reais; separar baseline deliberado de evidência temporária.

### E6 — PR e revisão visual independente
- [ ] Template pede tela/story irmã, componentes reutilizados, cenários executados, capturas antes/depois ou lacuna justificada e limitações nativas.
- [ ] Rubrica cobre fidelidade, densidade, espaçamento, hierarquia, estados, acessibilidade, temas e idiomas.
- [ ] Revisão por pessoa/agente diferente do implementador, recebendo referência e capturas, com achados e severidade.
- [ ] Revisor sem inspeção de imagens declara a limitação; análise textual não conta como parecer visual.
- [ ] Check verifica evidências/declaração de lacuna e parecer em PR com diff de UI. Template sozinho não bloqueia.
- [ ] Gates objetivos bloqueiam; parecer visual não bloqueia merge sozinho. Lacunas permanecem explícitas para decisão humana.

### E7 — Contexto de agentes e migração gradual
- [ ] Instruções locais apontam ao contrato e pedem breve plano de reuso antes de alterações de UI.
- [ ] Se adotada skill, referencia o contrato sem duplicá-lo. Hooks Claude Code são opcionais.
- [ ] Inventário começa simples; geração automática somente com benefício comprovado.
- [ ] Medir legado antes de definir lotes; migrar com testes, capturas e revisão, sem crescimento da baseline.
- [ ] Extrair shell/padrões adicionais somente diante de duplicação concreta; não criar ListPage/DetailPage/FormPage por analogia ao monorepo.

### E8 — Validação desktop e catálogo de evidências
- [ ] Atualizar catálogo com comando, cenário, gate e limitações de cada teste.
- [ ] Separar Chromium/fixtures, bridge real descartável e aceitação nativa.
- [ ] Manter checklist Windows/WebView2, macOS/WebKit e Linux/WebKitGTK, incluindo X11/Wayland onde aplicável.
- [ ] Declarar plataformas realmente testadas e pendências de tray, posicionamento, blur/Escape, ciclo de janela, foco/zoom/scroll e integração nativa.
- [ ] Não considerar screenshots Chromium ou cross-compilation como prova de funcionamento nativo.

## Sequência sugerida e dependências a confirmar

| Etapa | Entregas | Dependências propostas |
| --- | --- | --- |
| Cobertura real | E2 e E3 | Fixtures antes da ampliação da matriz |
| Contrato e prevenção | E1 e E4 | Contrato orienta regras; E1 pode avançar junto de E2 |
| Evidência e processo | E5 e E6 | Cenários/capturas reproduzíveis antes da exigência de parecer |
| Consolidação | E7 e E8 | Migração depende dos gates e da revisão; documentação evolui em todas as etapas |

## Critérios de conclusão da Epic

- [ ] Telas principais e estados relevantes estão cobertos na composição real.
- [ ] Matriz de temas/idiomas/dimensões está documentada e executa no CI.
- [ ] Overflow, erros inesperados e violações objetivas são detectados com testes dos próprios gates.
- [ ] Comandos de captura e política de baseline são reproduzíveis e documentados.
- [ ] PRs de UI apresentam evidência ou lacuna justificada e revisão independente.
- [ ] Contrato, inventário e catálogo refletem o fluxo implementado.
- [ ] Nenhuma validação usa credenciais reais; limitações nativas permanecem explícitas.
- [ ] Validações existentes continuam passando; resultados e regressões preexistentes são registrados.

## Evoluções condicionais, fora do bloqueio inicial

Aproveitáveis da issue original, mas dependentes de necessidade medida:

- Inventário gerado quando o catálogo manual ficar oneroso.
- Hooks de edição com feedback imediato e comandos/skills para criar ou migrar telas.
- Evals fixas de criação/migração de tela, com critério objetivo, ao alterar contrato/skill.
- Detecção de clones JSX e microcopy: começar em aviso, medir falsos positivos e adaptar aos idiomas; não importar regras de inglês cegamente.
- Padrões de layout adicionais após identificação de repetição real.
- Hooks gerais de Git/Docker/worktree não pertencem ao objetivo de UI desta Epic.

## Decisões pendentes e riscos

- Confirmar matriz, dimensões e orçamento de execução; evitar produto cartesiano desnecessário.
- Confirmar baseline versionado versus artefato da main, retenção e bootstrap.
- Definir detector de diff de UI e formato de evidência/parecer, inclusive contribuição de forks sem segredos.
- Definir escopo exato das regras, exceções e política de redução de legado após medição.
- Confirmar divisão em issues-filhas e ordem; não há metas numéricas ou prioridade formal definidas.
- Checks heurísticos podem gerar falsos positivos; testes e exceções estreitas são necessários.
- Revisão independente depende de capacidade visual real; automatização não substitui aceitação nativa.
