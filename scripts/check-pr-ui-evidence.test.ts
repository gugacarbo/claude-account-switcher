import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  hasReviewVerdict,
  hasUiEvidenceSection,
  prEvidenceProblems,
  stripHtmlComments,
  uiFilesChanged,
} from "./check-pr-ui-evidence";

const body = (uiChanges: string) => `## What and why

Algo.

${uiChanges}

## Tested on

- [x] \`bun run validate\` pass
`;

const fullSection = `## UI changes

### Tela(s) irmã(s) e reuso

Reusa WindowHeader e tokens.

### Evidências antes/depois

Capturas anexadas.

### Parecer de revisão independente

Ana revisou as capturas antes/depois e aprovou o espaçamento do cabeçalho.
`;

const waiverSection = `## UI changes

### Parecer de revisão independente

Declaração de incapacidade visual: o revisor não pôde inspecionar as capturas;
aprovação visual pendente para um revisor com capacidade visual.
`;

const noVerdictSection = `## UI changes

### Tela(s) irmã(s) e reuso

Reusa WindowHeader.

### Evidências antes/depois

Capturas anexadas.
`;

test("uiFilesChanged seleciona apenas fontes de UI, sem duplicatas", () => {
  expect(
    uiFilesChanged([
      "frontend/src/App.tsx",
      "cmd/main.go",
      "frontend/visual/screens.spec.ts-snapshots/x-linux.png",
      "frontend/src/App.tsx",
      "frontend/visual/README.md",
    ]),
  ).toEqual([
    "frontend/src/App.tsx",
    "frontend/visual/README.md",
    "frontend/visual/screens.spec.ts-snapshots/x-linux.png",
  ]);
});

test("hasUiEvidenceSection exige a seção exata do template", () => {
  expect(hasUiEvidenceSection(fullSection)).toBe(true);
  expect(hasUiEvidenceSection(body("## UI Change"))).toBe(false);
  expect(hasUiEvidenceSection(null)).toBe(false);
});

test("hasReviewVerdict aceita parecer preenchido ou incapacidade declarada", () => {
  expect(hasReviewVerdict(fullSection)).toBe(true);
  expect(hasReviewVerdict(waiverSection)).toBe(true);
  // Seção vazia não é parecer.
  expect(hasReviewVerdict(noVerdictSection)).toBe(false);
  expect(hasReviewVerdict(null)).toBe(false);
});

test("prEvidenceProblems: diff sem UI não exige nada", () => {
  expect(
    prEvidenceProblems({ paths: ["cmd/main.go", "go.mod"], body: null }),
  ).toEqual([]);
});

test("prEvidenceProblems: UI sem seção e sem parecer falha com mensagens específicas", () => {
  const problems = prEvidenceProblems({
    paths: ["frontend/src/App.tsx"],
    body: null,
  });
  expect(problems.length).toBe(2);
  expect(problems[0]).toContain("## UI changes");
  expect(problems[1]).toContain("incapacidade visual");
});

test("prEvidenceProblems: seção com parecer passa; seção sem parecer falha só no parecer", () => {
  expect(
    prEvidenceProblems({ paths: ["frontend/src/App.tsx"], body: fullSection }),
  ).toEqual([]);
  expect(
    prEvidenceProblems({
      paths: ["frontend/src/App.tsx"],
      body: waiverSection,
    }),
  ).toEqual([]);
  const problems = prEvidenceProblems({
    paths: ["frontend/src/App.tsx"],
    body: noVerdictSection,
  });
  expect(problems.length).toBe(1);
  expect(problems[0]).toContain("Parecer");
});

test("stripHtmlComments remove comentários HTML multilinha", () => {
  expect(
    stripHtmlComments("antes <!-- oculto --> depois <!--\nmultilinha\n--> fim"),
  ).toBe("antes  depois  fim");
});

test("template real do repositório (comentários intactos) deve falhar", () => {
  const template = readFileSync(
    new URL("../.github/pull_request_template.md", import.meta.url),
    "utf8",
  );
  expect(template).toContain("## UI changes");
  // Comentários do template não contam como conteúdo preenchido.
  expect(hasReviewVerdict(template)).toBe(false);
  const problems = prEvidenceProblems({
    paths: ["frontend/src/App.tsx"],
    body: template,
  });
  expect(problems.length).toBe(1);
  expect(problems[0]).toContain("Parecer");
  // A seção existe mesmo com comentários ao redor.
  expect(hasUiEvidenceSection(template)).toBe(true);
});

test("seção vazia e com apenas comentários não é parecer; comentário após o parecer não o valida", () => {
  const emptySection = `## UI changes\n\n### Parecer de revisão independente\n\n<!-- preencha aqui -->\n`;
  expect(hasReviewVerdict(emptySection)).toBe(false);
  const commentsOnly = `## UI changes\n\n<!-- tudo comentado -->\n### Parecer de revisão independente\n\n<!-- vazio -->\n`;
  expect(hasReviewVerdict(commentsOnly)).toBe(false);
  // Parecer preenchido seguido do heading "Limitações" não captura o próximo título.
  const verdictThenNextHeading = `### Parecer de revisão independente\n\nAna revisou as capturas.\n\n### Limitações de plataforma\n`;
  expect(hasReviewVerdict(verdictThenNextHeading)).toBe(true);
  const whitespaceOnly = `### Parecer de revisão independente\n\n\t \n\n### Limitações de plataforma\n`;
  expect(hasReviewVerdict(whitespaceOnly)).toBe(false);
});

test("waiver com aprovação pendente passa mesmo com comentários no template", () => {
  const templateWaiver = `## UI changes\n\n### Parecer de revisão independente\n\n<!-- instruções removidas -->\nDeclaração de incapacidade visual: aprovado por testes de cenário e gate check:ui, sem conferência visual de capturas; aprovação visual pendente.\n`;
  expect(hasReviewVerdict(templateWaiver)).toBe(true);
  expect(
    prEvidenceProblems({
      paths: ["frontend/src/App.tsx"],
      body: templateWaiver,
    }),
  ).toEqual([]);
});
