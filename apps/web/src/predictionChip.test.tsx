import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { touchingGoal } from "@agorix/runtime";
import { PredictionChip, PredictionComparison } from "./PredictionChip.js";
import { t } from "./i18n.js";

describe("prediction chip", () => {
  it("shows three buttons whose pressed state follows the answer", () => {
    const html = renderToStaticMarkup(
      <PredictionChip locale="en" answer="yes" onAnswer={() => undefined} />,
    );
    expect(html.match(/<button/g)).toHaveLength(3);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Will the character reach the goal?");
    const skipped = renderToStaticMarkup(
      <PredictionChip locale="en" answer={undefined} onAnswer={() => undefined} />,
    );
    expect(skipped.match(/aria-pressed="true"/g)).toHaveLength(1);
  });

  it("compares only with a real answer and a real observation", () => {
    const none = (answer: "yes" | "no" | undefined, reached: boolean | undefined) =>
      renderToStaticMarkup(
        <PredictionComparison locale="en" answer={answer} reachedGoal={reached} />,
      );
    expect(none(undefined, true)).toBe("");
    expect(none("yes", undefined)).toBe("");
    const matched = none("yes", true);
    expect(matched).toContain("it reached the goal");
    expect(matched).toContain("runtime fact");
    expect(matched).not.toContain("good thing to look at");
    expect(none("yes", false)).toContain("good thing to look at");
    expect(none("no", false)).not.toContain("good thing to look at");
    expect(matched).not.toContain("style=");
  });

  it("has Spanish copy for every prediction string and a goal check from the runtime", () => {
    for (const key of [
      "predictQuestion",
      "predictYes",
      "predictNo",
      "predictSkip",
      "runtimeFactLabel",
    ] as const) {
      expect(t("es", key)).not.toBe(t("en", key) === "No" ? "" : t("en", key));
    }
    expect(typeof touchingGoal).toBe("function");
  });
});
