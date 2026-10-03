import { normalizeLocale, type MissionConcept, type SupportedLocale } from "./index.js";

export const WORLD_SCHEMA_VERSION = "agorix/world/v1";

export type WorldId = "space.trailhead" | "ocean.reef" | "robots.workshop" | "city.crossing";
export type WorldPalette = "space" | "ocean" | "robots" | "city";

export interface WorldCopy {
  readonly title: string;
  readonly narrative: string;
  readonly spriteName: string;
  readonly goalName: string;
  readonly spriteAlt: string;
  readonly goalAlt: string;
  readonly reachedFeedback: string;
  readonly stoppedShortFeedback: string;
}

/**
 * Narrative and visual framing for a mission. A World never carries program,
 * runtime or completion semantics: those stay in the mission and the runtime.
 */
export interface WorldDefinition {
  readonly schema: typeof WORLD_SCHEMA_VERSION;
  readonly id: WorldId;
  readonly version: 1;
  readonly defaultLocale: SupportedLocale;
  readonly supportedLocales: readonly SupportedLocale[];
  readonly concepts: readonly MissionConcept[];
  readonly visualStyle: { readonly palette: WorldPalette };
  readonly missionBindings: readonly { readonly missionId: string; readonly version: number }[];
  readonly copy: Readonly<Record<SupportedLocale, WorldCopy>>;
}

// Literal on purpose: importing FIRST_MISSION here would create an import cycle with index.ts.
// worlds.test.ts asserts these match FIRST_MISSION.
const binding = [{ missionId: "first-mission.reach-goal", version: 1 }] as const;
const concepts = ["sequence", "events", "movement"] as const;

export const WORLDS: readonly WorldDefinition[] = Object.freeze([
  {
    schema: WORLD_SCHEMA_VERSION,
    id: "space.trailhead",
    version: 1,
    defaultLocale: "en",
    supportedLocales: ["en", "es"],
    concepts,
    visualStyle: { palette: "space" },
    missionBindings: binding,
    copy: {
      en: {
        title: "Space",
        narrative: "A small explorer needs to travel from the launch pad to a beacon.",
        spriteName: "Explorer",
        goalName: "Beacon",
        spriteAlt: "Explorer ship",
        goalAlt: "Beacon",
        reachedFeedback: "The explorer reached the beacon.",
        stoppedShortFeedback: "The explorer stopped before the beacon.",
      },
      es: {
        title: "Espacio",
        narrative:
          "Un pequeño explorador debe viajar desde la plataforma de lanzamiento hasta una baliza.",
        spriteName: "Explorador",
        goalName: "Baliza",
        spriteAlt: "Nave exploradora",
        goalAlt: "Baliza",
        reachedFeedback: "El explorador llegó a la baliza.",
        stoppedShortFeedback: "El explorador se detuvo antes de la baliza.",
      },
    },
  },
  {
    schema: WORLD_SCHEMA_VERSION,
    id: "ocean.reef",
    version: 1,
    defaultLocale: "en",
    supportedLocales: ["en", "es"],
    concepts,
    visualStyle: { palette: "ocean" },
    missionBindings: binding,
    copy: {
      en: {
        title: "Ocean",
        narrative: "A little submarine must swim to the marker beside the coral reef.",
        spriteName: "Submarine",
        goalName: "Marker",
        spriteAlt: "Small submarine",
        goalAlt: "Reef marker",
        reachedFeedback: "The submarine reached the marker.",
        stoppedShortFeedback: "The submarine stopped before the marker.",
      },
      es: {
        title: "Océano",
        narrative: "Un pequeño submarino debe nadar hasta la boya junto al arrecife de coral.",
        spriteName: "Submarino",
        goalName: "Boya",
        spriteAlt: "Submarino pequeño",
        goalAlt: "Boya del arrecife",
        reachedFeedback: "El submarino llegó a la boya.",
        stoppedShortFeedback: "El submarino se detuvo antes de la boya.",
      },
    },
  },
  {
    schema: WORLD_SCHEMA_VERSION,
    id: "robots.workshop",
    version: 1,
    defaultLocale: "en",
    supportedLocales: ["en", "es"],
    concepts,
    visualStyle: { palette: "robots" },
    missionBindings: binding,
    copy: {
      en: {
        title: "Robots",
        narrative: "A helper robot has to roll across the workshop to its charging station.",
        spriteName: "Robot",
        goalName: "Charger",
        spriteAlt: "Helper robot",
        goalAlt: "Charging station",
        reachedFeedback: "The robot reached its charger.",
        stoppedShortFeedback: "The robot stopped before the charger.",
      },
      es: {
        title: "Robots",
        narrative: "Un robot ayudante tiene que rodar por el taller hasta su estación de carga.",
        spriteName: "Robot",
        goalName: "Cargador",
        spriteAlt: "Robot ayudante",
        goalAlt: "Estación de carga",
        reachedFeedback: "El robot llegó a su cargador.",
        stoppedShortFeedback: "El robot se detuvo antes del cargador.",
      },
    },
  },
  {
    schema: WORLD_SCHEMA_VERSION,
    id: "city.crossing",
    version: 1,
    defaultLocale: "en",
    supportedLocales: ["en", "es"],
    concepts,
    visualStyle: { palette: "city" },
    missionBindings: binding,
    copy: {
      en: {
        title: "City",
        narrative: "A delivery scooter must ride down the street to the drop-off point.",
        spriteName: "Scooter",
        goalName: "Drop-off",
        spriteAlt: "Delivery scooter",
        goalAlt: "Drop-off point",
        reachedFeedback: "The scooter reached the drop-off point.",
        stoppedShortFeedback: "The scooter stopped before the drop-off point.",
      },
      es: {
        title: "Ciudad",
        narrative: "Un monopatín de reparto debe recorrer la calle hasta el punto de entrega.",
        spriteName: "Monopatín",
        goalName: "Entrega",
        spriteAlt: "Monopatín de reparto",
        goalAlt: "Punto de entrega",
        reachedFeedback: "El monopatín llegó al punto de entrega.",
        stoppedShortFeedback: "El monopatín se detuvo antes del punto de entrega.",
      },
    },
  },
]);

export const DEFAULT_WORLD_ID: WorldId = "space.trailhead";

export function getWorld(id: string | undefined): WorldDefinition {
  return WORLDS.find((world) => world.id === id) ?? WORLDS[0]!;
}

export function worldCopy(world: WorldDefinition, locale: string | undefined): WorldCopy {
  return world.copy[normalizeLocale(locale)];
}

export function worldsForMission(missionId: string, version: number): readonly WorldDefinition[] {
  return WORLDS.filter((world) =>
    world.missionBindings.some((b) => b.missionId === missionId && b.version === version),
  );
}
