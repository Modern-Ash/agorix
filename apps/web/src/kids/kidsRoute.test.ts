import { describe, expect, it } from "vitest";
import { routeHash, stateFromHash, type KidsRouteLookup } from "./kidsRoute.js";
import { initialKidsState, type KidsState } from "./kidsState.js";

// Issue #596: a URL hash restores the screen, and nothing but a screen and an app-made id.
const base: KidsState = { ...initialKidsState("es"), screen: "map" };
const lookup: KidsRouteLookup = {
  studioProject: (id) => id === "studio-1",
};
const at = (hash: string) => stateFromHash(hash, base, lookup);

describe("Kids routes", () => {
  it("round-trips every screen through its hash", () => {
    const states: KidsState[] = [
      { ...base, screen: "map" },
      { ...base, screen: "create" },
      { ...base, screen: "projects" },
      { ...base, screen: "parents" },
      { ...base, screen: "advancedControl" },
      { ...base, screen: "editor", missionIndex: 1, world: "robots" },
      { ...base, screen: "studio", studioProjectId: "studio-1" },
    ];
    for (const state of states) {
      const hash = routeHash(state)!;
      const back = at(hash);
      expect(back?.screen, hash).toBe(state.screen);
      expect(back?.missionIndex, hash).toBe(state.screen === "editor" ? state.missionIndex : 0);
      expect(routeHash(back!)).toBe(hash);
    }
  });

  it("no longer opens the old #/libre project links", () => {
    expect(at("#/libre/free-1")).toBeNull();
  });

  it("reopens a mission scene deep link with its Map goal context", () => {
    expect(
      stateFromHash("#/escena/studio-1", base, {
        ...lookup,
        missionOfStudio: (id) => (id === "studio-1" ? { world: "ocean", index: 1 } : null),
      }),
    ).toMatchObject({ screen: "editor", world: "ocean", missionIndex: 1 });
  });

  it("sends a missing project, an unknown screen or a malformed hash nowhere", () => {
    for (const hash of [
      "",
      "#",
      "#/",
      "#/libre/gone",
      "#/escena/gone",
      "#/mision/9/space",
      "#/mision/1/mars",
      "#/mision/1",
      "#/avanzado/secreto",
      "#/mapa/extra",
      "#/libre/../etc",
      "#/escena/<script>",
      "#/admin",
    ])
      expect(at(hash), hash).toBeNull();
  });

  it("does not put onboarding in the address and keeps the reflect screen on the map", () => {
    expect(routeHash({ ...base, screen: "onboard" })).toBeNull();
    expect(routeHash({ ...base, screen: "reflect" })).toBe("#/mapa");
  });
});
