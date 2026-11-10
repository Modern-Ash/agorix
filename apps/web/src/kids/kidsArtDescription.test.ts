import { describe, expect, it } from "vitest";
import { artColorOf, describeArtSummary, summarizeArtPixels } from "./kidsArtDescription.js";

function fill(pixels: readonly (readonly [number, number, number, number])[]): Uint8ClampedArray {
  return Uint8ClampedArray.from(pixels.flat());
}

describe("kidsArtDescription", () => {
  it("names pixels from a closed colour list", () => {
    expect(artColorOf(255, 0, 0)).toBe("red");
    expect(artColorOf(0, 0, 255)).toBe("blue");
    expect(artColorOf(0, 200, 0)).toBe("green");
    expect(artColorOf(255, 255, 0)).toBe("yellow");
    expect(artColorOf(0, 0, 0)).toBe("black");
    expect(artColorOf(255, 255, 255)).toBe("white");
    expect(artColorOf(128, 128, 128)).toBe("grey");
    expect(artColorOf(150, 90, 30)).toBe("brown");
    expect(artColorOf(255, 150, 190)).toBe("pink");
  });

  it("ignores see-through pixels and small specks", () => {
    const summary = summarizeArtPixels(
      fill([
        [255, 0, 0, 255],
        [255, 0, 0, 255],
        [0, 0, 255, 255],
        [0, 0, 0, 0],
      ]),
    );
    expect(summary.filled).toBe(0.75);
    expect(summary.colors).toEqual(["red", "blue"]);
    expect(
      summarizeArtPixels(fill([...Array(19).fill([255, 0, 0, 255]), [0, 0, 255, 255]])).colors,
    ).toEqual(["red"]);
  });

  it("is deterministic and says an empty picture is empty", () => {
    const pixels = fill([[0, 0, 0, 0]]);
    expect(describeArtSummary(summarizeArtPixels(pixels), "costume", "es")).toBe(
      "Tu dibujo: casi vacío.",
    );
    expect(describeArtSummary(summarizeArtPixels(pixels), "backdrop", "en")).toBe(
      "Your backdrop: almost empty.",
    );
  });

  it("writes one short sentence in both languages", () => {
    const summary = { filled: 0.5, colors: ["blue", "green", "white"] } as const;
    expect(describeArtSummary(summary, "backdrop", "es")).toBe(
      "Tu fondo: ocupa buena parte, con azul, verde y blanco.",
    );
    expect(describeArtSummary({ filled: 1, colors: ["red"] }, "costume", "en")).toBe(
      "Your drawing: fills the whole picture, in red.",
    );
  });
});
