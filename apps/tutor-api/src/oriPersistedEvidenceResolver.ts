import { createHash } from "node:crypto";
import type { ProjectRepository } from "@agorix/project-repository";
import type { RunResult, WorldStateInput } from "@agorix/runtime";
import type { StoredProject } from "@agorix/persistence";
import type { TrustedOriProject } from "./oriProjectReviewService.js";

/** Ori transport requires a 64-hex revision; Agorix persists fnv1a32 hashes. */
export function oriEvidenceRevision(semanticHash: string, revision: number): string {
  if (/^[a-f0-9]{64}$/.test(semanticHash)) return semanticHash;
  return createHash("sha256")
    .update(JSON.stringify([semanticHash, revision]))
    .digest("hex");
}
export type OriIntent = "help" | "repeat" | "turn" | "move" | "debug";
export interface CanonicalOriExecution {
  readonly result: RunResult;
  /** Execution must use the exact persisted program passed to this callback. */
}
export interface OriExecutionPort {
  (
    program: Awaited<ReturnType<ProjectRepository["get"]>>["storedProject"]["program"],
    world?: WorldStateInput,
  ): Promise<CanonicalOriExecution>;
}
/**
 * Resolve an owner-scoped persisted program, execute via the host's canonical
 * runner, and export only allowlisted, bounded evidence. No browser data is
 * accepted as an authoritative program, grant or revision.
 */
export function createOriPersistedEvidenceResolver({
  repository,
  execute,
  worldForProject,
  learningContext,
}: {
  readonly repository: ProjectRepository;
  readonly execute: OriExecutionPort;
  readonly worldForProject?: (project: StoredProject) => WorldStateInput | null;
  readonly learningContext: (
    owner: string,
    projectId: string,
    sessionId?: string,
    semanticHash?: string,
  ) => Promise<{
    readonly attempts: number;
    readonly hintsUsed: number;
    readonly learningStage: "explore" | "connect" | "translate";
  } | null>;
}) {
  return async (
    owner: string,
    projectId: string,
    intent: OriIntent = "move",
    sessionId?: string,
  ): Promise<TrustedOriProject | null> => {
    if (!owner || owner.length > 128 || !projectId || projectId.length > 128) return null;
    if (!["help", "repeat", "turn", "move", "debug"].includes(intent)) return null;
    try {
      const record = await repository.get(owner, projectId);
      if (
        record.ownerId !== owner ||
        record.projectId !== projectId ||
        typeof record.semanticHash !== "string" ||
        !record.semanticHash
      )
        return null;
      const world = worldForProject?.(record.storedProject);
      if (worldForProject && !world) return null;
      const { result } = await execute(record.storedProject.program, world ?? undefined);
      if (
        result.outcome !== "completed" ||
        !Number.isSafeInteger(result.stepsUsed) ||
        result.stepsUsed < 1 ||
        result.stepsUsed > 100 ||
        result.trace.length !== result.stepsUsed
      )
        return null;
      const steps = result.trace.map((step, index) => {
        if (step.step !== index + 1) return null;
        const kind = ["move", "turn", "repeat", "wait", "say", "if", "forever"].includes(
          step.statementType,
        )
          ? step.statementType
          : "other";
        return { index, description: "Executed " + kind };
      });
      if (steps.some((step) => step === null)) return null;
      const context = await learningContext(owner, projectId, sessionId, record.semanticHash);
      if (
        !context ||
        !Number.isSafeInteger(context.attempts) ||
        context.attempts < 0 ||
        !Number.isSafeInteger(context.hintsUsed) ||
        context.hintsUsed < 0 ||
        !["explore", "connect", "translate"].includes(context.learningStage)
      )
        return null;
      const allowedBlocks = ["move", "turn"].filter((kind) =>
        steps.some((step) => step?.description === "Executed " + kind),
      );
      if (allowedBlocks.length === 0) return null;
      const current = await repository.get(owner, projectId);
      if (current.semanticHash !== record.semanticHash || current.revision !== record.revision)
        return null;
      return {
        owner,
        projectId,
        revision: oriEvidenceRevision(record.semanticHash, record.revision),
        evidence: {
          intent,
          programRevision: oriEvidenceRevision(record.semanticHash, record.revision),
          expectedSteps: steps.length,
          hostContext: {
            sessionId: "host-verified",
            learningStage: context.learningStage,
            capabilities: ["inspectProgram", "inspectTrace"],
            grants: ["inspectProgram", "inspectTrace"],
            attempts: context.attempts,
            hintsUsed: context.hintsUsed,
          },
          snapshot: { allowedBlocks },
          trace: {
            steps: steps.filter(
              (step): step is { index: number; description: string } => step !== null,
            ),
          },
        },
      };
    } catch {
      return null;
    }
  };
}
