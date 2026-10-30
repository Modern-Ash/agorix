import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ADULT_TABS,
  ADULT_TAB_COPY,
  adultPanelId,
  adultTabForKey,
  adultTabId,
} from "./kidsAdultTabs.js";
import { AdultTabList, AdultTabPanel } from "./screens/AdultTabs.js";

// Issue #1109: the grown-ups panel is four tabs instead of one long page.
describe("grown-ups tabs", () => {
  it("are Resumen, Ajustes, Personalizar and Cuenta y privacidad, in that order", () => {
    expect(ADULT_TABS.map((tab) => ADULT_TAB_COPY.es[tab].label)).toEqual([
      "Resumen",
      "Ajustes",
      "Personalizar",
      "Cuenta y privacidad",
    ]);
    expect(ADULT_TABS.map((tab) => ADULT_TAB_COPY.en[tab].label)).toEqual([
      "Summary",
      "Settings",
      "Customize",
      "Account & privacy",
    ]);
  });

  it("use a short phone label that starts the full name, so the visible text stays in the name", () => {
    for (const locale of ["es", "en"] as const)
      for (const tab of ADULT_TABS) {
        const { label, short } = ADULT_TAB_COPY[locale][tab];
        expect(label.startsWith(short)).toBe(true);
        expect(short.length).toBeLessThanOrEqual(12);
      }
  });

  it("move with arrows that wrap, and with Home and End", () => {
    expect(adultTabForKey("summary", "ArrowRight")).toBe("settings");
    expect(adultTabForKey("account", "ArrowRight")).toBe("summary");
    expect(adultTabForKey("summary", "ArrowLeft")).toBe("account");
    expect(adultTabForKey("customize", "ArrowLeft")).toBe("settings");
    expect(adultTabForKey("customize", "Home")).toBe("summary");
    expect(adultTabForKey("settings", "End")).toBe("account");
  });

  it("ignore keys that are not tab navigation", () => {
    for (const key of ["Enter", " ", "Tab", "ArrowUp", "ArrowDown", "a"])
      expect(adultTabForKey("settings", key)).toBeNull();
  });

  it("render one selected tab in the Tab order that points at its panel", () => {
    const html = renderToStaticMarkup(
      <AdultTabList locale="es" current="customize" onSelect={() => undefined} />,
    );
    expect(html).toContain('role="tablist"');
    expect(html.match(/role="tab"/g)).toHaveLength(4);
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html).toContain(`aria-controls="${adultPanelId("customize")}"`);
    expect(html.match(/aria-controls=/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Cuenta y privacidad"');
    for (const tab of ADULT_TABS) expect(html).toContain(`id="${adultTabId(tab)}"`);
  });

  it("render a panel labelled by its tab", () => {
    const html = renderToStaticMarkup(
      <AdultTabPanel tab="account">
        <p>x</p>
      </AdultTabPanel>,
    );
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain(`id="${adultPanelId("account")}"`);
    expect(html).toContain(`aria-labelledby="${adultTabId("account")}"`);
  });
});
