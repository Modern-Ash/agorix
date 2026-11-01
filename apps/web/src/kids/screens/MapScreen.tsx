import type { CSSProperties } from "react";
import type { Locale } from "../../i18n.js";
import { KIDS_MISSION_IDS, getKidsMission } from "@agorix/curriculum";
import {
  conceptStates,
  mapProgress,
  missionState,
  worldProgress,
  type KidsProgress,
} from "../kidsProgress.js";
import { KIDS_WORLDS, type KidsAvatar, type KidsWorld } from "../kidsState.js";
import { speak } from "../speak.js";
import type { KidsText } from "../useKidsText.js";
import { kidsTable } from "../useKidsText.js";
import { KIDS_WORLD_STYLES } from "../worlds.js";
import { useKidsCatalog } from "../kidsCatalog.js";
import { useKidsFlag } from "../kidsFlags.js";
import { KidsBackdrop, KidsSprite, backdropImage, builtinWorld, emojiSlot } from "./KidsArt.js";

interface Props {
  readonly t: KidsText;
  readonly locale: Locale;
  readonly avatar: KidsAvatar;
  readonly world: KidsWorld;
  readonly progress: KidsProgress;
  readonly readAloud?: boolean;
  readonly onWorld: (world: KidsWorld) => void;
  readonly onMission: (index: 0 | 1 | 2) => void;
  /** Goes to Crear, where the child makes a scene without a mission. */
  readonly onCreate?: () => void;
  readonly advancedUnlocked?: boolean;
  readonly onAdvanced?: () => void;
  readonly advancedReactUnlocked?: boolean;
  readonly onAdvancedReact?: () => void;
  readonly advancedScoreUnlocked?: boolean;
  readonly onAdvancedScore?: () => void;
  readonly advancedControlUnlocked?: boolean;
  readonly onAdvancedControl?: () => void;
  readonly advancedMessageUnlocked?: boolean;
  readonly onAdvancedMessage?: () => void;
}

const CONCEPTS = [
  { icon: "➜", color: "#3F7EE8", name: "conceptSeq" },
  { icon: "↺", color: "#2F9D78", name: "conceptTurn" },
  { icon: "⟳", color: "#8B63D9", name: "conceptLoop" },
] as const;

/** What each mission asks and which idea it teaches, in plain words (the titles alone say little). */
const MISSION_BLURB = [
  {
    concept: 0,
    es: "Ordená los pasos para llegar a la meta.",
    en: "Put the steps in order to reach the goal.",
  },
  {
    concept: 1,
    es: "Girá para cambiar de dirección y llegar a la meta.",
    en: "Turn to change direction and reach the goal.",
  },
  {
    concept: 2,
    es: "Repetí un paso en vez de escribirlo muchas veces.",
    en: "Repeat one step instead of writing it many times.",
  },
] as const;

const STATE_COLOR = { learned: "#2E8F4E", practicing: "#B87503", soon: "#5E6B65" } as const;
const STATE_LABEL = { learned: "learned", practicing: "practicing", soon: "soon" } as const;
const ALIGN = ["flex-start", "center", "flex-end"] as const;

/** World tabs, three missions in a zigzag (current one pulsing, locks), concept chips and stars. */
export function MapScreen({
  t,
  locale,
  avatar,
  world,
  progress,
  readAloud = true,
  onWorld,
  onMission,
  onCreate,
  advancedUnlocked = false,
  onAdvanced,
  advancedReactUnlocked = false,
  onAdvancedReact,
  advancedScoreUnlocked = false,
  onAdvancedScore,
  advancedControlUnlocked = false,
  onAdvancedControl,
  advancedMessageUnlocked = false,
  onAdvancedMessage,
}: Props) {
  const catalog = useKidsCatalog();
  const style = KIDS_WORLD_STYLES[world];
  const image = backdropImage(builtinWorld(world), useKidsFlag("customImages"));
  const names = kidsTable(locale, "worlds");
  const concepts = conceptStates(progress);
  const overall = mapProgress(progress);
  const vars = {
    "--world-bg": style.bg,
    "--world-ink": style.ink,
    "--world-tint": style.tint,
    "--world-goal": style.goal,
  } as CSSProperties;

  const nextIndex = ([0, 1, 2] as const).find(
    (index) => missionState(progress, world, index) === "current",
  );
  const nextMission = nextIndex === undefined ? null : nextIndex;
  return (
    <section className="kids-map" aria-labelledby="kids-title" data-world={world} style={vars}>
      <header className="kids-map-top">
        <KidsSprite slot={emojiSlot(avatar)} className="kids-avatar-badge" />
        <div className="kids-map-heading">
          <h1 id="kids-title">{t("map")}</h1>
          <p className="kids-map-summary">
            {locale === "es"
              ? `${overall.done} de ${overall.total} misiones`
              : `${overall.done} of ${overall.total} missions`}
          </p>
        </div>
        <div className="kids-stars" aria-label={`★ ${progress.stars}`}>
          <span aria-hidden="true">★</span>
          {progress.stars}
        </div>
        {readAloud ? (
          <button
            type="button"
            className="kids-round"
            aria-label={t("listen")}
            onClick={() => speak(names[world] ?? "", locale)}
          >
            <span aria-hidden="true">🔊</span>
          </button>
        ) : null}
      </header>
      <div className="kids-map-orientation">
        <p className="kids-map-orientation-kicker">
          {locale === "es" ? "Dos maneras de empezar" : "Two ways to start"}
        </p>
        <h2>
          {locale === "es"
            ? "Creá a tu manera o aprendé con misiones"
            : "Create your way or learn with missions"}
        </h2>
        <p>
          {locale === "es"
            ? "Si ya conocés los bloques, entrá a Crear y armá una escena libre. El mapa es un recorrido opcional para practicar ideas paso a paso; no hace falta completarlo para crear."
            : "If you already know blocks, open Create and build a free scene. The map is an optional path to practice ideas step by step; you do not need to finish it to create."}
        </p>
      </div>
      {/* What to do now: the next mission in this world, or a way on when the world is complete. */}
      <div className="kids-map-next" data-testid="map-next">
        {onCreate ? (
          <button
            type="button"
            className="kids-button kids-primary kids-map-next-create"
            onClick={onCreate}
          >
            <span aria-hidden="true">✨</span>
            <span>
              {locale === "es" ? "Crear sin misiones" : "Create without missions"}
              <small>
                {locale === "es"
                  ? "Entrá al editor, elegí personajes y programá tu escena"
                  : "Open the editor, choose sprites and code your scene"}
              </small>
            </span>
          </button>
        ) : null}
        {nextMission !== null ? (
          <button
            type="button"
            className="kids-button kids-map-next-main"
            onClick={() => onMission(nextMission)}
          >
            <span aria-hidden="true">▶</span>
            <span>
              {locale === "es"
                ? "Aprender con una misión: Seguir con"
                : "Learn with a mission: Continue with"}{" "}
              <strong>
                {getKidsMission(KIDS_MISSION_IDS[nextMission]!, locale, world, catalog).title}
              </strong>
              <small>{MISSION_BLURB[nextMission]![locale]}</small>
            </span>
          </button>
        ) : (
          <p className="kids-map-next-main kids-map-next-done">
            {locale === "es"
              ? "¡Mundo completo! Elegí otro mundo de arriba o creá algo propio."
              : "World complete! Pick another world above or create something of your own."}
          </p>
        )}
      </div>

      {/* These concepts describe the optional mission path below the main creation choice. */}
      <ul className="kids-concepts">
        {CONCEPTS.map((concept, index) => {
          const state = concepts[index]!;
          return (
            <li
              key={concept.name}
              className="kids-concept"
              aria-label={`${t(concept.name)}: ${t(STATE_LABEL[state])}`}
              style={{ borderColor: STATE_COLOR[state] }}
            >
              <span aria-hidden="true" style={{ color: concept.color }}>
                {concept.icon}
              </span>
              <span aria-hidden="true">{t(concept.name)}</span>
            </li>
          );
        })}
      </ul>

      <div className="kids-world-tabs" role="group" aria-label={t("map")}>
        {KIDS_WORLDS.map((id) => {
          const tab = KIDS_WORLD_STYLES[id];
          return (
            <button
              key={id}
              type="button"
              className="kids-world-tab"
              aria-pressed={world === id}
              aria-describedby={`kids-world-progress-${id}`}
              onClick={() => onWorld(id)}
              style={{ ["--tab-bg" as string]: tab.bg, ["--tab-ink" as string]: tab.ink }}
            >
              <KidsBackdrop
                world={builtinWorld(id)}
                fallbackBackground="transparent"
                className="kids-world-glyph"
              >
                {tab.character}
              </KidsBackdrop>
              <span className="kids-world-name">{names[id]}</span>
              <span className="kids-world-count" aria-hidden="true">
                {worldProgress(progress, id).done}/3
              </span>
            </button>
          );
        })}
      </div>

      <div
        className="kids-path"
        style={image ? { backgroundImage: `url("${image}")`, backgroundSize: "cover" } : undefined}
      >
        <h2 className="kids-world-title">{names[world]}</h2>
        {KIDS_WORLDS.map((id) => {
          const { done, total } = worldProgress(progress, id);
          const text =
            locale === "es"
              ? `${done} de ${total} misiones${done === total ? ": ¡mundo completo!" : ""}`
              : `${done} of ${total} missions${done === total ? ": world complete!" : ""}`;
          // Read for every tab, shown for the world that is open.
          return (
            <p
              key={id}
              id={`kids-world-progress-${id}`}
              className={id === world ? "kids-world-progress" : "kids-visually-hidden"}
              data-complete={done === total ? "true" : undefined}
            >
              {text}
            </p>
          );
        })}
        {([0, 1, 2] as const).map((index) => {
          const state = missionState(progress, world, index);
          const locked = state === "locked";
          const current = state === "current";
          return (
            <div key={index} className="kids-node-row" style={{ alignItems: ALIGN[index % 3] }}>
              {index > 0 ? (
                <div className="kids-connector" aria-hidden="true" data-pos={index % 3} />
              ) : null}
              <div className="kids-node-wrap">
                <button
                  type="button"
                  className={`kids-node ${state}`}
                  disabled={locked}
                  aria-label={`${t("mission")} ${index + 1}${state === "current" ? `, ${t("play")}` : ""}`}
                  onClick={() => onMission(index)}
                >
                  <span className="kids-node-disc">
                    <span aria-hidden="true">
                      {locked ? (
                        "🔒"
                      ) : index === 2 ? (
                        style.goalGlyph
                      ) : (
                        <KidsSprite slot={emojiSlot(avatar)} />
                      )}
                    </span>
                    {progress.done[`${world}:${index}`] === true ? (
                      <span className="kids-node-star" aria-hidden="true">
                        ★
                      </span>
                    ) : null}
                  </span>
                  {current ? (
                    <span className="kids-node-play">▶ {t("play")}</span>
                  ) : (
                    <span className="kids-node-label">
                      {t("mission")} {index + 1}
                    </span>
                  )}
                </button>
                {/* Outside the button: its visible text must match the button's name (axe). */}
                <span className="kids-node-title">
                  {getKidsMission(KIDS_MISSION_IDS[index]!, locale, world, catalog).title}
                </span>
                <span className="kids-node-goal">{MISSION_BLURB[index]![locale]}</span>
                <span
                  className="kids-node-concept"
                  style={{ borderColor: CONCEPTS[MISSION_BLURB[index]!.concept].color }}
                >
                  {locale === "es" ? "Aprendés" : "You learn"}:{" "}
                  {t(CONCEPTS[MISSION_BLURB[index]!.concept].name)}
                </span>
                {locked ? (
                  <span className="kids-node-hint">
                    {locale === "es"
                      ? `Terminá la misión ${index} para abrirla`
                      : `Finish mission ${index} to open it`}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      {advancedUnlocked ? (
        <div className="kids-advanced-entry">
          <button type="button" className="kids-button kids-primary" onClick={onAdvanced}>
            {locale === "es"
              ? "✨ Nivel avanzado: creá una escena"
              : "✨ Advanced level: create a scene"}
          </button>
          {advancedReactUnlocked ? (
            <button type="button" className="kids-button kids-primary" onClick={onAdvancedReact}>
              {locale === "es" ? "✨ Etapa 2: hacé que reaccione" : "✨ Stage 2: make it react"}
            </button>
          ) : null}
          {advancedScoreUnlocked ? (
            <button type="button" className="kids-button kids-primary" onClick={onAdvancedScore}>
              {locale === "es" ? "✨ Etapa 3: llevá la cuenta" : "✨ Stage 3: keep score"}
            </button>
          ) : null}
          {advancedControlUnlocked ? (
            <button type="button" className="kids-button kids-primary" onClick={onAdvancedControl}>
              {locale === "es" ? "✨ Etapa 4: elegí qué pasa" : "✨ Stage 4: choose what happens"}
            </button>
          ) : null}
          {advancedMessageUnlocked ? (
            <button type="button" className="kids-button kids-primary" onClick={onAdvancedMessage}>
              {locale === "es" ? "✨ Etapa 5: enviá un mensaje" : "✨ Stage 5: send a message"}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
