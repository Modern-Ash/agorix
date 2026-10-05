import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";

/**
 * Deterministic stand-ins for two AI proposals, for CI and classroom demos. Aliases are
 * "Proposal A" and "Proposal B"; no provider or model identity appears anywhere.
 * The First Mission goal is 160 steps from the start.
 */
const program = (statements: unknown[]): ProjectProgram =>
  ({
    schema: SCHEMA_VERSION,
    scripts: [{ id: "main", trigger: { type: "onStart" }, statements }],
  }) as ProjectProgram;

export interface ComparisonFixture {
  readonly id: "one-works" | "both-work" | "one-invalid";
  readonly alternatives: readonly { readonly id: string; readonly program: ProjectProgram }[];
}

export const COMPARISON_FIXTURES: readonly ComparisonFixture[] = [
  {
    id: "one-works",
    alternatives: [
      { id: "proposal-a", program: program([{ type: "move", steps: 160 }]) },
      { id: "proposal-b", program: program([{ type: "move", steps: 100 }]) },
    ],
  },
  {
    id: "both-work",
    alternatives: [
      { id: "proposal-a", program: program([{ type: "move", steps: 160 }]) },
      {
        id: "proposal-b",
        program: program([
          { type: "move", steps: 100 },
          { type: "move", steps: 60 },
        ]),
      },
    ],
  },
  {
    id: "one-invalid",
    alternatives: [
      { id: "proposal-a", program: program([{ type: "move", steps: 160 }]) },
      { id: "proposal-b", program: program([{ type: "move", steps: "far" }]) },
    ],
  },
];

export const BASE_PROGRAM: ProjectProgram = program([]);
