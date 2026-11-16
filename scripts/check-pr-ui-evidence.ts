/**
 * Gate de evidências de UI em PRs (CI apenas).
 *
 * Verifica que PRs cujo diff toca fontes de UI (`frontend/src`, snapshots em
 * `frontend/visual/**-snapshots/`) trazem no corpo a seção "## UI changes"
 * do template, com parecer de revisão independente OU declaração explícita
 * de incapacidade visual. O gate atesta a EXISTÊNCIA da declaração — não
 * valida o conteúdo nem garante aprovação visual, que segue sendo do revisor.
 *
 * Segurança: usa o evento `pull_request` (não `pull_request_target`), lê o
 * corpo do PR apenas via payload da API (`GITHUB_EVENT_PATH`, já sanitizado
 * pela GitHub) e não expõe secrets. O checkout padrão desse evento executa
 * o script deste PR, porém com permissões read-only do workflow
 * (contents/pull-requests: read), que é a fronteira de confiança aceita.
 * A baixa fidelidade do corpo de PR (fácil de escrever) é documentada como
 * limitação: o gate é necessário, não suficiente.
 */
const UI_PATH_PREFIXES = ["frontend/src/", "frontend/visual/"];
const SECTION = "## UI changes";
const ACKNOWLEDGED =
  /incapacidade visual|visual impairment|unable to (visually )?(inspect|review|verify)|sem confer[êe]ncia visual|no visual (inspection|review|verification)|visual review pending|aprova[çc][ãa]o visual pendente/i;
const OPINION =
  /### Parecer de revis[ãa]o independente[^\S\n]*\n(?:[^\S\n]*\n)*(?!\s*#)\S/;

/** Remove comentários HTML `<!-- ... -->` (incluindo multilinha). */
export function stripHtmlComments(body: string): string {
  return body.replace(/<!--[\s\S]*?-->/g, "");
}

function isUiPath(path: string): boolean {
  return UI_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/** Commits no diff do PR que tocam fontes de UI. */
export function uiFilesChanged(paths: string[]): string[] {
  return [...new Set(paths.filter(isUiPath))].sort();
}

/** Corpo do PR contém a seção obrigatória com parecer ou incapacidade declarada. */
export function hasUiEvidenceSection(body: string | null): boolean {
  if (!body) return false;
  return stripHtmlComments(body).includes(SECTION);
}

/** Há parecer independente preenchido ou incapacidade visual declarada. */
export function hasReviewVerdict(body: string | null): boolean {
  if (!body) return false;
  const cleaned = stripHtmlComments(body);
  return OPINION.test(cleaned) || ACKNOWLEDGED.test(cleaned);
}

export interface PrEvidenceInput {
  paths: string[];
  body: string | null;
}

/** Mensagens de falha; vazio significa gate satisfeito ou não aplicável. */
export function prEvidenceProblems({ paths, body }: PrEvidenceInput): string[] {
  const uiFiles = uiFilesChanged(paths);
  if (uiFiles.length === 0) return [];
  const problems: string[] = [];
  if (!hasUiEvidenceSection(body)) {
    problems.push(
      `PR altera UI (${uiFiles.slice(0, 5).join(", ")}${uiFiles.length > 5 ? ", …" : ""}) sem a seção "## UI changes" do template de PR`,
    );
  }
  if (!hasReviewVerdict(body)) {
    problems.push(
      'PR altera UI sem "Parecer de revisão independente" preenchido nem declaração explícita de incapacidade visual (a seção pode declarar "aprovação visual pendente")',
    );
  }
  return problems;
}

async function main(): Promise<number> {
  const eventName = process.env.GITHUB_EVENT_NAME;
  const payloadPath = process.env.GITHUB_EVENT_PATH;
  // Local/fora de PR: nada a verificar (o gate é específico de PR no CI).
  if (eventName !== "pull_request" || !payloadPath) {
    console.log("check-pr-evidence: fora de pull_request; nada a verificar");
    return 0;
  }
  let payload: {
    pull_request?: { body?: string | null; number?: number };
  };
  try {
    payload = JSON.parse(await Bun.file(payloadPath).text());
  } catch (error) {
    console.error(
      `check-pr-evidence: payload do evento ilegível: ${error instanceof Error ? error.message : error}`,
    );
    return 1;
  }
  const pr = payload.pull_request;
  if (!pr) {
    console.log("check-pr-evidence: evento sem pull_request; nada a verificar");
    return 0;
  }

  const diff = Bun.spawn(["git", "diff", "--name-only", "origin/main...HEAD"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(diff.stdout).text(),
    new Response(diff.stderr).text(),
  ]);
  if ((await diff.exited) !== 0) {
    console.error(
      `check-pr-evidence: git diff contra origin/main falhou: ${stderr.trim()}`,
    );
    console.error(
      "check-pr-evidence: garanta checkout com fetch-depth: 0 (origin/main e merge-base disponíveis)",
    );
    return 1;
  }
  const paths = stdout.split("\n").filter(Boolean);
  const problems = prEvidenceProblems({ paths, body: pr.body ?? null });
  for (const problem of problems)
    console.error(`check-pr-evidence: ${problem}`);
  if (problems.length > 0) {
    console.error("check-pr-evidence: falhou (evidência de UI ausente)");
    return 1;
  }
  console.log(
    `check-pr-evidence: OK (PR #${pr.number}; ${paths.length} arquivos no diff)`,
  );
  return 0;
}

if (import.meta.main) {
  process.exit(await main());
}
