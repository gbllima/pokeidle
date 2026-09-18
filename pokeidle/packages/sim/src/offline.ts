import { advance, type AdvanceResult, type HuntPolicy, type HuntRun, type PartySpec, type ZoneSpec } from './hunt.ts';

/**
 * Offline progression.
 *
 * The defining mechanic of the genre and the one the original roadmap never
 * specified: what a hunt does while the browser is closed. The answer here is
 * that it keeps hunting, at a declared efficiency, up to a declared cap.
 *
 * Efficiency scales *time*, not rewards. An offline hour becomes some smaller
 * number of active milliseconds, and those milliseconds then run through the
 * exact same encounter fold as live play. Scaling rewards instead would make
 * an offline encounter differ from an online one, and the whole determinism
 * guarantee would be gone.
 */

export type OfflinePolicy = {
  /** Wall time beyond this is discarded. */
  capMs: number;
  /** Active time granted per unit of wall time, in [0, 1]. */
  efficiency: number;
};

export const DEFAULT_OFFLINE: OfflinePolicy = {
  capMs: 8 * 60 * 60 * 1000,
  efficiency: 0.5,
};

export type SuspendResult = {
  run: HuntRun;
};

/** Called when the player disconnects. Freezes the run against the server clock. */
export function suspend(run: HuntRun, now: number): SuspendResult {
  if (run.state !== 'RUNNING') return { run };
  return {
    run: { ...run, state: 'SUSPENDED', lastTickAt: now, revision: run.revision + 1 },
    };
}

export type ResumeReport = {
  /** Wall milliseconds the player was away. */
  awayMs: number;
  /** Wall milliseconds discarded by the cap. */
  discardedMs: number;
  /** Active milliseconds credited. */
  creditedMs: number;
  /** Encounters folded by the catch-up. */
  folded: number;
  cappedOut: boolean;
};

export type ResumeResult = AdvanceResult & { report: ResumeReport };

/**
 * Called when the player reconnects. Credits capped, scaled offline time and
 * folds the encounters it bought.
 *
 * `now` must come from the server clock. A client-supplied timestamp here
 * would be a direct exploit: the player would mint experience by lying about
 * how long they were away.
 */
export function resume(
  run: HuntRun,
  now: number,
  zone: ZoneSpec,
  party: PartySpec,
  policy?: HuntPolicy,
  offline: OfflinePolicy = DEFAULT_OFFLINE,
): ResumeResult {
  if (run.state !== 'SUSPENDED') {
    return {
      run,
      folded: 0,
      stopped: run.stoppedReason,
      outcomes: [],
      report: { awayMs: 0, discardedMs: 0, creditedMs: 0, folded: 0, cappedOut: false },
    };
  }

  const awayMs = Math.max(0, now - run.lastTickAt);
  const eligibleMs = Math.min(awayMs, offline.capMs);
  const creditedMs = Math.floor(eligibleMs * offline.efficiency);

  const running: HuntRun = { ...run, state: 'RUNNING', lastTickAt: now };
  const result = advance(running, creditedMs, zone, party, policy);

  return {
    ...result,
    report: {
      awayMs,
      discardedMs: awayMs - eligibleMs,
      creditedMs,
      folded: result.folded,
      cappedOut: awayMs > offline.capMs,
    },
  };
}

/**
 * What the player would earn by coming back right now. Read-only, safe to
 * call from a status endpoint without mutating the run.
 */
export function previewOffline(
  run: HuntRun,
  now: number,
  zone: ZoneSpec,
  party: PartySpec,
  policy: HuntPolicy | undefined,
  offline: OfflinePolicy = DEFAULT_OFFLINE,
): ResumeResult {
  return resume(run, now, zone, party, policy, offline);
}
