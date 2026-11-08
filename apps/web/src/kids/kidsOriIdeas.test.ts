import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import {
  ORI_STUDIO_INTENTS,
  proposeOriStudioIntent,
  validateOriStudioIntentProposal,
} from "@agorix/ori-agent";
import { acceptProposal } from "@agorix/proposals";
import { runMultiActorProgram } from "@agorix/runtime";
import { creativeForStudio, validateStudioProgram } from "./kidsStudioModel.js";

// Every idea Ori offers has to survive the scene's own rules once the learner accepts it, and
// has to do something you can see or hear when it runs.
const empty = (): ProjectProgram =>
  validateStudioProgram({
    schema: SCHEMA_VERSION,
    scripts: [{ id: "studio-actor-1-nova", trigger: { type: "greenFlag" }, statements: [] }],
  });

describe("Ori's ideas inside the Kids scene", () => {
  for (const locale of ["es", "en"] as const)
    for (const intent of ORI_STUDIO_INTENTS)
      it(`${intent} (${locale}) becomes a valid scene program that runs`, () => {
        const program = empty();
        const context = { actorId: "actor:studio-1-nova", locale, program };
        const review = validateOriStudioIntentProposal(
          context,
          proposeOriStudioIntent(context, intent),
        );
        const accepted = validateStudioProgram(acceptProposal(program, review).program);
        const creative = creativeForStudio(accepted, "forest", locale);
        const run = runMultiActorProgram(accepted, creative, {
          pointer: { x: 100, y: 40, down: false },
        });
        expect(run.outcome).not.toBe("budget-exceeded");
        expect(run.trace.length).toBeGreaterThanOrEqual(2);
        const first = run.trace[0]!.worldBefore;
        const last = run.actors[0]!.world;
        const music = ["melody", "rhythm", "cheer"].includes(intent);
        const changed =
          last.sprite.x !== first.sprite.x ||
          last.sprite.y !== first.sprite.y ||
          last.sprite.heading !== first.sprite.heading ||
          (last.sprite.size ?? 100) !== (first.sprite.size ?? 100) ||
          (last.copies?.length ?? 0) > 0 ||
          run.trace.some(
            (entry) =>
              entry.worldAfter.sprite.visible === false ||
              entry.worldAfter.sprite.bubble !== undefined ||
              entry.worldAfter.sprite.size !== first.sprite.size ||
              entry.worldAfter.sprite.y !== first.sprite.y ||
              entry.worldAfter.sprite.heading !== first.sprite.heading,
          );
        expect(music || changed).toBe(true);
      });
});
