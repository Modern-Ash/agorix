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
        1 + proposal.operations.filter((operation) => operation.type === "appendStatement").length,
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

  describe("the ideas that play with how the character looks and moves", () => {
    const NEW = [
      "jump",
      "spin",
      "grow",
      "bounce",
      "hideSeek",
      "wander",
      "follow",
      "greet",
    ] as const;

    it("proposes a short, closed sequence for each, and changes nothing by itself", () => {
      for (const intent of NEW) {
        const proposal = proposeOriStudioIntent(context, intent);
        expect(proposal.operations.length).toBeGreaterThanOrEqual(2);
        expect(proposal.operations.length).toBeLessThanOrEqual(8);
        expect(program.scripts[0]?.statements).toHaveLength(1);
        validateOriStudioIntentProposal(context, proposal);
      }
    });

    it("greets in the learner's language, with words Ori wrote", () => {
      const says = (locale: "es" | "en") =>
        proposeOriStudioIntent({ ...context, locale }, "greet").operations.map((operation) =>
          operation.type === "appendStatement" && operation.statement.type === "say"
            ? operation.statement.text
            : "",
        );
      expect(says("es")).toEqual(["¡Hola!", "¿Jugamos?"]);
      expect(says("en")).toEqual(["Hello!", "Shall we play?"]);
    });

    it("refuses any value outside the closed ones", () => {
      const base = proposeOriStudioIntent(context, "jump");
      const withStatement = (statement: unknown) => ({
        ...base,
        operations: [
          { type: "appendStatement" as const, scriptIndex: 0, statement },
          ...base.operations.slice(1),
        ],
      });
      for (const bad of [
        { type: "changeY", dy: 100 },
        { type: "wait", seconds: 5 },
        { type: "changeSize", delta: 50 },
        { type: "setSize", size: 150 },
        { type: "goToTarget", target: "moon" },
        { type: "say", text: "Dame tu nombre", seconds: 2 },
        { type: "say", text: "¡Hola!", seconds: 3 },
        { type: "setVolume", volume: 100 },
      ])
        expect(() =>
          validateOriStudioIntentProposal(context, withStatement(bad) as never),
        ).toThrow();
    });
  });
});

// Issue #1311: when the character has a script for its copies, rain and a crowd use it.
describe("Studio rain and crowd with a copy script", () => {
  const withCopyScript: ProjectProgram = {
    ...program,
    scripts: [
      ...program.scripts,
      {
        id: "studio-actor-1-nova-clone",
        trigger: { type: "onCloneStart" },
        statements: [{ type: "move", steps: 20 }],
      },
    ],
  };
  const scripted = { ...context, program: withCopyScript };

  it("proposes copies that run the copy script, and the child still reviews them", () => {
    for (const intent of ["rain", "crowd"] as const) {
      const proposal = proposeOriStudioIntent(scripted, intent);
      const copies = proposal.operations.flatMap((operation) =>
        operation.type === "appendStatement" && operation.statement.type === "createCopies"
          ? [operation.statement]
          : [],
      );
      expect(copies).toHaveLength(1);
      expect(copies[0]!.withScript).toBe(true);
      const review = validateOriStudioIntentProposal(scripted, proposal);
      // Nothing changed until accepted; once accepted, the program still validates.
      expect(withCopyScript.scripts[0]!.statements).toHaveLength(1);
      expect(acceptProposal(withCopyScript, review).program.scripts[0]!.statements).toHaveLength(
        1 + proposal.operations.length,
      );
    }
  });

  it("keeps plain copies without a copy script, and refuses scripted copies there", () => {
    const plain = proposeOriStudioIntent(context, "rain");
    expect(
      plain.operations.some(
        (operation) =>
          operation.type === "appendStatement" &&
          operation.statement.type === "createCopies" &&
          operation.statement.withScript === true,
      ),
    ).toBe(false);
    const forged = proposeOriStudioIntent(scripted, "rain");
    expect(() => validateOriStudioIntentProposal(context, forged)).toThrow();
  });
});

// Issue #1311: an idea that brings its own copy script, shown whole, accepted or refused as one.
describe("Studio ideas that add the copy script", () => {
  for (const intent of ["rainFalls", "crowdJumps"] as const) {
    it(`${intent} adds the script and the copies together, and only changes anything when accepted`, () => {
      const proposal = proposeOriStudioIntent(context, intent);
      expect(proposal.operations[0]!.type).toBe("addScript");
      expect(proposal.affectedScriptIds).toEqual([
        "studio-actor-1-nova",
        "studio-actor-1-nova-clone",
      ]);
      const review = validateOriStudioIntentProposal(context, proposal);
      // The preview already holds the new script; the project does not.
      expect(program.scripts).toHaveLength(1);
      expect(review.candidateProgram.scripts.map((script) => script.id)).toEqual([
        "studio-actor-1-nova",
        "studio-actor-1-nova-clone",
      ]);
      const accepted = acceptProposal(program, review).program;
      expect(accepted.scripts[1]!.trigger.type).toBe("onCloneStart");
      expect(accepted.scripts[1]!.statements.at(-1)).toEqual({ type: "deleteThisClone" });
      expect(
        accepted.scripts[0]!.statements.some(
          (statement) => statement.type === "createCopies" && statement.withScript === true,
        ),
      ).toBe(true);
    });
  }

  it("is not offered to a character that already has a copy script", () => {
    const has: ProjectProgram = {
      ...program,
      scripts: [
        ...program.scripts,
        {
          id: "studio-actor-1-nova-clone",
          trigger: { type: "onCloneStart" },
          statements: [{ type: "deleteThisClone" }],
        },
      ],
    };
    expect(() => proposeOriStudioIntent({ ...context, program: has }, "rainFalls")).toThrow();
  });

  it("refuses a script that is not the character's copy script or holds blocks outside the closed set", () => {
    const proposal = proposeOriStudioIntent(context, "rainFalls");
    const [added, ...rest] = proposal.operations;
    const forge = (script: unknown) => ({
      ...proposal,
      operations: [{ type: "addScript", script }, ...rest],
    });
    const good = (added as { script: { statements: unknown[] } }).script;
    expect(() =>
      validateOriStudioIntentProposal(context, forge({ ...good, id: "studio-actor-2-mika-clone" })),
    ).toThrow();
    expect(() =>
      validateOriStudioIntentProposal(
        context,
        forge({ ...good, statements: [{ type: "move", steps: 200 }, { type: "deleteThisClone" }] }),
      ),
    ).toThrow();
    expect(() =>
      validateOriStudioIntentProposal(context, forge({ ...good, trigger: { type: "greenFlag" } })),
    ).toThrow();
  });
});
