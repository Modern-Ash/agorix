import { describe, expect, it } from "vitest";
import { getKidsAdvancedMission } from "@agorix/curriculum";
import {
  evaluateOriAdvancedOutput,
  evaluateOriReactOutput,
  evaluateOriScoreOutput,
  ORI_ADVANCED_VERSION,
  ORI_ADVANCED_REACT_VERSION,
  ORI_ADVANCED_SCORE_VERSION,
} from "@agorix/ori-agent";
import type { ProjectStore } from "@agorix/persistence";
import { requestAdvancedOri } from "./kidsAdvancedOriRemote.js";

const context = {
  stage: "scene" as const,
  actorId: "actor:ori" as const,
  locale: "es" as const,
  program: getKidsAdvancedMission("scene", "es").starterProgram,
};
const store = {
  has: (id: string) => id.startsWith("kids.space."),
  load: () => ({ metadata: { missionProgress: 1 }, program: context.program }),
} as unknown as ProjectStore;

describe("advanced Ori browser boundary", () => {
  it("accepts only a stage-scoped proposal and falls back on a tampered response", async () => {
    const model = evaluateOriAdvancedOutput(context, {
      version: ORI_ADVANCED_VERSION,
      kind: "program-suggestion",
      actorId: "actor:ori",
      block: { type: "playSound", soundId: "asset:sound.beacon" },
    });
    const fetchImpl = async (url: string | URL | Request) =>
      new Response(
        JSON.stringify(
          String(url).endsWith("/session")
            ? { token: "anonymous", stage: "scene" }
            : { message: model.message, proposal: model.proposal },
        ),
        { status: 200 },
      );
    const good = await requestAdvancedOri(context, store, fetchImpl as typeof fetch);
    expect(good.proposal?.operations[0]).toMatchObject({ statement: { type: "playSound" } });
    const tampered = async (url: string | URL | Request) =>
      new Response(
        JSON.stringify(
          String(url).endsWith("/session")
            ? { token: "anonymous", stage: "scene" }
            : {
                message: "bad",
                proposal: { ...model.proposal, affectedActorIds: ["actor:friend"] },
              },
        ),
        { status: 200 },
      );
    const safe = await requestAdvancedOri(context, store, tampered as typeof fetch);
    expect(safe.source).toBe("fallback");
    expect(safe.proposal?.affectedActorIds).toEqual(["actor:ori"]);
  });

  it("proves the completed scene and validates a stage-2 event proposal", async () => {
    const reactContext = {
      stage: "react" as const,
      actorId: "actor:ori" as const,
      locale: "es" as const,
      program: getKidsAdvancedMission("react", "es").starterProgram,
    };
    const model = evaluateOriReactOutput(reactContext, {
      version: ORI_ADVANCED_REACT_VERSION,
      kind: "event-suggestion",
      actorId: "actor:ori",
      event: "actorClicked",
      block: { type: "switchCostume", costumeId: "asset:costume.spark" },
    });
    const requests: unknown[] = [];
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)));
      return new Response(
        JSON.stringify(
          String(url).endsWith("/session")
            ? { token: "anonymous", stage: "react" }
            : { message: model.message, proposal: model.proposal },
        ),
        { status: 200 },
      );
    };
    const result = await requestAdvancedOri(reactContext, store, fetchImpl as typeof fetch);
    expect(result.source).toBe("model");
    expect(result.proposal?.operations[0]).toMatchObject({
      statement: { type: "switchCostume" },
    });
    expect(requests[0]).toMatchObject({ stage: "react", sceneProgram: context.program });
    expect(requests[1]).toMatchObject({ actorId: "actor:ori", program: reactContext.program });
  });

  it("sends both prior-stage proofs and validates a stage-3 score proposal", async () => {
    const scoreContext = {
      stage: "score" as const,
      actorId: "actor:ori" as const,
      locale: "es" as const,
      program: getKidsAdvancedMission("score", "es").starterProgram,
    };
    const model = evaluateOriScoreOutput(scoreContext, {
      version: ORI_ADVANCED_SCORE_VERSION,
      kind: "data-suggestion",
      actorId: "actor:ori",
      block: { type: "changeVariable", variableId: "score", delta: 1 },
    });
    const requests: unknown[] = [];
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)));
      return new Response(
        JSON.stringify(
          String(url).endsWith("/session")
            ? { token: "anonymous", stage: "score" }
            : { message: model.message, proposal: model.proposal },
        ),
        { status: 200 },
      );
    };
    const result = await requestAdvancedOri(scoreContext, store, fetchImpl as typeof fetch);
    expect(result.source).toBe("model");
    expect(result.proposal?.operations[0]).toMatchObject({ statement: { type: "changeVariable" } });
    expect(requests[0]).toMatchObject({
      stage: "score",
      sceneProgram: context.program,
      reactProgram: context.program,
    });
  });
});
