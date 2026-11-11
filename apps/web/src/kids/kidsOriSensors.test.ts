import { describe, expect, it } from "vitest";
import { createEditorHistory } from "@agorix/block-editor";
import { listIdeasFor, sensorIdeasFor } from "./kidsOriSensors.js";
import {
  addStudioActor,
  addStudioList,
  addStudioText,
  addStudioVariable,
  appendStudioStatement,
  createStudioProgram,
  STUDIO_EDGE_CONDITION,
  studioActorId,
} from "./kidsStudioModel.js";
import {
  ORI_LIST_INTENTS,
  ORI_SENSOR_INTENTS,
  proposeOriStudioIntent,
  validateOriStudioIntentProposal,
} from "@agorix/ori-agent";
import { acceptProposal } from "@agorix/proposals";
import { validateStudioProgram } from "./kidsStudioModel.js";

const nova = studioActorId(1, "nova");
const one = () => createEditorHistory(createStudioProgram("nova"));
const two = () => addStudioActor(one(), "mika");
const context = (history: ReturnType<typeof one>) => ({
  actorId: nova,
  locale: "es" as const,
  program: history.current,
});

describe("Ori's sensor ideas: only a sensor the program does not use yet (#1304)", () => {
  it("offers key, mouse and edge in a scene with one character, and touch when there are two", () => {
    expect(sensorIdeasFor(one().current)).toEqual(["reactKey", "reactMouse", "reactEdge"]);
    expect(sensorIdeasFor(two().current)).toEqual([
      "reactKey",
      "reactMouse",
      "reactEdge",
      "reactTouch",
    ]);
  });

  it("stops offering a sensor once the program uses it", () => {
    const withKey = appendStudioStatement(one(), nova, {
      type: "if",
      condition: { type: "keyDown", key: "Space" },
      then: [{ type: "move", steps: 40 }],
    });
    expect(sensorIdeasFor(withKey.current)).toEqual(["reactMouse", "reactEdge"]);
    const withEdge = appendStudioStatement(one(), nova, {
      type: "if",
      condition: { ...STUDIO_EDGE_CONDITION },
      then: [{ type: "turn", degrees: 90 }],
    });
    expect(sensorIdeasFor(withEdge.current)).toEqual(["reactKey", "reactMouse"]);
  });

  it("each idea is one reviewable block the Studio accepts, and nothing is added by itself", () => {
    for (const intent of ORI_SENSOR_INTENTS) {
      const history = two();
      const proposal = proposeOriStudioIntent(context(history), intent);
      expect(proposal.operations).toHaveLength(1);
      const review = validateOriStudioIntentProposal(context(history), proposal);
      expect(history.current.scripts[0]!.statements).toHaveLength(0);
      const accepted = validateStudioProgram(acceptProposal(history.current, review).program);
      const added = accepted.scripts[0]!.statements[0]!;
      expect(added.type).toBe("if");
      // It uses the sensor it is named for, and the Studio's own edge numbers.
      expect(JSON.stringify(added)).toContain(
        {
          reactKey: "keyDown",
          reactMouse: "mouseDown",
          reactEdge: "touchingStageEdge",
          reactTouch: "touchingActor",
        }[intent],
      );
    }
  });

  it("a touch idea names the other character, and needs one", () => {
    const proposal = proposeOriStudioIntent(context(two()), "reactTouch");
    expect(JSON.stringify(proposal.operations[0])).toContain(studioActorId(2, "mika"));
    expect(() => proposeOriStudioIntent(context(one()), "reactTouch")).toThrow();
  });

  it("refuses a sensor block that is not exactly one of Ori's", () => {
    const history = two();
    const good = proposeOriStudioIntent(context(history), "reactKey");
    const forged = {
      ...good,
      operations: [
        {
          type: "appendStatement" as const,
          scriptIndex: 0,
          statement: {
            type: "if" as const,
            condition: { type: "keyDown" as const, key: "ArrowUp" },
            then: [{ type: "changeY" as const, dy: -80 }],
          },
        },
      ],
    };
    expect(() => validateOriStudioIntentProposal(context(history), forged)).toThrow();
  });
});

describe("Ori's ideas for lists and words (design: word lists)", () => {
  const withData = () =>
    addStudioVariable(addStudioText(addStudioList(one(), "Compras"), "Fruta"), "Cuantas");

  it("offers nothing without a list, and each idea only with what it uses", () => {
    expect(listIdeasFor(one().current)).toEqual([]);
    expect(listIdeasFor(addStudioList(one(), "Compras").current)).toEqual([]);
    expect(listIdeasFor(addStudioText(addStudioList(one(), "Compras"), "Fruta").current)).toEqual([
      "listAsk",
      "listFirst",
    ]);
    expect(listIdeasFor(withData().current)).toEqual(["listAsk", "listFirst", "listCount"]);
  });

  it("stops offering an idea once the program does it", () => {
    let history = withData();
    history = appendStudioStatement(history, nova, {
      type: "askText",
      promptId: "word",
      variableId: "studio-text-1",
    });
    expect(listIdeasFor(history.current)).toEqual(["listFirst", "listCount"]);
  });

  it("each idea is blocks the Studio accepts, built from the scene's own list, word and number, and nothing is added by itself", () => {
    for (const intent of ORI_LIST_INTENTS) {
      const history = withData();
      const proposal = proposeOriStudioIntent(context(history), intent);
      const review = validateOriStudioIntentProposal(context(history), proposal);
      expect(history.current.scripts[0]!.statements).toHaveLength(0);
      const accepted = validateStudioProgram(acceptProposal(history.current, review).program);
      const added = JSON.stringify(accepted.scripts[0]!.statements);
      expect(added).toContain("studio-list-1");
      if (intent === "listAsk") {
        expect(proposal.operations).toHaveLength(2);
        expect(added).toContain('"promptId":"word"');
        // The word that goes in the list is the child's own answer, never a word of Ori's.
        expect(added).toContain('"type":"textVariable"');
        expect(added).not.toContain('"textLiteral"');
      }
    }
  });

  it("never writes a word of its own, and refuses an idea for a scene that lacks what it needs", () => {
    expect(() => proposeOriStudioIntent(context(one()), "listAsk")).toThrow();
    expect(() =>
      proposeOriStudioIntent(context(addStudioList(one(), "Compras")), "listFirst"),
    ).toThrow();
    const history = withData();
    const good = proposeOriStudioIntent(context(history), "listAsk");
    const forged = {
      ...good,
      operations: [
        {
          type: "appendStatement" as const,
          scriptIndex: 0,
          statement: {
            type: "listAdd" as const,
            listId: "studio-list-1",
            value: { type: "textLiteral" as const, value: "secreto" },
          },
        },
      ],
    };
    expect(() => validateOriStudioIntentProposal(context(history), forged)).toThrow();
  });
});
