import {
  evaluateKidsRun,
  kidsMoveSteps,
  worldToCell,
  type MissionDefinition,
} from "@agorix/curriculum";
import {
  createProgramProposal,
  createProposalReview,
  type ProgramProposal,
} from "@agorix/proposals";
import type { ProjectProgram, Statement } from "@agorix/program-model";
import { createWorldState, runProgram } from "@agorix/runtime";

export type KidsOriKind = "move" | "turn" | "repeat" | "done" | "wall" | "passed";
export interface KidsOriOffer {
  readonly kind: KidsOriKind;
  readonly amount?: number;
  readonly proposal?: ProgramProposal;
}

const DIRECTIONS = ["E", "S", "W", "N"] as const;
const VECTORS = { E: [1, 0], S: [0, 1], W: [-1, 0], N: [0, -1] } as const;

/** The Kids 08 rule provider, shared by the Web and the fixed agent's fail-closed path. */
export function computeKidsOri(
  program: ProjectProgram,
  mission: MissionDefinition,
  missionIndex: number,
  locale: "es" | "en" = "es",
): KidsOriOffer {
  const script = program.scripts[0];
  if (!script) return { kind: "done" };
  const evaluation = evaluateKidsRun({
    mission,
    result: runProgram(program, createWorldState(mission.starterStage)),
  });
  if (evaluation.outcome === "success") return { kind: "done" };
  if (evaluation.outcome === "wall") return { kind: "wall" };
  if (evaluation.outcome === "passed") return { kind: "passed" };

  const goal = worldToCell(mission.starterStage.goal as { x: number; y: number });
  const dx = goal.cx - evaluation.final.cx;
  const dy = goal.cy - evaluation.final.cy;
  const [fx, fy] = VECTORS[evaluation.heading];
  let distance = 0;
  if (fx !== 0 && Math.sign(dx) === fx) distance = Math.abs(dx);
  else if (fy !== 0 && Math.sign(dy) === fy) distance = Math.abs(dy);

  let kind: KidsOriKind;
  let statement: Statement;
  let amount: number | undefined;
  if (distance >= 3 && missionIndex === 2) {
    kind = "repeat";
    amount = Math.min(6, distance);
    statement = {
      type: "repeat",
      count: amount,
      body: [{ type: "move", steps: kidsMoveSteps(1) }],
    };
  } else if (distance > 0) {
    kind = "move";
    amount = Math.min(5, distance);
    statement = { type: "move", steps: kidsMoveSteps(amount) };
  } else {
    kind = "turn";
    const target = dx !== 0 ? (dx > 0 ? "E" : "W") : dy > 0 ? "S" : "N";
    const index = DIRECTIONS.indexOf(evaluation.heading);
    statement = { type: "turn", degrees: DIRECTIONS[(index + 3) % 4] === target ? -90 : 90 };
  }

  const nodeId = `scripts[0]/statements[${script.statements.length}]`;
  const proposal = createProgramProposal({
    id: `kids-ori-${missionIndex}-${script.statements.length}`,
    baseProgram: program,
    source: { kind: "learning-companion", capability: "builder" },
    purpose: locale === "es" ? "Una idea de Ori" : "An idea from Ori",
    rationale:
      locale === "es"
        ? "Mirá el bloque y decidí si querés probarlo. Ori puede equivocarse."
        : "Look at the block and decide whether to try it. Ori can be wrong.",
    affectedNodeIds: [nodeId],
    operations: [{ type: "appendStatement", scriptIndex: 0, statement }],
  });
  createProposalReview(program, proposal);
  return { kind, ...(amount === undefined ? {} : { amount }), proposal };
}
