import {
  SCHEMA_VERSION,
  type ProjectCreativeState,
  type ProjectProgram,
  type Script,
} from "@agorix/program-model";
import type { MultiActorRunResult, RuntimeEvent } from "@agorix/runtime";
import { RuntimeSim, type RuntimeFrame } from "@agorix/group-lockstep";

/**
 * The built-in same-room game. Every device builds the same four-player program and only the
 * ordered inputs travel over the lockstep link, so the stage never needs to be synchronized.
 */
export const TEAM_GAME_SEED = 568;
export const TEAM_GAME_PROGRAM_HASH = "agorix-team-garden-v1";
export const TEAM_GAME_MAX_PLAYERS = 4;
export const TEAM_GAME_STAGE_WIDTH = 320;
export const TEAM_GAME_STAGE_HEIGHT = 220;
export const TEAM_GAME_GOAL = Object.freeze({ x: 160, y: 100 });
export const TEAM_GAME_GOAL_RADIUS = 16;

export type TeamGameDirection = "up" | "down" | "left" | "right";

export const TEAM_GAME_DIRECTIONS: readonly TeamGameDirection[] = ["up", "down", "left", "right"];

export const TEAM_GAME_COLORS: readonly string[] = ["#2563eb", "#ea580c", "#15803d", "#7c3aed"];

const HEADING: Record<TeamGameDirection, number> = {
  up: 90,
  right: 0,
  down: -90,
  left: 180,
};

const START: readonly { readonly x: number; readonly y: number }[] = [
  { x: 44, y: -68 },
  { x: 276, y: -68 },
  { x: 44, y: 52 },
  { x: 276, y: 52 },
];

const ACTOR_PREFIX = "actor:p";
const STEP = 9;

export interface TeamGameActor {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly visible: boolean;
}

export interface TeamGameView {
  readonly actors: readonly TeamGameActor[];
}

export function teamGameActorId(slot: number): string {
  return `${ACTOR_PREFIX}${slot}`;
}

export function isTeamGameDirection(value: unknown): value is TeamGameDirection {
  return TEAM_GAME_DIRECTIONS.includes(value as TeamGameDirection);
}

export function teamGameInput(value: unknown): TeamGameDirection | null {
  return isTeamGameDirection(value) ? value : null;
}

export function teamGameEventForInput(
  input: unknown,
  _frame: number,
  slot: number,
): RuntimeEvent | undefined {
  const direction = teamGameInput(input);
  if (direction === null) return undefined;
  return { type: "keyPressed", key: `${slot}:${direction}` };
}

export function createTeamGameProgram(): ProjectProgram {
  const scripts: Script[] = [];
  const actorScriptIds: string[][] = [];
  for (let slot = 0; slot < TEAM_GAME_MAX_PLAYERS; slot += 1) {
    const ids: string[] = [];
    for (const direction of TEAM_GAME_DIRECTIONS) {
      const id = `p${slot}-${direction}`;
      ids.push(id);
      scripts.push({
        id,
        trigger: { type: "onKeyPressed", key: `${slot}:${direction}` },
        statements: [
          { type: "pointInDirection", degrees: HEADING[direction] },
          { type: "move", steps: STEP },
          { type: "bounceOnEdge" },
        ],
      });
    }
    actorScriptIds.push(ids);
  }
  return { schema: SCHEMA_VERSION, scripts };
}

export function createTeamGameCreative(): ProjectCreativeState {
  return {
    actors: START.map((start, slot) => ({
      id: teamGameActorId(slot),
      name: `Player ${slot + 1}`,
      x: start.x,
      y: start.y,
      direction: 90,
      size: 100,
      visible: true,
      scripts: TEAM_GAME_DIRECTIONS.map((direction) => `p${slot}-${direction}`),
    })),
    stage: {
      width: TEAM_GAME_STAGE_WIDTH,
      height: TEAM_GAME_STAGE_HEIGHT,
      actorOrder: START.map((_start, slot) => teamGameActorId(slot)),
    },
  };
}

export function createTeamGameSim(
  onFrame?: (frame: RuntimeFrame, result: MultiActorRunResult) => void,
): RuntimeSim {
  return new RuntimeSim({
    program: createTeamGameProgram(),
    creative: createTeamGameCreative(),
    randomSeed: TEAM_GAME_SEED,
    eventForInput: teamGameEventForInput,
    ...(onFrame === undefined ? {} : { onFrame }),
  });
}

export function initialTeamGameView(): TeamGameView {
  return {
    actors: START.map((start, slot) => ({
      id: teamGameActorId(slot),
      name: `Player ${slot + 1}`,
      x: start.x,
      y: start.y,
      visible: true,
    })),
  };
}

export function teamGameView(result: Pick<MultiActorRunResult, "actors">): TeamGameView {
  return {
    actors: result.actors.map((actor) => ({
      id: actor.id,
      name: actor.name,
      x: actor.world.sprite.x,
      y: actor.world.sprite.y,
      visible: actor.world.sprite.visible ?? true,
    })),
  };
}

export function actorDistanceToGoal(actor: TeamGameActor): number {
  return Math.hypot(actor.x - TEAM_GAME_GOAL.x, actor.y - TEAM_GAME_GOAL.y);
}

export function actorOnGoal(actor: TeamGameActor): boolean {
  return actorDistanceToGoal(actor) <= TEAM_GAME_GOAL_RADIUS;
}

export function activeTeamGameSlots(players: number, absent: readonly number[]): number[] {
  const missing = new Set(absent);
  return Array.from({ length: players }, (_unused, slot) => slot).filter(
    (slot) => !missing.has(slot),
  );
}
