import { createHash } from "node:crypto";
import type { ProjectRepository } from "@agorix/project-repository";
import { createOriCanonicalExecutionPort } from "./oriCanonicalExecutionPort.js";
import { oriKidsFreeWorld } from "./oriKidsFreeWorld.js";
import type { createOriSessionLearningJournal } from "./oriSessionLearningJournal.js";

/** Executes the owner-scoped persisted Kids program before recording an ephemeral pilot attempt. */
export function createOriPilotVerifiedRun({
  repository,
  journal,
}: {
  readonly repository: ProjectRepository;
  readonly journal: ReturnType<typeof createOriSessionLearningJournal>;
}) {
  const execute = createOriCanonicalExecutionPort({ world: {}, maxSteps: 100 });
  return async (owner: string, projectId: string, sessionId: string): Promise<boolean> => {
    if (!owner || !projectId || !sessionId) return false;
    try {
      const record = await repository.get(owner, projectId);
      if (record.ownerId !== owner || record.projectId !== projectId) return false;
      const world = oriKidsFreeWorld(record.storedProject);
      if (!world) return false;
      const { result } = await execute(record.storedProject.program, world);
      if (
        result.outcome !== "completed" ||
        !Number.isSafeInteger(result.stepsUsed) ||
        result.stepsUsed < 1 ||
        result.stepsUsed > 100 ||
        result.trace.length !== result.stepsUsed
      ) {
        return false;
      }
      const current = await repository.get(owner, projectId);
      if (
        current.ownerId !== owner ||
        current.projectId !== projectId ||
        current.revision !== record.revision ||
        current.semanticHash !== record.semanticHash
      ) {
        return false;
      }
      const fingerprint = createHash("sha256")
        .update(
          JSON.stringify([record.storedProject.program, record.storedProject.metadata.missionSpec]),
        )
        .digest("hex");
      return journal.recordVerifiedRun(
        owner,
        projectId,
        sessionId,
        record.semanticHash,
        "explore",
        fingerprint,
      );
    } catch {
      return false;
    }
  };
}
