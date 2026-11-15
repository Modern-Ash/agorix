import { SCHEMA_VERSION, type ProjectProgram, type Statement } from "@agorix/program-model";
import {
  ORI_LIST_INTENTS,
  ORI_SENSOR_INTENTS,
  ORI_STUDIO_INTENTS,
  proposeOriStudioIntent,
  validateOriStudioIntentProposal,
  type OriStudioIntent,
} from "@agorix/ori-agent";
import { acceptProposal } from "@agorix/proposals";
import { previewCandidate } from "./kidsStudioCoach.js";
import { creativeForStudio, validateStudioProgram } from "./kidsStudioModel.js";

/**
 * A fixed set of scenes and every idea Ori can put forward, checked with the same code the Studio
 * uses: the idea must be a valid scene program once accepted, must not stop the program from
 * reaching its end, and the card must be able to say what it changes. No provider, no credentials:
 * the ideas are built by deterministic code, so the numbers are the same on every machine.
 */
const ACTOR = "actor:studio-1-nova";
const scene = (statements: readonly Statement[]): ProjectProgram =>
  validateStudioProgram({
    schema: SCHEMA_VERSION,
    scripts: [{ id: "studio-actor-1-nova", trigger: { type: "greenFlag" }, statements }],
  });

export const EVAL_SCENES: readonly { readonly name: string; readonly program: ProjectProgram }[] = [
  { name: "empty", program: scene([]) },
  { name: "one move", program: scene([{ type: "move", steps: 40 }]) },
  {
    name: "move and say",
    program: scene([
      { type: "move", steps: 40 },
      { type: "say", text: "Hola" },
    ]),
  },
  {
    name: "a loop",
    program: scene([{ type: "repeat", count: 3, body: [{ type: "move", steps: 40 }] }]),
  },
  {
    name: "a forever loop",
    program: scene([{ type: "forever", body: [{ type: "move", steps: 40 }] }]),
  },
];

export const EVAL_INTENTS: readonly OriStudioIntent[] = [
  ...ORI_STUDIO_INTENTS,
  ...ORI_SENSOR_INTENTS,
  ...ORI_LIST_INTENTS,
];

export interface EvalRow {
  readonly intent: string;
  /** Scenes where the idea can be put forward at all. */
  readonly offered: number;
  /** Offered, but not a valid scene program once accepted. Must be 0. */
  readonly invalid: number;
  /** Offered, and the program no longer reaches its end. Must be 0. */
  readonly stops: number;
  /** Offered, and it changes nothing that happens on a run. */
  readonly unchanged: number;
  /** Offered, and it would stop something the program does now. */
  readonly losing: number;
}

export function evaluateOri(locale: "es" | "en" = "es"): readonly EvalRow[] {
  return EVAL_INTENTS.map((intent) => {
    let offered = 0;
    let invalid = 0;
    let stops = 0;
    let unchanged = 0;
    let losing = 0;
    for (const { program } of EVAL_SCENES) {
      const context = { actorId: ACTOR, locale, program };
      let proposal;
      try {
        proposal = proposeOriStudioIntent(context, intent);
      } catch {
        continue; // not an idea for this scene (for example, a list idea with no list)
      }
      offered += 1;
      try {
        const review = validateOriStudioIntentProposal(context, proposal);
        validateStudioProgram(acceptProposal(program, review).program);
        const creative = creativeForStudio(program, "forest", locale);
        const preview = previewCandidate(program, review.candidateProgram, creative, ACTOR, []);
        if (preview === null) invalid += 1;
        else {
          if (preview.outcomeBefore === "completed" && preview.outcome !== "completed") stops += 1;
          if (preview.unchanged) unchanged += 1;
          if (preview.lost.length > 0) losing += 1;
        }
      } catch {
        invalid += 1;
      }
    }
    return { intent, offered, invalid, stops, unchanged, losing };
  });
}

export function evalTotals(rows: readonly EvalRow[]): Omit<EvalRow, "intent"> {
  const sum = (pick: (row: EvalRow) => number) => rows.reduce((n, row) => n + pick(row), 0);
  return {
    offered: sum((row) => row.offered),
    invalid: sum((row) => row.invalid),
    stops: sum((row) => row.stops),
    unchanged: sum((row) => row.unchanged),
    losing: sum((row) => row.losing),
  };
}

export function evalMarkdown(rows: readonly EvalRow[]): string {
  const total = evalTotals(rows);
  return [
    "| Idea | Offered | Invalid | Stops the program | Changes nothing | Would stop something |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows
      .filter((row) => row.offered > 0)
      .map(
        (row) =>
          `| ${row.intent} | ${row.offered} | ${row.invalid} | ${row.stops} | ${row.unchanged} | ${row.losing} |`,
      ),
    `| **Total** | **${total.offered}** | **${total.invalid}** | **${total.stops}** | **${total.unchanged}** | **${total.losing}** |`,
  ].join("\n");
}
