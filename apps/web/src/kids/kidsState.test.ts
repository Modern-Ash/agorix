import { describe, expect, it } from "vitest";
import { initialKidsState, kidsReducer, type KidsAction, type KidsState } from "./kidsState.js";

const run = (state: KidsState, ...actions: KidsAction[]) => actions.reduce(kidsReducer, state);

describe("kids state (issue #373)", () => {
  it("starts on onboarding in the given locale with no program state", () => {
    const state = initialKidsState("es");
    expect(state).toMatchObject({ screen: "onboard", onboardStep: 0, locale: "es" });
    expect(Object.keys(state).sort()).toEqual(
      ["avatar", "locale", "missionIndex", "onboardStep", "screen", "world"].sort(),
    );
  });

  it("walks the three onboarding steps and lands on the map", () => {
    let state = initialKidsState("es");
    state = run(state, { type: "onboardNext" });
    expect(state.onboardStep).toBe(1);
    state = run(state, { type: "onboardNext" });
    expect(state.onboardStep).toBe(2);
    state = run(state, { type: "onboardNext" });
    expect(state).toMatchObject({ screen: "map", onboardStep: 0 });
  });

  it("keeps the learner's choices", () => {
    const state = run(
      initialKidsState("es"),
      { type: "setLocale", locale: "en" },
      { type: "pickAvatar", avatar: "🐼" },
      { type: "pickWorld", world: "ocean" },
    );
    expect(state).toMatchObject({ locale: "en", avatar: "🐼", world: "ocean" });
  });

  it("opens the editor on the chosen mission and returns to the map", () => {
    let state = run(initialKidsState("es"), { type: "pickMission", missionIndex: 2 });
    expect(state).toMatchObject({ screen: "editor", missionIndex: 2 });
    state = run(state, { type: "go", screen: "map" });
    expect(state.screen).toBe("map");
  });
});
