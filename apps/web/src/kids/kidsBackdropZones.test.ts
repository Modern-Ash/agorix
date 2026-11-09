import { describe, expect, it } from "vitest";
import { runMultiActorProgram } from "@agorix/runtime";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { BACKDROP_COLOR_ZONES, penColorOfHex } from "./kidsBackdropZones.js";
import { KIDS_GALLERY_BACKDROPS } from "./kidsGallery.js";
import { createStudioProgram, creativeForStudio } from "./kidsStudioModel.js";

describe("backdrop colour zones (#1304)", () => {
  it("names a hex colour by its hue in the closed pen palette", () => {
    expect(penColorOfHex("#5ea879")).toBe("green");
    expect(penColorOfHex("#b8d9f2")).toBe("blue");
    expect(penColorOfHex("#ffe5be")).toBe("orange");
    expect(penColorOfHex("#765ea7")).toBe("purple");
    expect(penColorOfHex("#ff0000")).toBe("red");
    expect(penColorOfHex("#101010")).toBe("dark");
    expect(penColorOfHex("#888888")).toBe("dark");
    expect(penColorOfHex("not a colour")).toBeUndefined();
  });

  it("gives every bundled backdrop a sky and a ground", () => {
    for (const backdrop of KIDS_GALLERY_BACKDROPS) {
      const zones = BACKDROP_COLOR_ZONES[`backdrop:${backdrop.id}`] ?? [];
      expect(zones).toHaveLength(2);
      expect(zones[0]!.y).toBeLessThan(zones[1]!.y);
    }
  });

  it("makes a scene answer for the ground of its backdrop and for nothing on a missing one", () => {
    const base = createStudioProgram("nova");
    const program: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [
        {
          ...base.scripts[0]!,
          statements: [
            { type: "goTo", x: 160, y: 80 },
            {
              type: "if",
              condition: { type: "touchingColor", color: "green" },
              then: [{ type: "say", text: "pasto" }],
            },
          ],
        },
      ],
    };
    const said = (backdrop: "forest" | "beach") =>
      runMultiActorProgram(program, creativeForStudio(program, backdrop, "es")).trace.some(
        (entry) => entry.statementType === "say",
      );
    // The forest's ground is green; the beach's sand is orange.
    expect(said("forest")).toBe(true);
    expect(said("beach")).toBe(false);
  });
});
