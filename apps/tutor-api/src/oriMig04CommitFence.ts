import type { OriMig04RolloutPolicy } from "./oriMig04RolloutGate.js";
import { createOriMig04RolloutGate } from "./oriMig04RolloutGate.js";

/**
 * Single-process rollout fence. Serializes policy revocation against project
 * commits using an exclusive async critical section. For distributed hosts,
 * replace this with a shared transactional fence in the project database.
 */
export function createOriMig04CommitFence() {
  let policy: OriMig04RolloutPolicy = {
    mode: "disabled",
    humanAuthorized: false,
    killSwitch: true,
    approvedProjectIds: [],
  };
  let generation = 0;
  let tail: Promise<void> = Promise.resolve();
  async function exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const prior = tail;
    let release!: () => void;
    tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prior;
    try {
      return await operation();
    } finally {
      release();
    }
  }
  const permitted = (projectId: string) =>
    createOriMig04RolloutGate(policy).decide(projectId).learnerVisible;
  return Object.freeze({
    decide(projectId: string) {
      return createOriMig04RolloutGate(policy).decide(projectId);
    },
    snapshot(projectId: string) {
      return Object.freeze({ generation, permitted: permitted(projectId) });
    },
    /** Only a trusted host may call this; never expose to learner input. */
    async replaceFromHost(next: OriMig04RolloutPolicy): Promise<boolean> {
      if (
        !next ||
        !["disabled", "shadow", "pilot"].includes(next.mode) ||
        typeof next.humanAuthorized !== "boolean" ||
        typeof next.killSwitch !== "boolean" ||
        !Array.isArray(next.approvedProjectIds) ||
        next.approvedProjectIds.length > 100 ||
        next.approvedProjectIds.some(
          (id) => typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(id),
        )
      )
        return false;
      return exclusive(async () => {
        policy = Object.freeze({
          mode: next.mode,
          humanAuthorized: next.humanAuthorized,
          killSwitch: next.killSwitch,
          approvedProjectIds: Object.freeze([...new Set(next.approvedProjectIds)]),
        });
        generation++;
        return true;
      });
    },
    async emergencyDisable(): Promise<void> {
      await exclusive(async () => {
        policy = Object.freeze({
          mode: "disabled",
          humanAuthorized: false,
          killSwitch: true,
          approvedProjectIds: Object.freeze([]),
        });
        generation++;
      });
    },
    /**
     * A write that started before revocation completes before the revocation
     * promise resolves. New writes cannot begin after it resolves.
     */
    async commit<T>(
      projectId: string,
      expectedGeneration: number,
      operation: () => Promise<T>,
    ): Promise<{ readonly applied: boolean; readonly value?: T }> {
      return exclusive(async () => {
        if (generation !== expectedGeneration || !permitted(projectId)) return { applied: false };
        const value = await operation();
        return { applied: true, value };
      });
    },
  });
}
