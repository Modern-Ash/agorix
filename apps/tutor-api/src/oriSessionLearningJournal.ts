import type { OriLearningContext } from "./oriCanonicalReviewWorkflow.js";

interface Entry {
  readonly owner: string;
  readonly projectId: string;
  readonly sessionId: string;
  readonly semanticHash: string;
  readonly learningStage: OriLearningContext["learningStage"];
  attempts: number;
  hintsUsed: number;
  expiresAt: number;
}

const ID = /^[A-Za-z0-9_-]{1,128}$/;
const HASH = /^fnv1a32:[a-f0-9]{8}$/;
const STAGES = new Set(["explore", "connect", "translate"]);

/** Ephemeral, bounded server evidence for one authenticated adult session and project revision. */
export function createOriSessionLearningJournal({
  now = Date.now,
  ttlMs = 30 * 60 * 1000,
  maxEntries = 256,
}: {
  readonly now?: () => number;
  readonly ttlMs?: number;
  readonly maxEntries?: number;
} = {}) {
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 1000 || ttlMs > 60 * 60 * 1000) {
    throw new TypeError("Invalid Ori evidence lifetime");
  }
  if (!Number.isSafeInteger(maxEntries) || maxEntries < 1 || maxEntries > 1024) {
    throw new TypeError("Invalid Ori evidence capacity");
  }
  const entries = new Map<string, Entry>();
  const key = (owner: string, projectId: string, sessionId: string) =>
    JSON.stringify([owner, projectId, sessionId]);
  const valid = (owner: string, projectId: string, sessionId: string, semanticHash: string) =>
    [owner, projectId, sessionId].every((id) => ID.test(id)) && HASH.test(semanticHash);
  function purge() {
    const at = now();
    for (const [id, entry] of entries) if (entry.expiresAt <= at) entries.delete(id);
  }
  function current(owner: string, projectId: string, sessionId: string, semanticHash: string) {
    purge();
    if (!valid(owner, projectId, sessionId, semanticHash)) return null;
    const entry = entries.get(key(owner, projectId, sessionId));
    return entry?.semanticHash === semanticHash ? entry : null;
  }
  return Object.freeze({
    /** Call only after the host has executed the persisted canonical project. */
    recordVerifiedRun(
      owner: string,
      projectId: string,
      sessionId: string,
      semanticHash: string,
      learningStage: OriLearningContext["learningStage"],
    ): boolean {
      purge();
      if (!valid(owner, projectId, sessionId, semanticHash) || !STAGES.has(learningStage)) {
        return false;
      }
      const id = key(owner, projectId, sessionId);
      const prior = entries.get(id);
      if (!prior && entries.size >= maxEntries) return false;
      if (!prior || prior.semanticHash !== semanticHash) {
        entries.set(id, {
          owner,
          projectId,
          sessionId,
          semanticHash,
          learningStage,
          attempts: 1,
          hintsUsed: 0,
          expiresAt: now() + ttlMs,
        });
      } else {
        prior.attempts = Math.min(100, prior.attempts + 1);
        prior.expiresAt = now() + ttlMs;
      }
      return true;
    },
    /** Call only after a server-issued hint, never for a browser's claimed hint. */
    recordHintIssued(
      owner: string,
      projectId: string,
      sessionId: string,
      semanticHash: string,
    ): boolean {
      const entry = current(owner, projectId, sessionId, semanticHash);
      if (!entry) return false;
      entry.hintsUsed = Math.min(100, entry.hintsUsed + 1);
      entry.expiresAt = now() + ttlMs;
      return true;
    },
    learningContext(
      owner: string,
      projectId: string,
      sessionId: string | undefined,
      semanticHash: string,
    ): OriLearningContext | null {
      if (!sessionId) return null;
      const entry = current(owner, projectId, sessionId, semanticHash);
      return entry
        ? {
            attempts: entry.attempts,
            hintsUsed: entry.hintsUsed,
            learningStage: entry.learningStage,
          }
        : null;
    },
    clearSession(sessionId: string): void {
      for (const [id, entry] of entries) if (entry.sessionId === sessionId) entries.delete(id);
    },
  });
}
