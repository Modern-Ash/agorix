import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createNavigationSections } from "./studioCore.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
  contributes: {
    commands: Array<{ command: string; icon?: string }>;
    views: { agorixStudio: Array<{ id: string; name: string; icon?: string }> };
    menus: Record<string, Array<{ command: string; when?: string; group?: string }>>;
  };
};
const nls = JSON.parse(readFileSync(resolve(root, "package.nls.json"), "utf8")) as Record<
  string,
  string
>;
const resolveNls = (value: string | undefined) =>
  value?.replace(/^%([^%]+)%$/, (_match, key: string) => nls[key] ?? value);
const commandIds = new Set(manifest.contributes.commands.map((c) => c.command));

describe("Studio shell manifest", () => {
  it("gives every command a codicon so toolbars are icon-first", () => {
    for (const command of manifest.contributes.commands) {
      expect(command.icon, command.command).toMatch(/^\$\([a-z0-9-]+\)$/);
    }
  });

  it("names the five shell views and gives each an icon", () => {
    const views = manifest.contributes.views.agorixStudio;
    const byId = new Map(views.map((view) => [view.id, view]));
    expect(resolveNls(byId.get("agorixStudio.projects")?.name)).toBe("Projects");
    expect(resolveNls(byId.get("agorixStudio.missions")?.name)).toBe("Missions");
    expect(resolveNls(byId.get("agorixStudio.progress")?.name)).toBe("Progress");
    expect(resolveNls(byId.get("agorixStudio.worlds")?.name)).toBe("Worlds");
    expect(resolveNls(byId.get("agorixStudio.inspector")?.name)).toBe("Inspector");
    for (const view of views) expect(view.icon, view.id).toMatch(/^\$\(/);
  });

  it("exposes Run, Step, Stop, Reset and projection switch in the editor title", () => {
    const editor = manifest.contributes.menus["editor/title"] ?? [];
    for (const name of ["run", "step", "stop", "reset", "switchProjection"]) {
      const entry = editor.find((item) => item.command === `agorixStudio.${name}`);
      expect(entry?.group, name).toMatch(/^navigation@\d+$/);
    }
  });

  it("exposes Run, Step, Stop and Reset in the view title of the execution views", () => {
    const view = manifest.contributes.menus["view/title"] ?? [];
    for (const name of ["run", "step", "stop", "reset"]) {
      const entry = view.find((item) => item.command === `agorixStudio.${name}`);
      expect(entry?.when, name).toContain("agorixStudio.projects");
      expect(entry?.when, name).toContain("agorixStudio.inspector");
      expect(entry?.when, name).toContain("agorixStudio.progress");
    }
  });

  it("only references contributed commands in menus", () => {
    for (const [menu, entries] of Object.entries(manifest.contributes.menus)) {
      for (const entry of entries)
        expect(commandIds.has(entry.command), `${menu}:${entry.command}`).toBe(true);
    }
  });
});

describe("Studio shell navigation model", () => {
  const project = undefined;

  it("keeps labels short and moves detail into tooltips", () => {
    for (const section of createNavigationSections(project)) {
      for (const item of section.items) {
        expect(item.label.length, item.label).toBeLessThanOrEqual(32);
        expect((item.description ?? "").length, item.label).toBeLessThanOrEqual(24);
        expect(item.icon, item.label).toBeDefined();
      }
    }
  });
});
