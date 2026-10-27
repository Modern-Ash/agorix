import { describe, expect, it } from "vitest";
import { createOriMig04RolloutGate } from "./oriMig04RolloutGate.js";

describe("MIG-04 reversible rollout policy", () => {
  it("defaults to Kids when disabled or kill switch active", () => {
    const disabled = createOriMig04RolloutGate({
      mode: "disabled",
      humanAuthorized: false,
      killSwitch: false,
      approvedProjectIds: [],
    });
    expect(disabled.decide("project").fallbackToKids).toBe(true);
    expect(disabled.decide("project").learnerVisible).toBe(false);
    const killed = createOriMig04RolloutGate({
      mode: "pilot",
      humanAuthorized: true,
      killSwitch: true,
      approvedProjectIds: ["project"],
    });
    expect(killed.decide("project").mode).toBe("disabled");
  });
  it("keeps shadow invisible and restricts pilot to authorized projects", () => {
    const shadow = createOriMig04RolloutGate({
      mode: "shadow",
      humanAuthorized: true,
      killSwitch: false,
      approvedProjectIds: ["project"],
    });
    expect(shadow.decide("project").learnerVisible).toBe(false);
    const pilot = createOriMig04RolloutGate({
      mode: "pilot",
      humanAuthorized: true,
      killSwitch: false,
      approvedProjectIds: ["project"],
    });
    expect(pilot.decide("project").learnerVisible).toBe(true);
    expect(pilot.decide("other").learnerVisible).toBe(false);
    expect(pilot.decide("project").fallbackToKids).toBe(true);
  });
});
