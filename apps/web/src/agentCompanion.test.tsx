import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentCompanion, companionMood } from "./AgentCompanion.js";

describe("agent companion", () => {
  it("picks the mood: off rests, review beats offer, offer, otherwise rest", () => {
    expect(companionMood({ enabled: false, hasOffer: true, reviewing: true })).toBe("resting");
    expect(companionMood({ enabled: true, hasOffer: true, reviewing: true })).toBe("reviewing");
    expect(companionMood({ enabled: true, hasOffer: true, reviewing: false })).toBe("offering");
    expect(companionMood({ enabled: true, hasOffer: false, reviewing: false })).toBe("resting");
  });

  it("speaks only while offering or reviewing, through a polite status region", () => {
    const offering = renderToStaticMarkup(
      <AgentCompanion
        locale="en"
        mood="offering"
        message="Want to try a step?"
        enabled
        onToggle={() => undefined}
      />,
    );
    expect(offering).toContain('role="status"');
    expect(offering).toContain('aria-live="polite"');
    expect(offering).toContain("Want to try a step?");
    expect(offering).toContain('data-mood="offering"');
    const resting = renderToStaticMarkup(
      <AgentCompanion
        locale="en"
        mood="resting"
        message="ignored"
        enabled
        onToggle={() => undefined}
      />,
    );
    expect(resting).not.toContain("ignored");
    expect(resting).toContain("Agent helps");
  });

  it("explains the off state and shows an unchecked, labelled toggle", () => {
    const off = renderToStaticMarkup(
      <AgentCompanion locale="es" mood="resting" enabled={false} onToggle={() => undefined} />,
    );
    expect(off).toContain("El agente está apagado");
    expect(off).toContain("El agente ayuda");
    expect(off).not.toContain("checked");
    expect(off).not.toContain("style=");
  });
});
