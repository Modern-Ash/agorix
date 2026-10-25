import { useEffect, useRef, useState } from "react";
import type { Locale } from "../../../i18n.js";
import {
  LockstepGuest,
  LockstepHost,
  type GuestStatus,
  type HostStatus,
} from "@agorix/group-lockstep";
import { groupText, type GroupCopyKey } from "../groupCopy.js";
import type { GuestTeamLink, HostTeamLink } from "./teamLink.js";
import {
  TEAM_GAME_COLORS,
  TEAM_GAME_GOAL,
  TEAM_GAME_PROGRAM_HASH,
  TEAM_GAME_SEED,
  TEAM_GAME_STAGE_HEIGHT,
  TEAM_GAME_STAGE_WIDTH,
  TEAM_GAME_DIRECTIONS,
  activeTeamGameSlots,
  actorOnGoal,
  createTeamGameSim,
  initialTeamGameView,
  isTeamGameDirection,
  teamGameView,
  type TeamGameDirection,
  type TeamGameView,
} from "./teamGame.js";

export interface TeamPlayPlayer {
  readonly slotId: string;
  readonly alias: string;
}

interface HostPlayProps {
  readonly locale: Locale;
  readonly link: HostTeamLink;
  /** Approved children, in the order the host will number their inputs. */
  readonly players: readonly TeamPlayPlayer[];
}

interface GuestPlayProps {
  readonly locale: Locale;
  readonly link: GuestTeamLink;
}

const DIRECTION_KEY: Record<TeamGameDirection, GroupCopyKey> = {
  up: "teamPlayUp",
  down: "teamPlayDown",
  left: "teamPlayLeft",
  right: "teamPlayRight",
};

const KEY_DIRECTION: Readonly<Record<string, TeamGameDirection>> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

/** The organizer's screen: it starts, pauses, resumes and stops the shared match. */
export function HostTeamPlay({ locale, link, players }: HostPlayProps) {
  const [view, setView] = useState<TeamGameView>(initialTeamGameView);
  const [sim] = useState(() =>
    createTeamGameSim((_frame, result) => setView(teamGameView(result))),
  );
  const [lockstep] = useState(
    () =>
      new LockstepHost({
        players: players.map((player) => player.slotId),
        sim,
        seed: TEAM_GAME_SEED,
        programHash: TEAM_GAME_PROGRAM_HASH,
        validateInput: (value) => value === null || isTeamGameDirection(value),
        frameIntervalMs: 100,
        frameTimeoutMs: 350,
        missedToAbsent: 5,
        digestEvery: 20,
      }),
  );
  const [match, setMatch] = useState<{
    readonly status: HostStatus;
    readonly joined: number;
    readonly inactive: readonly string[];
  }>(() => ({ status: lockstep.status, joined: 0, inactive: [] }));
  const t = (key: GroupCopyKey, values?: Record<string, string | number>) =>
    groupText(locale, key, values);

  useEffect(() => {
    link.attachLockstep(lockstep);
    const sync = () => {
      const next = {
        status: lockstep.status,
        joined: lockstep.joinedPlayers().length,
        inactive: lockstep.inactivePlayers(),
      };
      setMatch((current) =>
        current.status === next.status &&
        current.joined === next.joined &&
        current.inactive.length === next.inactive.length &&
        current.inactive.every((slotId, index) => slotId === next.inactive[index])
          ? current
          : next,
      );
    };
    const id = window.setInterval(() => {
      link.pollLockstep();
      sync();
    }, 16);
    sync();
    return () => window.clearInterval(id);
  }, [link, lockstep]);

  const allConnected =
    match.joined === players.length && match.inactive.length === 0 && players.length >= 2;
  const started = match.status !== "waiting";
  const activeSlots = started
    ? activeTeamGameSlots(
        players.length,
        players.flatMap((player, slot) => (match.inactive.includes(player.slotId) ? [slot] : [])),
      )
    : players.map((_player, slot) => slot);
  const inactiveAliases = players
    .filter((player) => match.inactive.includes(player.slotId))
    .map((player) => player.alias);
  const onGoal = activeSlots.filter((slot) => {
    const actor = view.actors[slot];
    return actor !== undefined && actorOnGoal(actor);
  }).length;
  const won = activeSlots.length > 0 && onGoal === activeSlots.length;

  return (
    <section className="kids-link-card kids-team-play" aria-labelledby="kids-team-play-title">
      <h4 id="kids-team-play-title">{t("teamPlayTitle")}</h4>
      <p>{t("teamPlayIntro")}</p>
      {!started ? (
        <>
          <p role="status">
            {allConnected
              ? t("teamPlayReadyHost")
              : t("teamPlayWaiting", { connected: match.joined, total: players.length })}
          </p>
          <button type="button" disabled={!allConnected} onClick={() => link.startLockstep()}>
            {t("teamPlayStart")}
          </button>
        </>
      ) : (
        <>
          <p role="status">
            {match.status === "paused"
              ? t("teamPlayPausedHost", { who: inactiveAliases.join(", ") })
              : match.status === "stopped"
                ? t("teamPlayStopped")
                : t("teamPlayRunning")}
          </p>
          <PlayStage
            locale={locale}
            view={view}
            activeSlots={activeSlots}
            labels={players.map((player) => player.alias)}
          />
          <p>{t("teamPlayOnGoal", { n: onGoal, total: activeSlots.length })}</p>
          {won ? <p className="kids-team-play-win">{t("teamPlayWin")}</p> : null}
          <div className="kids-link-actions">
            {match.status === "paused" ? (
              <button type="button" onClick={() => link.resumeLockstep()}>
                {t("teamPlayResume")}
              </button>
            ) : null}
            {match.status === "running" || match.status === "paused" ? (
              <button type="button" onClick={() => link.stopLockstep("end")}>
                {t("teamPlayStop")}
              </button>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

/** The child's screen: it shows the shared stage and sends only this child's held direction. */
export function GuestTeamPlay({ locale, link }: GuestPlayProps) {
  const direction = useRef<TeamGameDirection | null>(null);
  const releaseTimer = useRef<number | undefined>(undefined);
  const [view, setView] = useState<TeamGameView>(initialTeamGameView);
  const [sim] = useState(() =>
    createTeamGameSim((_frame, result) => setView(teamGameView(result))),
  );
  const [lockstep] = useState(
    () =>
      new LockstepGuest({
        sim,
        seed: TEAM_GAME_SEED,
        programHash: TEAM_GAME_PROGRAM_HASH,
        input: () => direction.current,
        digestEvery: 20,
      }),
  );
  const [match, setMatch] = useState<{
    readonly status: GuestStatus;
    readonly slot: number | undefined;
    readonly players: number | undefined;
    readonly absent: readonly number[];
  }>(() => ({
    status: lockstep.status,
    slot: undefined,
    players: undefined,
    absent: [],
  }));
  const t = (key: GroupCopyKey, values?: Record<string, string | number>) =>
    groupText(locale, key, values);

  useEffect(() => {
    link.attachLockstep(lockstep);
    const sync = () => {
      const next = {
        status: lockstep.status,
        slot: lockstep.slot,
        players: lockstep.players,
        absent: lockstep.absent,
      };
      setMatch((current) =>
        current.status === next.status &&
        current.slot === next.slot &&
        current.players === next.players &&
        current.absent.length === next.absent.length &&
        current.absent.every((slot, index) => slot === next.absent[index])
          ? current
          : next,
      );
    };
    const id = window.setInterval(sync, 100);
    sync();
    return () => window.clearInterval(id);
  }, [link, lockstep]);

  useEffect(() => {
    if (match.status !== "running") {
      direction.current = null;
      return;
    }
    const down = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      const next = KEY_DIRECTION[event.key];
      if (next === undefined) return;
      event.preventDefault();
      direction.current = next;
    };
    const up = (event: KeyboardEvent) => {
      const released = KEY_DIRECTION[event.key];
      if (released !== undefined && direction.current === released) release();
    };
    const blur = () => {
      direction.current = null;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [match.status]);

  useEffect(() => () => window.clearTimeout(releaseTimer.current), []);

  function hold(next: TeamGameDirection) {
    window.clearTimeout(releaseTimer.current);
    direction.current = next;
  }

  function release() {
    window.clearTimeout(releaseTimer.current);
    releaseTimer.current = window.setTimeout(() => {
      direction.current = null;
    }, 140);
  }

  const players = match.players;
  const activeSlots =
    players === undefined ? [0, 1, 2, 3] : activeTeamGameSlots(players, match.absent);
  const onGoal = activeSlots.filter((slot) => {
    const actor = view.actors[slot];
    return actor !== undefined && actorOnGoal(actor);
  }).length;
  const won = activeSlots.length > 0 && players !== undefined && onGoal === activeSlots.length;
  const running = match.status === "running";

  return (
    <section className="kids-link-card kids-team-play" aria-labelledby="kids-team-play-guest">
      <h4 id="kids-team-play-guest">{t("teamPlayTitle")}</h4>
      <p>{t("teamPlayIntro")}</p>
      <p role="status">{guestStatusText(match.status, match.slot, t)}</p>
      <PlayStage
        locale={locale}
        view={view}
        activeSlots={activeSlots}
        youSlot={match.slot}
        labels={activeSlots.map((slot) => t("teamPlayPlayer", { n: slot + 1 }))}
      />
      <p>{t("teamPlayOnGoal", { n: onGoal, total: activeSlots.length })}</p>
      {won ? <p className="kids-team-play-win">{t("teamPlayWin")}</p> : null}
      <fieldset className="kids-team-play-controls" disabled={!running}>
        <legend>{t("teamPlayControls")}</legend>
        <div className="kids-team-play-pad">
          {TEAM_GAME_DIRECTIONS.map((next) => (
            <button
              key={next}
              type="button"
              className={`kids-team-play-${next}`}
              aria-label={t(DIRECTION_KEY[next])}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture?.(event.pointerId);
                hold(next);
              }}
              onPointerUp={release}
              onPointerCancel={release}
              onLostPointerCapture={release}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") hold(next);
              }}
              onKeyUp={(event) => {
                if (event.key === "Enter" || event.key === " ") release();
              }}
            >
              {t(DIRECTION_KEY[next])}
            </button>
          ))}
        </div>
      </fieldset>
    </section>
  );
}

function guestStatusText(
  status: GuestStatus,
  slot: number | undefined,
  t: (key: GroupCopyKey, values?: Record<string, string | number>) => string,
): string {
  switch (status) {
    case "connecting":
      return t("teamPlayConnecting");
    case "ready":
      return t("teamPlayReady");
    case "running":
      return t("teamPlayYou", { n: (slot ?? 0) + 1 });
    case "paused":
      return t("teamPlayPausedGuest");
    case "host-lost":
      return t("teamPlayLost");
    case "refused":
      return t("teamPlayRefused");
    case "stopped":
      return t("teamPlayStopped");
  }
}

interface StageProps {
  readonly locale: Locale;
  readonly view: TeamGameView;
  readonly activeSlots: readonly number[];
  readonly youSlot?: number | undefined;
  readonly labels: readonly string[];
}

function stagePercent(value: number): number {
  return Math.min(97, Math.max(3, value));
}

function PlayStage({ locale, view, activeSlots, youSlot, labels }: StageProps) {
  const goalLeft = (TEAM_GAME_GOAL.x / TEAM_GAME_STAGE_WIDTH) * 100;
  const goalTop = ((TEAM_GAME_STAGE_HEIGHT / 2 - TEAM_GAME_GOAL.y) / TEAM_GAME_STAGE_HEIGHT) * 100;
  return (
    <div
      className="kids-team-play-stage"
      role="img"
      aria-label={groupText(locale, "teamPlayStage")}
    >
      <span
        className="kids-team-play-goal"
        style={{ left: `${goalLeft}%`, top: `${goalTop}%` }}
        aria-hidden="true"
      >
        ★
      </span>
      {activeSlots.map((slot) => {
        const actor = view.actors[slot];
        if (actor === undefined || !actor.visible) return null;
        return (
          <span
            key={actor.id}
            className={`kids-team-play-token${slot === youSlot ? " is-you" : ""}`}
            style={{
              left: `${stagePercent((actor.x / TEAM_GAME_STAGE_WIDTH) * 100)}%`,
              top: `${stagePercent(
                ((TEAM_GAME_STAGE_HEIGHT / 2 - actor.y) / TEAM_GAME_STAGE_HEIGHT) * 100,
              )}%`,
              backgroundColor: TEAM_GAME_COLORS[slot] ?? TEAM_GAME_COLORS[0],
            }}
            title={labels[slot] ?? actor.name}
            aria-label={labels[slot] ?? actor.name}
          >
            {slot + 1}
          </span>
        );
      })}
    </div>
  );
}
