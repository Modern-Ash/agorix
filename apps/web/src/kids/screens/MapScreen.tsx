import type { CSSProperties } from "react";
import type { Locale } from "../../i18n.js";
import { conceptStates, missionState, type KidsProgress } from "../kidsProgress.js";
import { KIDS_WORLDS, type KidsAvatar, type KidsWorld } from "../kidsState.js";
import { speak } from "../speak.js";
import type { KidsText } from "../useKidsText.js";
import { kidsTable } from "../useKidsText.js";
import { KIDS_WORLD_STYLES } from "../worlds.js";

interface Props {
  readonly t: KidsText;
  readonly locale: Locale;
  readonly avatar: KidsAvatar;
  readonly world: KidsWorld;
  readonly progress: KidsProgress;
  readonly readAloud?: boolean;
  readonly onWorld: (world: KidsWorld) => void;
  readonly onMission: (index: 0 | 1 | 2) => void;
}

const CONCEPTS = [
  { icon: "➜", color: "#3F7EE8", name: "conceptSeq" },
  { icon: "↺", color: "#2F9D78", name: "conceptTurn" },
  { icon: "⟳", color: "#8B63D9", name: "conceptLoop" },
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
}: Props) {
  const style = KIDS_WORLD_STYLES[world];
  const names = kidsTable(locale, "worlds");
  const concepts = conceptStates(progress);
  const vars = {
    "--world-bg": style.bg,
    "--world-ink": style.ink,
    "--world-tint": style.tint,
    "--world-goal": style.goal,
  } as CSSProperties;

  return (
    <section className="kids-map" aria-labelledby="kids-title" data-world={world} style={vars}>
      <h1 id="kids-title" className="kids-visually-hidden">
        {t("map")}
      </h1>
      <header className="kids-map-top">
        <div className="kids-avatar-badge" aria-hidden="true">
          {avatar}
        </div>
        <div className="kids-stars" aria-label={`★ ${progress.stars}`}>
          <span aria-hidden="true">★</span>
          {progress.stars}
        </div>
        <div className="kids-spacer" />
        <ul className="kids-concepts">
          {CONCEPTS.map((concept, index) => {
            const state = concepts[index]!;
            return (
              <li
                key={concept.name}
                className="kids-concept"
                aria-label={`${t(concept.name)}: ${t(STATE_LABEL[state])}`}
                style={{ borderColor: STATE_COLOR[state], color: concept.color }}
              >
                <span aria-hidden="true">{concept.icon}</span>
              </li>
            );
          })}
        </ul>
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

      <div className="kids-world-tabs" role="group" aria-label={t("map")}>
        {KIDS_WORLDS.map((id) => {
          const tab = KIDS_WORLD_STYLES[id];
          return (
            <button
              key={id}
              type="button"
              className="kids-world-tab"
              aria-pressed={world === id}
              onClick={() => onWorld(id)}
              style={{ ["--tab-bg" as string]: tab.bg, ["--tab-ink" as string]: tab.ink }}
            >
              <span className="kids-world-glyph" aria-hidden="true">
                {tab.character}
              </span>
              <span className="kids-world-name">{names[id]}</span>
            </button>
          );
        })}
      </div>

      <div className="kids-path">
        <h2 className="kids-world-title">{names[world]}</h2>
        {([0, 1, 2] as const).map((index) => {
          const state = missionState(progress, world, index);
          const locked = state === "locked";
          const current = state === "current";
          return (
            <div key={index} className="kids-node-row" style={{ alignItems: ALIGN[index % 3] }}>
              {index > 0 ? (
                <div className="kids-connector" aria-hidden="true" data-pos={index % 3} />
              ) : null}
              <button
                type="button"
                className={`kids-node ${state}`}
                disabled={locked}
                aria-label={`${t("mission")} ${index + 1}`}
                onClick={() => onMission(index)}
              >
                <span className="kids-node-disc">
                  <span aria-hidden="true">
                    {locked ? "🔒" : index === 2 ? style.goalGlyph : avatar}
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
            </div>
          );
        })}
      </div>
    </section>
  );
}
