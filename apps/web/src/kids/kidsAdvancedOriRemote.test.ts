import { describe, expect, it } from "vitest";
import { getKidsAdvancedMission } from "@agorix/curriculum";
import { evaluateOriAdvancedOutput, ORI_ADVANCED_VERSION } from "@agorix/ori-agent";
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
});
