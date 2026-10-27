import { describe, expect, it } from "vitest";
import { createOriMig04RolloutController } from "./oriMig04RolloutController.js";

describe("MIG-04 dynamic rollback control", () => {
  it("starts disabled and applies kill switch without restart", () => {
    const controller = createOriMig04RolloutController();
    expect(controller.decide("pilot").learnerVisible).toBe(false);
    expect(controller.replaceFromHost({
      mode: "pilot",
      humanAuthorized: true,
      killSwitch: false,
      approvedProjectIds: ["pilot"],
    })).toBe(true);
    expect(controller.decide("pilot").learnerVisible).toBe(true);
    controller.emergencyDisable();
    expect(controller.decide("pilot")).toEqual({
      mode: "disabled",
      learnerVisible: false,
      fallbackToKids: true,
    });
  });
  it("rejects malformed policy without replacing current policy", () => {
    const controller = createOriMig04RolloutController();
    expect(controller.replaceFromHost({
      mode: "pilot",
      humanAuthorized: true,
      killSwitch: false,
      approvedProjectIds: ["../unsafe"],
    })).toBe(false);
    expect(controller.decide("pilot").mode).toBe("disabled");
  });
});
