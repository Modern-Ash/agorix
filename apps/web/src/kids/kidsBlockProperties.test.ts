import { describe, expect, it } from "vitest";
import type { Statement } from "@agorix/program-model";
import { createEditorHistory } from "@agorix/block-editor";
import { editableFields, parseFieldValue } from "./kidsBlockProperties.js";
import {
  appendStudioStatement,
  createStudioProgram,
  setStudioStatementField,
} from "./kidsStudioModel.js";

describe("block properties (#1240)", () => {
  it("offers only blocks that have a value to edit", () => {
    expect(editableFields({ type: "stopSounds" }, "es")).toEqual([]);
    expect(editableFields({ type: "bounceOnEdge" }, "es")).toEqual([]);
    expect(editableFields({ type: "move", steps: 40 }, "es")).toHaveLength(1);
  });

  it("shows the current value among the options, labelled in the language", () => {
    const [field] = editableFields({ type: "turn", degrees: -90 }, "en");
    expect(field).toMatchObject({ key: "degrees", kind: "choice", label: "Degrees", value: "-90" });
    expect(field?.kind === "choice" && field.options.map((option) => option.value)).toContain(
      "-90",
    );
    const [steps] = editableFields({ type: "move", steps: 40 }, "es");
    expect(steps?.label).toBe("Casillas");
  });

  // The closed lists on screen must be exactly the values the model accepts.
  it("every option of every field is accepted by the model", () => {
    const nova = "actor:studio-1-nova";
    const samples: Statement[] = [
      { type: "move", steps: 40 },
      { type: "turn", degrees: 90 },
      { type: "wait", seconds: 1 },
      { type: "repeat", count: 3, body: [{ type: "move", steps: 40 }] },
      { type: "setSize", size: 100 },
      { type: "changeSize", delta: 25 },
      { type: "playSound", soundId: "kids:bell" },
      { type: "switchCostume", costumeId: "costume:mika" },
      { type: "say", text: "Hola" },
    ];
    for (const sample of samples) {
      let history = createEditorHistory(createStudioProgram("nova"));
      history = appendStudioStatement(history, nova, sample as never);
      for (const field of editableFields(sample, "es")) {
        const values = field.kind === "choice" ? field.options.map((o) => o.value) : ["Otro texto"];
        for (const raw of values)
          expect(() =>
            setStudioStatementField(history, nova, 0, field.key, parseFieldValue(field.key, raw)),
          ).not.toThrow();
      }
    }
  });

  it("parses numbers for numeric fields and keeps text and ids as they are", () => {
    expect(parseFieldValue("steps", "-60")).toBe(-60);
    expect(parseFieldValue("seconds", "0.5")).toBe(0.5);
    expect(parseFieldValue("soundId", "kids:bell")).toBe("kids:bell");
    expect(parseFieldValue("costumeId", "costume:nova")).toBe("costume:nova");
  });
});
