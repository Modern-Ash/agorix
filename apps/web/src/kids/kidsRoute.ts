import type { KidsScreen, KidsState, KidsWorld } from "./kidsState.js";
import { KIDS_WORLDS } from "./kidsState.js";

/**
 * Where the child is, as a URL hash (issue #596). Reloading or using Back and Forward returns to the
 * same mission, scene or project. The hash holds only a screen and an id the app made itself; it
 * never holds a name, text or anything typed, and an id that no longer exists falls back to the map.
 */
const ADVANCED: Readonly<Record<string, KidsScreen>> = {
  escena: "advanced",
  reaccion: "advancedReact",
  puntos: "advancedScore",
  control: "advancedControl",
  mensaje: "advancedMessage",
};
const ADVANCED_PATH: Readonly<Partial<Record<KidsScreen, string>>> = {
  advanced: "escena",
  advancedReact: "reaccion",
  advancedScore: "puntos",
  advancedControl: "control",
  advancedMessage: "mensaje",
};
const PLAIN: Readonly<Record<string, KidsScreen>> = {
  mapa: "map",
  crear: "create",
  proyectos: "projects",
  adultos: "parents",
};
const ID = /^[A-Za-z0-9_-]{1,64}$/;

export interface KidsRouteLookup {
  readonly studioProject: (id: string) => boolean;
  readonly missionOfStudio?: (
    id: string,
  ) => { readonly world: KidsWorld; readonly index: 0 | 1 | 2 } | null;
}

export function routeHash(state: KidsState): string | null {
  switch (state.screen) {
    case "onboard":
      return null;
    case "map":
    case "reflect":
      return "#/mapa";
    case "create":
      return "#/crear";
    case "projects":
      return "#/proyectos";
    case "parents":
      return "#/adultos";
    case "studio":
      return state.studioProjectId ? `#/escena/${state.studioProjectId}` : "#/crear";
    case "editor":
      return `#/mision/${state.missionIndex + 1}/${state.world}`;
    default: {
      const path = ADVANCED_PATH[state.screen];
      return path ? `#/avanzado/${path}` : "#/mapa";
    }
  }
}

/** The state a hash points to, or null when it points nowhere that exists. */
export function stateFromHash(
  hash: string,
  current: KidsState,
  lookup: KidsRouteLookup,
): KidsState | null {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const [head, a, b] = parts;
  if (!head) return null;
  const plain = PLAIN[head];
  if (plain && parts.length === 1) return { ...current, screen: plain };
  if (head === "avanzado" && a && parts.length === 2) {
    const screen = ADVANCED[a];
    return screen ? { ...current, screen } : null;
  }
  if (head === "mision" && a && /^[1-3]$/.test(a) && b && parts.length === 3) {
    const world = KIDS_WORLDS.find((item) => item === b);
    if (!world) return null;
    return {
      ...current,
      screen: "editor",
      world,
      missionIndex: (Number(a) - 1) as 0 | 1 | 2,
    };
  }
  if (head === "escena" && a && ID.test(a) && parts.length === 2) {
    if (!lookup.studioProject(a)) return null;
    const mission = lookup.missionOfStudio?.(a);
    if (mission)
      return {
        ...current,
        screen: "editor",
        world: mission.world,
        missionIndex: mission.index,
      };
    return { ...current, screen: "studio", studioProjectId: a };
  }
  return null;
}
