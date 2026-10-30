import { getKidsHint, KIDS_HINT_LEVELS, type MissionHint } from "@agorix/curriculum";
import type { ProjectRepository } from "@agorix/project-repository";
import { oriKidsFreeMission } from "./oriKidsFreeWorld.js";
import type { createOriSessionLearningJournal } from "./oriSessionLearningJournal.js";

/** Issues the next deterministic hint from the persisted mission, then records issuance in memory. */
export function createOriPilotHintIssuer({
  repository,
  journal,
}: {
  readonly repository: ProjectRepository;
  readonly journal: ReturnType<typeof createOriSessionLearningJournal>;
}) {
  return async (
    owner: string,
    projectId: string,
    sessionId: string,
    expectedLevel?: number,
  ): Promise<MissionHint | null> => {
    if (!owner || !projectId || !sessionId) return null;
    try {
      const record = await repository.get(owner, projectId);
      if (record.ownerId !== owner || record.projectId !== projectId) return null;
      const context = journal.learningContext(owner, projectId, sessionId, record.semanticHash);
      if (!context) return null;
      const mission = oriKidsFreeMission(record.storedProject);
      if (!mission) return null;
      const level = Math.max(context.hintsUsed, record.storedProject.metadata.hintLevel) + 1;
      if (expectedLevel !== undefined && expectedLevel !== level) return null;
      const prior = KIDS_HINT_LEVELS.filter((candidate) => candidate < level);
      const hint = getKidsHint(mission, level, prior);
      if (!hint) return null;
      const current = await repository.get(owner, projectId);
      if (
        current.ownerId !== owner ||
        current.projectId !== projectId ||
        current.revision !== record.revision ||
        current.semanticHash !== record.semanticHash
      ) {
        return null;
      }
      return journal.recordHintIssued(owner, projectId, sessionId, record.semanticHash, level)
        ? hint
        : null;
    } catch {
      return null;
    }
  };
}
