import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { acceptProposal } from "@agorix/proposals";
import {
  ORI_STUDIO_INTENTS,
  proposeOriStudioIntent,
  validateOriStudioIntentProposal,
} from "./studio.js";

// Issue #603: a goal from a closed list becomes a reviewable multi-block proposal.
const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "studio-actor-1-nova",
      trigger: { type: "greenFlag" },
      statements: [{ type: "say", text: "Hola" }],
    },
  ],
};
const context = { actorId: "actor:studio-1-nova", locale: "es" as const, program };

describe("Studio goal to blocks", () => {
  it("proposes several blocks for every goal and changes nothing by itself", () => {
    for (const intent of ORI_STUDIO_INTENTS) {
      const proposal = proposeOriStudioIntent(context, intent);
      expect(proposal.operations.length).toBeGreaterThan(1);
      expect(program.scripts[0]?.statements).toHaveLength(1);
      const review = validateOriStudioIntentProposal(context, proposal);
      expect(review.candidateProgram.scripts[0]?.statements).toHaveLength(
        1 + proposal.operations.length,
      );
    }
  });

  it("only changes the program when the proposal is accepted, and keeps the child's blocks", () => {
    const proposal = proposeOriStudioIntent(context, "square");
    const review = validateOriStudioIntentProposal(context, proposal);
    const accepted = acceptProposal(program, review).program;
    expect(accepted.scripts[0]?.statements[0]).toEqual({ type: "say", text: "Hola" });
    expect(accepted.scripts[0]?.statements).toHaveLength(9);
  });

  it("a music goal declares its pack on accept, and a stranger note or sound is refused", () => {
    for (const intent of ["melody", "rhythm"] as const) {
      const proposal = proposeOriStudioIntent(context, intent);
      const accepted = acceptProposal(program, validateOriStudioIntentProposal(context, proposal));
      expect(accepted.program.extensions).toEqual(["music"]);
    }
    const cheer = acceptProposal(
      program,
      validateOriStudioIntentProposal(context, proposeOriStudioIntent(context, "cheer")),
    );
    expect(cheer.program.extensions).toBeUndefined();
    const melody = proposeOriStudioIntent(context, "melody");
    for (const statement of [
      { type: "playNote" as const, note: 61, beats: 0.5 as const },
      { type: "playNote" as const, note: 60, beats: 2 as const },
      { type: "playSound" as const, soundId: "kids:custom" },
      { type: "setTempo" as const, bpm: 150 },
    ]) {
      const tampered = {
        ...melody,
        operations: melody.operations.map((operation, index) =>
          index === 1 && operation.type === "appendStatement"
            ? { ...operation, statement }
            : operation,
        ),
      };
      expect(() => validateOriStudioIntentProposal(context, tampered)).toThrow();
    }
  });

  it("rejects an unknown goal, another character, a changed block and a stale base", () => {
    expect(() => proposeOriStudioIntent(context, "teleport" as never)).toThrow();
    expect(() =>
      proposeOriStudioIntent({ ...context, actorId: "actor:studio-9-nova" }, "ahead"),
    ).toThrow();
    const proposal = proposeOriStudioIntent(context, "ahead");
    const tampered = {
      ...proposal,
      operations: proposal.operations.map((operation, index) =>
        index === 0 && operation.type === "appendStatement"
          ? { ...operation, statement: { type: "move" as const, steps: 60 } }
          : operation,
      ),
    };
    expect(() => validateOriStudioIntentProposal(context, tampered)).toThrow();
    const moved: ProjectProgram = {
      ...program,
      scripts: [{ ...program.scripts[0]!, statements: [] }],
    };
    expect(() =>
      validateOriStudioIntentProposal({ ...context, program: moved }, proposal),
    ).toThrow();
  });

  it("does not fit more than the studio allows", () => {
    const full: ProjectProgram = {
      ...program,
      scripts: [
        {
          ...program.scripts[0]!,
          statements: Array.from({ length: 58 }, () => ({ type: "show" as const })),
        },
      ],
    };
    expect(() => proposeOriStudioIntent({ ...context, program: full }, "square")).toThrow();
  });
});
