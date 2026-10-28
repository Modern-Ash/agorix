import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectRepository } from "@agorix/project-repository";
import { createOriAuthorizedReviewOptions } from "./oriAuthorizedReviewComposition.js";
import { createOriMig04RolloutController } from "./oriMig04RolloutController.js";

function fixture(atomic: boolean) {
  const controller = createOriMig04RolloutController();
  const oriRoot = mkdtempSync(join(tmpdir(), "agorix-ori-mig04-"));
  const options = createOriAuthorizedReviewOptions({
    repository: {
      get: async () => {
        throw Error("no project");
      },
    } as unknown as ProjectRepository,
    oriRoot,
    world: {},
    runOriOverride: async () => ({ status: "rejected" }) as never,
    learningContext: async () => null,
    resolveSession: async () => null,
    activeProject: async () => null,
    oriMig04RolloutDecide: controller.decide,
    ...(atomic
      ? {
          oriMig04AtomicCommit: async () => "denied" as const,
        }
      : {}),
  });
  return { controller, options, cleanup: () => rmSync(oriRoot, { recursive: true, force: true }) };
}

describe("MIG-04 bundled pilot safety wiring", () => {
  it("denies pilot visibility and mutation without transactional atomic CAS", () => {
    const { controller, options, cleanup } = fixture(false);
    expect(
      controller.replaceFromHost({
        mode: "pilot",
        humanAuthorized: true,
        killSwitch: false,
        approvedProjectIds: ["pilot"],
      }),
    ).toBe(true);
    expect(options.oriMig04RolloutDecide?.("pilot").learnerVisible).toBe(false);
    expect("oriReviewApplyEnabled" in options).toBe(false);
    cleanup();
  });

  it("wires guarded apply only when trusted atomic CAS exists", async () => {
    const { controller, options, cleanup } = fixture(true);
    expect(
      controller.replaceFromHost({
        mode: "pilot",
        humanAuthorized: true,
        killSwitch: false,
        approvedProjectIds: ["pilot"],
      }),
    ).toBe(true);
    expect(options.oriMig04RolloutDecide?.("pilot").learnerVisible).toBe(true);
    expect("oriReviewApplyEnabled" in options).toBe(true);
    expect("oriReviewApply" in options).toBe(true);
    controller.emergencyDisable();
    expect(options.oriMig04RolloutDecide?.("pilot").learnerVisible).toBe(false);
    if ("oriReviewApply" in options && options.oriReviewApply) {
      expect(await options.oriReviewApply("student", "pilot", "ticket", "main")).toBe("rejected");
    }
    cleanup();
  });
});
