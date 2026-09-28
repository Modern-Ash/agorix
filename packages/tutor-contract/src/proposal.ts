/**
 * Provider-neutral AI-proposal contract (docs/architecture/AI_TUTOR.md).
 *
 * A proposal is a *bounded, inspectable diff*, never an executed action: the
 * learner must explicitly accept, modify or reject it before
 * `program-model` state changes. The proposal itself must never assert
 * program/runtime facts it was not given by `@agorix/runtime` — that
 * boundary is what AC-003/AC-006 test.
 */
import type { ProjectProgram, Statement } from "@agorix/program-model";
import type { RunResult, WorldConfig } from "@agorix/runtime";

export type ProposalDecision = "accepted" | "modified" | "rejected";

/** One additive, bounded change: append statements to an existing script. */
export interface AppendStatementsProposal {
  readonly kind: "append-statements";
  readonly scriptId: string;
  readonly statements: readonly Statement[];
  /** Child-facing explanation; must not claim state runtime did not observe. */
  readonly rationale: string;
}

export type TutorProposal = AppendStatementsProposal;

export interface ProposalRecord {
  readonly proposal: TutorProposal;
  readonly decision: ProposalDecision | "pending";
}

/**
 * Deterministic fake tutor (docs/architecture/AI_TUTOR.md POC strategy):
 * no external LLM, no network I/O, same run always yields the same
 * proposal. Only reads the last real runtime observation — never invents
 * distance/position it wasn't given.
 */
export function proposeCompletion(
  program: ProjectProgram,
  lastRun: RunResult,
  world: WorldConfig,
): TutorProposal | null {
  if (lastRun.reachedGoal) {
    return null;
  }
  const script = program.scripts.find((candidate) => candidate.trigger.type === "onStart");
  if (script === undefined) {
    return null;
  }
  const dx = world.goal.x - lastRun.finalPosition.x;
  const dy = world.goal.y - lastRun.finalPosition.y;
  const remaining = Math.round(Math.sqrt(dx * dx + dy * dy));
  if (remaining <= 0) {
    return null;
  }
  return {
    kind: "append-statements",
    scriptId: script.id,
    statements: [{ type: "move", steps: remaining }],
    rationale:
      `The last run stopped ${remaining} unit(s) from the goal at ` +
      `(${lastRun.finalPosition.x.toFixed(1)}, ${lastRun.finalPosition.y.toFixed(1)}). ` +
      `Adding one more move(${remaining}) would close that gap — want to try it?`,
  };
}

/**
 * Applies an accepted/modified proposal to `program`. Never called for a
 * "rejected" or "pending" decision — the caller enforces that boundary so a
 * bypassed acceptance can never reach this function (AC-006).
 */
export function applyProposal(program: ProjectProgram, proposal: TutorProposal): ProjectProgram {
  if (proposal.kind !== "append-statements") {
    const unknown = proposal as { kind?: unknown };
    throw new Error(`Unsupported proposal kind ${String(unknown.kind)}`);
  }
  return {
    ...program,
    scripts: program.scripts.map((script) =>
      script.id === proposal.scriptId
        ? { ...script, statements: [...script.statements, ...proposal.statements] }
        : script,
    ),
  };
}
