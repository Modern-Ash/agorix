import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, validateProgram, type ProjectProgram } from "@agorix/program-model";
import { programSemanticHash } from "@agorix/proposals";
import { evaluateOriStudioOutput, ORI_STUDIO_VERSION } from "./studio.js";
import { rebaseRedactedProposal, redactProgramForOri } from "./redact.js";

const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  variables: [{ id: "v", name: "Puntos de Ana", initialValue: 0, visible: true }],
  textVariables: [{ id: "t", name: "Mi secreto", initialValue: "dato", visible: true }],
  lists: [{ id: "l", name: "Amigos de Ana", initialItems: [1, "Lucía"], visible: true }],
  sharedProcedures: [
    {
      id: "shared-1",
      name: "Saltito de Ana",
      params: [{ id: "p1", name: "Altura de Ana" }],
      body: [{ type: "move", steps: 20, stepsFrom: "p1" }],
    },
  ],
  scripts: [
    {
      id: "studio-actor-1-nova",
      trigger: { type: "onKeyPressed", key: "ArrowRight" },
      statements: [
        { type: "say", text: "Hola, soy Ana", seconds: 2 },
        { type: "think", text: "pienso en Lucía" },
        { type: "setText", variableId: "t", value: { type: "textLiteral", value: "mi perro" } },
        {
          type: "say",
          text: "Tengo",
          append: {
            type: "join",
            left: { type: "textLiteral", value: "dos " },
            right: { type: "textVariable", variableId: "t" },
          },
        },
        { type: "move", steps: 40 },
      ],
      procedures: [
        {
          id: "proc-1-1",
          name: "Baile de Ana",
          params: [{ id: "p1", name: "Cuánto baila Ana" }],
          body: [{ type: "move", steps: 40, stepsFrom: "p1" }],
        },
      ],
    },
  ],
};
const secrets = [
  "Ana",
  "secreto",
  "dato",
  "Lucía",
  "perro",
  "Baile",
  "Cuánto",
  "Hola",
  "Tengo",
  "dos ",
  "Saltito",
  "Altura",
  "pienso",
];

describe("the program Ori's service is sent", () => {
  it("keeps none of the words a child wrote, in any place a program holds them", () => {
    const text = JSON.stringify(redactProgramForOri(program));
    for (const word of secrets) expect(text, word).not.toContain(word);
  });

  it("is a valid program of the same shape: ids, block kinds, numbers and closed choices stay", () => {
    const redacted = redactProgramForOri(program);
    expect(validateProgram(redacted)).toEqual(redacted);
    const shape = (value: ProjectProgram) =>
      JSON.stringify(value, (key, item) =>
        ["name", "text", "initialValue"].includes(key) ||
        (key === "value" && typeof item === "string")
          ? "·"
          : key === "initialItems"
            ? []
            : item,
      );
    expect(shape(redacted)).toBe(shape(validateProgram(program)));
    expect(redacted.scripts[0]!.trigger).toEqual({ type: "onKeyPressed", key: "ArrowRight" });
    expect(redacted.scripts[0]!.statements.map((statement) => statement.type)).toEqual([
      "say",
      "think",
      "setText",
      "say",
      "move",
    ]);
  });

  it("does not change the program it was given", () => {
    const before = JSON.stringify(program);
    redactProgramForOri(program);
    expect(JSON.stringify(program)).toBe(before);
  });

  it("is the same for the same program, so an idea can be matched to it", () => {
    expect(programSemanticHash(redactProgramForOri(program))).toBe(
      programSemanticHash(redactProgramForOri(program)),
    );
  });
});

describe("an idea made for the redacted program", () => {
  const context = { actorId: "actor:studio-1-nova", locale: "es" as const };
  const model = {
    version: ORI_STUDIO_VERSION,
    kind: "program-suggestion",
    actorId: context.actorId,
    block: { type: "turn", degrees: 90 },
  };

  it("is put back on the child's program only if it was made for it", () => {
    const offered = evaluateOriStudioOutput(
      { ...context, program: redactProgramForOri(program) },
      model,
    ).proposal!;
    const rebased = rebaseRedactedProposal(program, offered);
    expect(rebased.baseProgramHash).toBe(programSemanticHash(program));
    expect(rebased.operations).toEqual(offered.operations);
    const other = { ...program, extensions: ["pen" as const] };
    expect(() => rebaseRedactedProposal(other, offered)).toThrow();
  });
});

describe("a guard for the next field a child can write into", () => {
  it("fails when the program schema gains a text field that redaction does not know", () => {
    const source = readFileSync(
      new URL("../../program-model/src/schema.ts", import.meta.url),
      "utf8",
    );
    // Every `readonly x: string` field of the schema, by name.
    const textFields = new Set([...source.matchAll(/readonly (\w+): string;/g)].map((m) => m[1]!));
    // Reviewed: either redacted by `redactProgramForOri`, or an id, a closed choice or a kind.
    const known = new Set([
      // redacted
      "name",
      "text",
      "value",
      "initialValue",
      // ids and references
      "id",
      "variableId",
      "listId",
      "procedureId",
      "actorId",
      "soundId",
      "costumeId",
      "backdropId",
      "promptId",
      // kinds and closed choices
      "type",
      "key",
      "message",
      "schema",
    ]);
    const unknown = [...textFields].filter((field) => !known.has(field));
    expect(
      unknown,
      "a new text field in the program: redact it or add it to the reviewed list",
    ).toEqual([]);
  });
});
