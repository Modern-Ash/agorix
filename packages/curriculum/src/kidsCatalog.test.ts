import { describe, expect, it } from "vitest";
import {
  defaultKidsCatalog,
  getKidsMission,
  KIDS_CATALOG_STORY_MAX,
  KIDS_CATALOG_TITLE_MAX,
  KIDS_MISSION_IDS,
  KIDS_MISSION_WORLDS,
  unsolvableKidsMissions,
  validateKidsCatalog,
  type KidsCatalog,
} from "./kids.js";

// Issue #616: missions as data, checked before they are stored and proven by the runtime.
const clone = () =>
  structuredClone(defaultKidsCatalog()) as unknown as {
    [world: string]: {
      start: { cx: number; cy: number };
      goal: { cx: number; cy: number };
      title: { es: string; en: string };
      story: { es: string; en: string };
    }[];
  };

describe("kids mission catalog", () => {
  it("the built-in catalog is valid, solvable, and reproduces today's missions exactly", () => {
    const catalog = validateKidsCatalog(defaultKidsCatalog());
    expect(unsolvableKidsMissions(catalog)).toEqual([]);
    for (const world of KIDS_MISSION_WORLDS) {
      for (const id of KIDS_MISSION_IDS) {
        for (const locale of ["es", "en"]) {
          expect(getKidsMission(id, locale, world, catalog)).toEqual(
            getKidsMission(id, locale, world),
          );
        }
      }
    }
  });

  it("a new layout moves the goal, counts its own hints and is still solved by the runtime", () => {
    const draft = clone();
    draft.ocean![0]!.goal = { cx: 3, cy: 0 };
    draft.ocean![0]!.title = { es: "Corriente corta", en: "Short current" };
    const catalog = validateKidsCatalog(draft);
    expect(unsolvableKidsMissions(catalog)).toEqual([]);
    const mission = getKidsMission(KIDS_MISSION_IDS[0], "es", "ocean", catalog);
    expect(mission.title).toBe("Corriente corta");
    expect(mission.starterStage.goal).toEqual({ x: 120, y: 0 });
    const hints = mission.hintLadder.map((hint) => hint.text).join(" ");
    expect(hints).toContain("son 2");
    expect(hints).not.toContain("son 4");
    // The other worlds and missions are untouched.
    expect(getKidsMission(KIDS_MISSION_IDS[1], "es", "ocean", catalog)).toEqual(
      getKidsMission(KIDS_MISSION_IDS[1], "es", "ocean"),
    );
  });

  it("changing only the words keeps the hand-written hints of the space world", () => {
    const draft = clone();
    draft.space![0]!.title = { es: "Camino corto", en: "Short path" };
    const catalog = validateKidsCatalog(draft);
    const edited = getKidsMission(KIDS_MISSION_IDS[0], "es", "space", catalog);
    const original = getKidsMission(KIDS_MISSION_IDS[0], "es", "space");
    expect(edited.title).toBe("Camino corto");
    expect(edited.hintLadder).toEqual(original.hintLadder);
  });

  it.each([
    ["a missing world", (d: ReturnType<typeof clone>) => delete d.city],
    ["an extra world", (d: ReturnType<typeof clone>) => void (d.moon = d.city!)],
    ["two missions", (d: ReturnType<typeof clone>) => void d.city!.pop()],
    ["a goal outside the grid", (d: ReturnType<typeof clone>) => void (d.city![0]!.goal.cx = 6)],
    ["a start outside the grid", (d: ReturnType<typeof clone>) => void (d.city![0]!.start.cy = -1)],
    ["a fractional cell", (d: ReturnType<typeof clone>) => void (d.city![0]!.goal.cy = 1.5)],
    ["a goal left of the start", (d: ReturnType<typeof clone>) => void (d.city![1]!.goal.cx = 0)],
    [
      "a goal on the start",
      (d: ReturnType<typeof clone>) => void (d.city![0]!.goal = { ...d.city![0]!.start }),
    ],
    ["an empty title", (d: ReturnType<typeof clone>) => void (d.city![0]!.title.es = "")],
    [
      "a long title",
      (d: ReturnType<typeof clone>) =>
        void (d.city![0]!.title.en = "x".repeat(KIDS_CATALOG_TITLE_MAX + 1)),
    ],
    [
      "a long story",
      (d: ReturnType<typeof clone>) =>
        void (d.city![0]!.story.es = "x".repeat(KIDS_CATALOG_STORY_MAX + 1)),
    ],
    [
      "a link in the words",
      (d: ReturnType<typeof clone>) => void (d.city![0]!.title.es = "ir a http://x.io"),
    ],
    [
      "markup in the words",
      (d: ReturnType<typeof clone>) => void (d.city![0]!.story.en = "<b>hi</b>"),
    ],
    [
      "an extra field",
      (d: ReturnType<typeof clone>) => void ((d.city![0] as Record<string, unknown>).prompt = "x"),
    ],
    [
      "padding in the words",
      (d: ReturnType<typeof clone>) => void (d.city![0]!.title.es = " Calle"),
    ],
  ])("refuses %s", (_name, change) => {
    const draft = clone();
    change(draft);
    expect(() => validateKidsCatalog(draft)).toThrow();
  });

  it("refuses things that are not a catalog", () => {
    for (const value of [null, [], "x", 3, {}]) expect(() => validateKidsCatalog(value)).toThrow();
  });

  it("reports a mission the runtime cannot win", () => {
    // Bypassing validation on purpose: a goal the straight-then-turn answer cannot reach.
    const broken = structuredClone(defaultKidsCatalog()) as unknown as {
      [world: string]: { goal: { cx: number; cy: number } }[];
    };
    broken.city![0]!.goal = { cx: 9, cy: 1 };
    expect(unsolvableKidsMissions(broken as unknown as KidsCatalog)).toContain("city:0");
  });
});
