import { describe, expect, it } from "vitest";
import {
  composeOriInstructions,
  fixedOriInstructions,
  ORI_AGENT_CAPABILITIES,
  getOriAgentDefinitions,
  ORI_AGENT_LOCKED_RULES,
  ORI_AGENT_ROLES,
} from "./agents.js";

describe("Ori agent definitions", () => {
  it("covers every Ori capability once, with the four roles", () => {
    expect(
      getOriAgentDefinitions()
        .map((agent) => agent.capability)
        .sort(),
    ).toEqual([...ORI_AGENT_CAPABILITIES].sort());
    expect(new Set(getOriAgentDefinitions().map((agent) => agent.role))).toEqual(
      new Set(ORI_AGENT_ROLES),
    );
  });

  it.each(getOriAgentDefinitions().map((agent) => [agent.capability, agent] as const))(
    "%s keeps its contract in the fixed instructions, in both languages",
    (_name, agent) => {
      for (const locale of ["es", "en"] as const) {
        const fixed = fixedOriInstructions(agent.capability, locale);
        expect(fixed).toContain(agent.contract);
        expect(fixed).toMatch(/\b(?:no|never)\b[^.]*\b(?:free text|extra keys|other keys)/i);
      }
    },
  );

  it("only the classifier sees the child's text, and only as data", () => {
    const withText = getOriAgentDefinitions().filter((agent) => agent.input !== "ids-only");
    expect(withText.map((agent) => agent.role)).toEqual(["classifier"]);
  });

  it("an administrator's text is added after the contract and never replaces it", () => {
    const fixed = fixedOriInstructions("studio", "es");
    expect(composeOriInstructions(fixed, "")).toBe(fixed);
    const composed = composeOriInstructions(fixed, "Sé breve.");
    expect(composed.startsWith(fixed)).toBe(true);
    expect(composed.endsWith("ADMIN_ADDITIONAL_INSTRUCTIONS:\nSé breve.")).toBe(true);
  });

  it("lists the locked rules as ids", () => {
    expect(ORI_AGENT_LOCKED_RULES).toContain("deterministic-fallback");
    expect(new Set(ORI_AGENT_LOCKED_RULES).size).toBe(ORI_AGENT_LOCKED_RULES.length);
  });
});
