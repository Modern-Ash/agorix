import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { createProgramProposal, type ProgramProposal } from "@agorix/proposals";
import { TeamSession, type TeamMember, type TeamSessionOptions } from "../src/index.js";

export class FakeClock {
  constructor(private ms = Date.parse("2026-10-25T12:00:00.000Z")) {}
  now(): Date {
    return new Date(this.ms);
  }
  advance(ms: number): void {
    this.ms += ms;
  }
}

export const baseProgram: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "explorer-script",
      trigger: { type: "onStart" },
      statements: [{ type: "move", steps: 10 }],
    },
    {
      id: "beacon-script",
      trigger: { type: "onMessage", message: "pulse" },
      statements: [{ type: "turn", degrees: 90 }],
    },
  ],
};

export const MEMBERS: readonly TeamMember[] = [
  { slotId: "slt_a", alias: "Zorro Azul", role: "characters" },
  { slotId: "slt_b", alias: "Gato Verde", role: "scene" },
  { slotId: "slt_c", alias: "Búho Rojo", role: "rules" },
  { slotId: "slt_d", alias: "Oso Dorado", role: "testing" },
];

export function build(overrides: Partial<TeamSessionOptions> = {}) {
  const clock = new FakeClock();
  const session = new TeamSession({
    program: baseProgram,
    members: MEMBERS,
    mode: { kind: "turns" },
    clock,
    ...overrides,
  });
  return { clock, session };
}

/** Append a move to script `index` of `program`. Child proposals come from the web editor. */
export function moveProposal(
  id: string,
  program: ProjectProgram = baseProgram,
  index = 0,
  source: ProgramProposal["source"] = { kind: "web" },
  steps = 20,
): ProgramProposal {
  const script = program.scripts[index]!;
  return createProgramProposal({
    id,
    baseProgram: program,
    source,
    purpose: "Add a move.",
    rationale: "The team wants the character to go further.",
    affectedScriptIds: [script.id],
    affectedNodeIds: [`scripts[${index}]/statements[${script.statements.length}]`],
    operations: [
      { type: "appendStatement", scriptIndex: index, statement: { type: "move", steps } },
    ],
  });
}
