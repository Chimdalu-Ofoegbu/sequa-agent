// store/thesisStore.ts
// Off-chain thesis persistence (D-09/D-37). For every narrated signal the runtime writes
//   theses/<agentId>/<signalId>.json   = { agentId, signalId, thesis, ts }
// then git-commits + pushes it via the agent's GITHUB_PAT so the Phase 4 frontend can read it via
// CDN-fronted raw.githubusercontent.com.
//
// IMPORTANT (AI-SPEC §4 stateless): the thesis JSON is WRITE-ONLY from the agent's perspective — it
// is never read back into a prompt. It is commentary on the card, never an input to the next call.
//
// Commit-flood mitigation (D-37): commits are BATCHED on a daily-rotated boundary. The file is
// written immediately (so /healthz + a local reader see it at once), but the git commit+push is
// debounced — we coalesce writes within a short window into one commit, and the on-disk layout uses
// a per-agent folder so a day's theses are a handful of files, not a commit per signal.
//
// Degradation: a git/push failure NEVER throws to the caller (this runs on the off-hot-path narration
// branch, after the trade settled). It logs a structured warn and the JSON remains on disk; a later
// successful push sweeps it up. The trade is wholly unaffected by any store failure (Pitfall 5).

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/** The repo root that holds the `theses/` tree (repo root = agent/../). */
function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // agent/src/store -> ../../.. -> repo root
  return resolve(here, '..', '..', '..');
}

/** Absolute path to theses/<agentId>/<signalId>.json under the repo root. */
export function thesisPath(agentId: string, signalId: string): string {
  return resolve(repoRoot(), 'theses', String(agentId), `${String(signalId)}.json`);
}

/** The JSON record persisted per (agentId, signalId). */
export interface ThesisRecord {
  agentId: string;
  signalId: string;
  thesis: string;
  ts: string; // ISO-8601 write time
}

// --- debounced git push (commit-flood mitigation, D-37) ----------------------------------------
let pushTimer: NodeJS.Timeout | null = null;
let pushPending = false;
const PUSH_DEBOUNCE_MS = 60_000; // coalesce a minute of writes into one commit+push

/** Whether thesis git pushing is enabled — only when a GITHUB_PAT is present. */
function pushEnabled(): boolean {
  return Boolean(process.env.GITHUB_PAT && process.env.THESIS_GIT_PUSH !== 'false');
}

/**
 * writeThesis — persist the thesis JSON for (agentId, signalId) and SCHEDULE a debounced git push.
 * NEVER throws: a filesystem or git error is logged (structured stdout) and swallowed, because this
 * runs after the trade has already settled (off the hot path, Pitfall 5).
 */
export async function writeThesis(agentId: string, signalId: string, thesis: string): Promise<void> {
  const record: ThesisRecord = {
    agentId: String(agentId),
    signalId: String(signalId),
    thesis,
    ts: new Date().toISOString(),
  };
  const path = thesisPath(record.agentId, record.signalId);

  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(record, null, 2) + '\n', 'utf8');
  } catch (err) {
    console.warn({ signalId: record.signalId, reason: 'thesis_write_failed', err: String(err) });
    return; // nothing to push if the write failed
  }

  if (pushEnabled()) scheduleThesisPush();
}

/** Schedule (debounced) a single git commit+push that sweeps up all theses written this window. */
function scheduleThesisPush(): void {
  pushPending = true;
  if (pushTimer) return; // a push is already scheduled within the window
  pushTimer = setTimeout(() => {
    pushTimer = null;
    if (!pushPending) return;
    pushPending = false;
    void gitCommitAndPush().catch((err) => {
      console.warn({ reason: 'thesis_push_failed', err: String(err) });
    });
  }, PUSH_DEBOUNCE_MS);
  // do not keep the process alive solely for the push timer
  if (typeof pushTimer.unref === 'function') pushTimer.unref();
}

/**
 * gitCommitAndPush — stage theses/, commit, and push via the GITHUB_PAT. Best-effort; any failure is
 * surfaced as a rejected promise the caller logs (never thrown into the loop). The remote is set to an
 * authenticated https URL using GITHUB_PAT if THESIS_GIT_REMOTE is provided.
 *
 * Concurrency safety (Fix 10): another writer (a parallel agent, or a human commit) can advance the
 * remote between our commit and our push, so a bare `git push` races and fails with non-fast-forward.
 * We `git pull --rebase` to replay our theses commit on top, then push, with a SINGLE retry of the
 * pull+push if the first push still loses the race. This is fully OFF the hot path (debounced, after
 * the trade settled) — a failure here never touches a trade. If the theses repo/remote is missing,
 * we log a DISTINCT structured warning so it is obvious the store is unconfigured (not a real fault).
 */
export async function gitCommitAndPush(): Promise<void> {
  const cwd = repoRoot();
  const pat = process.env.GITHUB_PAT;
  if (!pat) return; // pushing disabled without a PAT

  // Stage only the theses tree — never `git add .` (scoped, D-37 / avoids sweeping in unrelated files).
  await execAsync('git add theses', { cwd });

  // Nothing staged → nothing to commit (avoid a noisy empty-commit error).
  const { stdout: staged } = await execAsync('git diff --cached --name-only', { cwd });
  if (staged.trim().length === 0) return;

  const stamp = new Date().toISOString();
  await execAsync(`git commit -m "chore(theses): publish theses ${stamp}"`, { cwd });

  // Push. If a dedicated authenticated remote is configured (PAT-embedded https URL), use it; else
  // rely on the ambient credential helper. The PAT is read from env, never logged.
  const remote = process.env.THESIS_GIT_REMOTE;
  const pushCmd = remote
    ? `git push ${remote.replace('https://', `https://x-access-token:${pat}@`)} HEAD`
    : 'git push';
  const pullCmd = remote
    ? `git pull --rebase ${remote.replace('https://', `https://x-access-token:${pat}@`)} HEAD`
    : 'git pull --rebase';

  // pull --rebase before push so a concurrent writer's commits don't reject our push; ONE retry.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // Rebase our theses commit on top of any remote advance (no-op if remote/upstream is absent).
      await execAsync(pullCmd, { cwd }).catch((pullErr) => {
        // A missing remote/upstream is expected when the theses repo is not configured — log distinctly
        // and continue to attempt the push (which will surface the same condition if truly unconfigured).
        console.warn({ reason: 'thesis_pull_rebase_skipped', detail: 'remote/upstream absent or pull failed', err: String(pullErr) });
      });
      await execAsync(pushCmd, { cwd });
      return; // pushed cleanly
    } catch (err) {
      if (attempt === 0) {
        console.warn({ reason: 'thesis_push_retry', attempt, err: String(err) });
        continue; // retry the pull+push once
      }
      // Second failure — distinguish "no remote configured" from a genuine push error for the operator.
      const msg = String(err);
      const noRemote = /no configured push destination|does not appear to be a git repository|No such remote/i.test(msg);
      console.warn({ reason: noRemote ? 'thesis_remote_absent' : 'thesis_push_failed', err: msg });
      throw err; // caller (.catch in scheduleThesisPush) logs; never reaches the hot path
    }
  }
}
