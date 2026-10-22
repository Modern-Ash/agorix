import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { kidsFormat } from "./format.js";
import { KidsApp } from "./KidsApp.js";
import { initialKidsState } from "./kidsState.js";

describe("KidsApp shell (issue #373)", () => {
  it("opens on onboarding in Spanish with no bottom navigation", () => {
    const html = renderToStaticMarkup(<KidsApp initialState={initialKidsState("es")} />);
    expect(html).toContain('lang="es"');
    expect(html).toContain("¡Hola!");
    expect(html).toContain("¿En qué idioma jugamos?");
    expect(html).not.toContain("kids-nav");
  });

  it("shows the map with the four-item navigation after onboarding", () => {
    const html = renderToStaticMarkup(
      <KidsApp initialState={{ ...initialKidsState("en"), screen: "map" }} />,
    );
    expect(html).toContain("Map");
    expect(html).toContain("kids-nav");
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Grown-ups");
  });

  it("formats placeholders like the prototype", () => {
    expect(kidsFormat("Llevá {s} hasta {g}", { s: "Nova", g: "la meta" })).toBe(
      "Llevá Nova hasta la meta",
    );
    expect(kidsFormat("hola {x}")).toBe("hola ");
  });
});
