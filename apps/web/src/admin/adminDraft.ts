/**
 * The AI Center menu and draft bar (issue #1112): sections grouped by what they are for, and a
 * summary of what the unpublished draft changes. Pure, so it is tested without a browser.
 */

export type AdminCapability = "mission" | "advanced" | "studio" | "chat" | "goals" | "legacy";
export type AdminSection = AdminCapability | "group" | "behavior" | "catalog" | "monitor";

export interface AdminNavGroup {
  readonly title: string;
  readonly sections: readonly AdminSection[];
}

/** Rules first, then the agents, then content, and monitoring apart from anything that edits. */
export const ADMIN_NAV_GROUPS: readonly AdminNavGroup[] = [
  { title: "Reglas", sections: ["behavior", "goals"] },
  { title: "Agentes de Ori", sections: ["mission", "studio", "advanced", "chat", "legacy"] },
  { title: "Contenido y grupos", sections: ["catalog", "group"] },
  { title: "Monitoreo", sections: ["monitor"] },
];

interface DraftShape {
  readonly capabilities: Readonly<Record<string, unknown>>;
  readonly group?: unknown;
  readonly behavior?: unknown;
  readonly catalog?: unknown;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The sections whose settings differ between the published revision and the draft, in menu order. */
export function changedSections(published: DraftShape, draft: DraftShape): AdminSection[] {
  const sections = ADMIN_NAV_GROUPS.flatMap((group) => group.sections);
  return sections.filter((section) => {
    if (section === "monitor") return false;
    if (section === "group" || section === "behavior" || section === "catalog")
      return !same(published[section], draft[section]);
    return !same(published.capabilities[section], draft.capabilities[section]);
  });
}

/** The line on the draft bar: nothing pending, how many sections changed, or ready to publish. */
export function draftStatus(changed: number, validated: boolean): string {
  if (changed === 0) return "Sin cambios pendientes";
  const count = changed === 1 ? "1 sección cambiada" : `${changed} secciones cambiadas`;
  return validated ? `Validado: ${count}, lista para publicar` : `${count} sin publicar`;
}
