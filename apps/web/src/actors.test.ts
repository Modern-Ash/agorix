import { describe, expect, it } from "vitest";
import { validateProjectActors } from "@agorix/persistence";
import { INITIAL_STAGE } from "./editorModel";
import {
  activeActor,
  defaultActors,
  patchActive,
  stageForActors,
  toggleSound,
  withBackdrop,
} from "./actors";

describe("web actors", () => {
  it("defaults to a valid actor at the mission start", () => {
    const actors = defaultActors(INITIAL_STAGE);
    expect(validateProjectActors(actors)).toEqual(actors);
    expect(activeActor(actors).x).toBe(INITIAL_STAGE.initial.sprite.x);
  });

  it("keeps edits inside the persisted contract", () => {
    const edited = patchActive(defaultActors(INITIAL_STAGE), {
      name: "  ",
      direction: -90,
      size: 0,
      x: 1e9,
    });
    expect(validateProjectActors(edited)).toEqual(edited);
    expect(activeActor(edited).direction).toBe(270);
  });

  it("starts the stage from the actor and keeps the goal", () => {
    const actors = patchActive(defaultActors(INITIAL_STAGE), { x: 50, y: 60, direction: 45 });
    const stage = stageForActors(INITIAL_STAGE, actors);
    expect(stage.initial.sprite).toMatchObject({ x: 50, y: 60, heading: 45 });
    expect(stage.initial.goal).toEqual(INITIAL_STAGE.initial.goal);
  });
});

describe("library choices", () => {
  it("sets and clears the actor costume and the stage backdrop", () => {
    const base = defaultActors(INITIAL_STAGE);
    const chosen = withBackdrop(patchActive(base, { costume: "cat" }), "space");
    expect(validateProjectActors(chosen)).toEqual(chosen);
    expect(activeActor(chosen).costume).toBe("cat");
    expect(chosen.backdrop).toBe("space");
    const cleared = withBackdrop(patchActive(chosen, { costume: null }), "");
    expect(activeActor(cleared).costume).toBeUndefined();
    expect(cleared.backdrop).toBeUndefined();
    expect(patchActive(chosen, { x: 3 }).items[0]?.costume).toBe("cat");
  });
});

describe("sound attachment", () => {
  it("toggles unique sounds and stays valid", () => {
    const base = defaultActors(INITIAL_STAGE);
    const one = toggleSound(base, "pop");
    const two = toggleSound(one, "chime");
    expect(two.sounds).toEqual(["pop", "chime"]);
    expect(validateProjectActors(two)).toEqual(two);
    const back = toggleSound(toggleSound(two, "pop"), "chime");
    expect(back.sounds).toBeUndefined();
  });
});
