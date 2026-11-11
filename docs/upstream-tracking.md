# Upstream tracking

## Policy

This fork has its own product direction. `origin/main` is the canonical branch
for this project; `upstream/main` is a source of changes to evaluate, not a branch
that must be merged in full. Keep the GitHub fork relationship, Git history,
Apache 2.0 license, and original attribution in `NOTICE`.

- `origin`: https://github.com/gugacarbo/claude-account-switcher
- `upstream`: https://github.com/SnlperStripes/claude-account-switcher

Use selective incorporation by default. Do not automatically merge upstream or
replace fork files with upstream versions. A full merge is an exception requiring
an explicit decision after reviewing the complete incoming range.

### What to prioritize

| Area | Default approach |
| --- | --- |
| Authentication, crypto, cookie handling, Claude compatibility | Prioritize review; incorporate applicable fixes with regression tests |
| Session synchronization, switching rules, platform reliability | Evaluate against this fork's behavior and incorporate compatible changes |
| Legacy native tray/dialog UI | Skip, or port the intended behavior to Wails/React |
| Versions, updater repository, release links, winget manifests | Preserve fork ownership and release policy; do not copy automatically |
| Unwanted features or incompatible architecture | Skip and record the reason |

Keep core Go behavior separate from the UI service and Wails/React presentation
so future fixes can be incorporated without bringing back the old UI. Never
expose authentication data through the frontend bridge to simplify a port.

## Review workflow

Review periodically and when a Claude update causes compatibility problems.
Fetching does not modify the working tree:

```sh
git fetch upstream
git log --reverse --oneline <last-reviewed-sha>..upstream/main
git show <candidate-sha>
```

Use the checkpoint below, not `main..upstream/main` alone: cherry-picks and ports
have different commit IDs even when their behavior has already been incorporated.
Inspect candidate dependencies, surrounding code, tests, and later upstream fixes.

For accepted work, start a dedicated branch from current `origin/main` after
checking for and protecting local work. Choose one of:

- **Independent commit:** `git cherry-pick -x <upstream-sha>` records its origin.
- **Architecture-dependent change:** implement a port with a regression test and
  record `Adapted from SnlperStripes/claude-account-switcher@<full-sha>` in the
  commit or PR description.
- **Skipped change:** record the SHA and reason without applying it.

Validate using `make check`, `make build`, and relevant platform/desktop tests
from [UI development](ui-development.md). Review the complete PR diff, including
release URLs and removed presentation paths. Merge only after applicable CI and
review gates pass; compilation is not native runtime acceptance.

Update the decision table in the same PR. Advance the reviewed checkpoint only
when every commit in the reviewed range has a recorded disposition. Record ranges
when every commit in that range has the same disposition. Do not mix routine
cherry-picks with later full merges without checking for already-ported behavior.

## Reviewed checkpoint

- Upstream revision: `fa930e275a5b9d545bf3aca76eab7639eb711077`
- Upstream subject: `Update the winget manifest to v0.3.9`
- Baseline established: 2026-11-11
- This entire upstream history is already an ancestor of this fork's main, via
  integration commit `ba13551`. There are no additional upstream commits at the
  time this checkpoint was established. This records incorporation, not a new
  security or platform review of the historical changes.

## Decisions

| Upstream revision/range | Decision | Local reference | Reason |
| --- | --- | --- | --- |
| History through `fa930e275a5b9d545bf3aca76eab7639eb711077` | Incorporated (historical baseline) | `ba13551` | Previous full integration through upstream 0.3.9; future updates use selective incorporation |

For future entries use **Incorporated**, **Adapted**, or **Skipped**, with the
upstream SHA/range, local commit or PR (when applicable), and a concrete reason.
