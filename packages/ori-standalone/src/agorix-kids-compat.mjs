import { createAgorixAdapter } from "./agorix-adapter.mjs";
import { createCanonicalAgorixHost } from "./agorix-runtime-bridge.mjs";
import { oriProposalToAgorixOperations } from "./agorix-operations.mjs";

/**
 * Server-side compatibility boundary for Agorix Kids' existing tutor route.
 * Returns a safe, NON-APPLYING hint/preview result. It does not impersonate
 * the complete Agorix /api/tutor/ori response (which needs host-owned metadata).
 */
export function createAgorixKidsCompatibility({ readCanonicalProgram, readRunResult, gridCellSize, missionIndex }) {
  if (!Number.isSafeInteger(gridCellSize) || gridCellSize < 1 || gridCellSize > 10000) throw new TypeError("Invalid grid cell size");
  if (!Number.isSafeInteger(missionIndex) || missionIndex < 0 || missionIndex > 1000) throw new TypeError("Invalid mission index");
  const host = createCanonicalAgorixHost({ readCanonicalProgram, readRunResult });
  const ori = createAgorixAdapter(host);
  return Object.freeze({
    async propose({ message, attempts = 0, hintsUsed = 0, allowProposal = false }) {
      const answer = await ori.ask(message, { attempts, hintsUsed, allowProposal });
      let operationsPreview = null;
      if (answer.proposal) {
        const translated = oriProposalToAgorixOperations(answer.proposal, { allowedBlocks: ["move"] });
        // Ori's move unit is one Kids grid cell. Agorix canonical move is pixels.
        const operations = translated.operations.map(op => Object.freeze({
          ...op,
          statement: Object.freeze({ type: "move", steps: op.statement.steps * gridCellSize })
        }));
        operationsPreview = Object.freeze({
          kind: "agorix-kids-operations-preview/v0",
          operations: Object.freeze(operations),
          requiresLearnerApproval: true
        });
      }
      return Object.freeze({
        message: answer.message,
        plan: answer.plan ?? null,
        evidence: answer.evidence ?? null,
        operationsPreview,
        appliedChanges: false,
        requiresLearnerApproval: operationsPreview !== null,
        // Host must build complete ProgramProposal, check mission eligibility,
        // hash, affected nodes and createProposalReview before displaying.
        needsHostValidation: operationsPreview !== null
      });
    }
  });
}
