## What and why

<!-- What does this change, and what problem does it solve? Link the issue if there is one. -->

## Upstream provenance (if applicable)

<!-- For an upstream incorporation: link the original commits, explain whether
     cherry-picked or adapted, and update docs/upstream-tracking.md with decisions.
     Advance its checkpoint only after the entire reviewed range is accounted for. -->

## UI changes

<!-- Obrigatório quando o diff toca `frontend/src` ou snapshots em
     `frontend/visual/**-snapshots/` (o gate de evidências aponta o que falta).
     Preencha uma das três saídas abaixo; remover o bloco sem alteração de UI
     é aceitável. O gate confere a existência do parecer — ele não garante a
     aprovação visual, que continua sendo responsabilidade do revisor. -->

### Tela(s) irmã(s) e reuso

<!-- Que tela existente é irmã desta mudança? O que foi reutilizado do
     inventário de `docs/ui-contract.md` (WindowHeader, tokens, i18n,
     componentes de feature)? Se nada, justifique por que não se aplica. -->

### Evidências antes/depois

<!-- Capturas antes/depois em todos os cenários afetados (Storybook local
     `bun run storybook` ou artefatos `visual-screenshots` do CI). Se houve
     diff visual intencional, anexe as imagens e descreva a mudança; se não
     houve, indique os cenários conferidos. -->

### Parecer de revisão independente

<!-- Cite o parecer de quem NÃO escreveu o código (nome + ponto verificado),
     OU declare explicitamente incapacidade visual: quem revisou não pôde
     inspecionar as imagens; nesse caso, aponte limites concretos (ex.:
     aprovado por testes de cenário e gate `check:ui`, sem conferência
     visual de capturas) e deixe a aprovação visual pendente para um
     revisor com capacidade visual. -->

### Limitações de plataforma

<!-- Chromium em Linux CI não executa Windows (WebView2), macOS (WebKit)
     nem Linux GTK/WebKit nativos: não declare validação nativa sem tê-la
     feito. Liste o que ficou pendente para o checklist de
     `docs/ui-development.md`. -->

## Tested on

- [ ] Windows, Microsoft Store Claude
- [ ] Windows, direct download Claude
- [ ] macOS
- [ ] `bun run validate` and `bun run build` pass
- [ ] Relevant desktop/platform validation performed (describe results and limitations)
