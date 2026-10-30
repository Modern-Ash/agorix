import { describe, expect, it } from "vitest";
import { ADMIN_NAV_GROUPS, changedSections, draftStatus } from "./adminDraft.js";

// Issue #1112: grouped AI Center menu and a draft bar that says what is pending.
const policy = (enabled: boolean) => ({ enabled, provider: "deterministic", model: "" });
const published = {
  capabilities: {
    mission: policy(true),
    advanced: policy(true),
    studio: policy(true),
    chat: policy(true),
    goals: policy(true),
    legacy: policy(false),
  },
  group: { enabled: false },
  behavior: { failuresBeforeIdea: 2 },
};

describe("AI Center menu", () => {
  it("lists every section once, rules first and monitoring last on its own", () => {
    const sections = ADMIN_NAV_GROUPS.flatMap((group) => group.sections);
    expect(new Set(sections).size).toBe(sections.length);
    expect(sections).toHaveLength(10);
    expect(ADMIN_NAV_GROUPS.map((group) => group.title)).toEqual([
      "Reglas",
      "Agentes de Ori",
      "Contenido y grupos",
      "Monitoreo",
    ]);
    expect(ADMIN_NAV_GROUPS.at(-1)!.sections).toEqual(["monitor"]);
  });
});

describe("draft changes", () => {
  it("finds nothing pending in an untouched draft", () => {
    expect(changedSections(published, structuredClone(published))).toEqual([]);
  });

  it("names each changed section in menu order", () => {
    const draft = structuredClone(published);
    draft.capabilities.chat.enabled = false;
    draft.behavior.failuresBeforeIdea = 3;
    draft.group.enabled = true;
    expect(changedSections(published, draft)).toEqual(["behavior", "chat", "group"]);
  });

  it("counts a section that appears or disappears as changed", () => {
    expect(changedSections(published, { ...published, group: undefined })).toEqual(["group"]);
  });
});

describe("draft status", () => {
  it("says when there is nothing to publish", () => {
    expect(draftStatus(0, false)).toBe("Sin cambios pendientes");
    expect(draftStatus(0, true)).toBe("Sin cambios pendientes");
  });

  it("counts pending sections and says when they are validated", () => {
    expect(draftStatus(1, false)).toBe("1 sección cambiada sin publicar");
    expect(draftStatus(3, false)).toBe("3 secciones cambiadas sin publicar");
    expect(draftStatus(2, true)).toBe("Validado: 2 secciones cambiadas, lista para publicar");
  });
});
