import {
  SCHEMA_VERSION,
  type ProjectCreativeState,
  type ProjectProgram,
} from "@agorix/program-model";
import type { MultiActorRunResult } from "@agorix/runtime";
import { normalizeLocale } from "./index.js";

export const KIDS_ADVANCED_STAGES = ["scene", "react", "score"] as const;
export type KidsAdvancedStage = (typeof KIDS_ADVANCED_STAGES)[number];

export interface KidsAdvancedMission {
  readonly id: string;
  readonly version: 1;
  readonly stage: KidsAdvancedStage;
  readonly title: string;
  readonly instruction: string;
  readonly reflection: string;
  readonly starterProgram: ProjectProgram;
  readonly starterCreative: ProjectCreativeState;
}

const COPY = {
  es: {
    scene: {
      title: "Creá una escena",
      instruction: "Hacé que Ori cambie de disfraz y toque un sonido. Mirá cuál personaje cambió.",
      reflection: "¿Qué personaje cambió y qué bloque hizo sonar la escena?",
    },
    react: {
      title: "Hacé que reaccione",
      instruction: "Tocá a Ori para iniciar un programa que lo haga cambiar en el mundo.",
      reflection: "¿Qué acción inició el programa y qué cambió después?",
    },
    score: {
      title: "Llevá la cuenta",
      instruction: "Cambiá el puntaje y mirá el número que muestra el mundo.",
      reflection: "¿Qué número esperabas y cuál mostró el puntaje?",
    },
  },
  en: {
    scene: {
      title: "Create a scene",
      instruction: "Make Ori change costume and play a sound. Watch which character changed.",
      reflection: "Which character changed, and which block made the sound?",
    },
    react: {
      title: "Make it react",
      instruction: "Tap Ori to start a program that changes it in the world.",
      reflection: "What action started the program, and what changed afterward?",
    },
    score: {
      title: "Keep score",
      instruction: "Change the score and watch the number shown in the world.",
      reflection: "What number did you expect, and what did the score show?",
    },
  },
} as const;

function starterProgram(stage: KidsAdvancedStage, locale: "es" | "en"): ProjectProgram {
  return {
    schema: SCHEMA_VERSION,
    ...(stage === "score"
      ? {
          variables: [
            {
              id: "score",
              name: locale === "es" ? "Puntaje" : "Score",
              initialValue: 0,
              visible: true,
            },
          ],
        }
      : {}),
    scripts: [
      {
        id: `advanced-${stage}`,
        trigger: stage === "react" ? { type: "onActorClicked" } : { type: "greenFlag" },
        statements: [],
      },
    ],
  };
}

function starterCreative(stage: KidsAdvancedStage, locale: "es" | "en"): ProjectCreativeState {
  return {
    actors: [
      {
        id: "actor:ori",
        name: "Ori",
        x: 0,
        y: 0,
        direction: 0,
        size: 100,
        visible: true,
        costumeId: "asset:costume.default",
        scripts: [`advanced-${stage}`],
      },
      {
        id: "actor:friend",
        name: locale === "es" ? "Amiga" : "Friend",
        x: 80,
        y: 0,
        direction: 0,
        size: 100,
        visible: true,
        costumeId: "asset:costume.default",
        scripts: [],
      },
    ],
    stage: { actorOrder: ["actor:ori", "actor:friend"] },
    assets: [
      {
        id: "asset:costume.default",
        kind: "costume",
        name: "Ori",
        source: "builtin:costume.default",
      },
      {
        id: "asset:costume.spark",
        kind: "costume",
        name: locale === "es" ? "Destello" : "Spark",
        source: "builtin:costume.spark",
      },
      {
        id: "asset:sound.beacon",
        kind: "sound",
        name: locale === "es" ? "Pulso" : "Ping",
        source: "builtin:sound.beacon",
      },
    ],
  };
}

export function getKidsAdvancedMission(
  stage: KidsAdvancedStage,
  locale: string | undefined,
): KidsAdvancedMission {
  if (!KIDS_ADVANCED_STAGES.includes(stage))
    throw new RangeError(`unknown advanced stage: ${stage}`);
  const language = normalizeLocale(locale);
  return {
    id: `kids.advanced.${stage}`,
    version: 1,
    stage,
    ...COPY[language][stage],
    starterProgram: starterProgram(stage, language),
    starterCreative: starterCreative(stage, language),
  };
}

/** Only observed runtime changes count; no model text or authored block alone can complete a stage. */
export function evaluateKidsAdvancedMission(
  stage: KidsAdvancedStage,
  run: MultiActorRunResult,
): boolean {
  if (run.outcome !== "completed") return false;
  switch (stage) {
    case "scene": {
      const changed = new Set(
        run.trace
          .filter(
            (entry) =>
              entry.statementType === "switchCostume" &&
              entry.worldBefore.sprite.costumeId !== entry.worldAfter.sprite.costumeId,
          )
          .map((entry) => entry.actorId),
      );
      return run.trace.some(
        (entry) =>
          changed.has(entry.actorId) &&
          entry.statementType === "playSound" &&
          (entry.worldAfter.sounds?.activeSoundIds.length ?? 0) >
            (entry.worldBefore.sounds?.activeSoundIds.length ?? 0),
      );
    }
    case "react":
      return run.trace.some(
        (entry) =>
          entry.event.type === "actorClicked" &&
          entry.event.actorId === entry.actorId &&
          (entry.worldBefore.sprite.x !== entry.worldAfter.sprite.x ||
            entry.worldBefore.sprite.y !== entry.worldAfter.sprite.y ||
            entry.worldBefore.sprite.heading !== entry.worldAfter.sprite.heading ||
            entry.worldBefore.sprite.costumeId !== entry.worldAfter.sprite.costumeId ||
            entry.worldBefore.sprite.visible !== entry.worldAfter.sprite.visible),
      );
    case "score":
      return run.trace.some((entry) => {
        const before = entry.worldBefore.variables?.score;
        const after = entry.worldAfter.variables?.score;
        return (
          (entry.statementType === "setVariable" || entry.statementType === "changeVariable") &&
          after?.visible === true &&
          before?.value !== after.value
        );
      });
  }
}
