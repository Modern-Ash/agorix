import { createWorldState, type WorldState } from "./world.js";
import type { CopyRule } from "@agorix/program-model";

/** Most live copies in one run, across every character. */
export const COPIES_CAP = 20;
const FALL_SPEED = 120;
const FOLLOW_SPEED = 120;
const FOLLOW_GAP = 30;
const SPREAD_GAP = 40;
const STAGE_WIDTH = 320;
const STAGE_TOP = -100;
const STAGE_BOTTOM = 120;

export interface CopyState {
  readonly x: number;
  readonly y: number;
  readonly rule: CopyRule;
  /** Place in the group it was made with: how far apart a follower keeps. */
  readonly slot: number;
}

const round = (value: number) => Math.round(value * 10) / 10;

/** New copies, placed by their rule. Past the cap nothing more is added. */
export function createCopiesWorld(
  world: WorldState,
  count: number,
  rule: CopyRule,
  room: number = COPIES_CAP,
): WorldState {
  const existing = world.copies ?? [];
  const add = Math.max(0, Math.min(count, room));
  const created: CopyState[] = Array.from({ length: add }, (_unused, slot) => {
    if (rule === "spread")
      return {
        x: round(world.sprite.x + (slot - (count - 1) / 2) * SPREAD_GAP),
        y: world.sprite.y,
        rule,
        slot,
      };
    if (rule === "fall")
      return { x: round((STAGE_WIDTH * (slot + 1)) / (count + 1)), y: STAGE_TOP, rule, slot };
    return { x: world.sprite.x, y: world.sprite.y, rule, slot };
  });
  return created.length === 0
    ? world
    : createWorldState({ ...world, copies: [...existing, ...created] });
}

/** One tick of time: falling copies fall, following copies close in on their character. */
export function advanceCopiesWorld(world: WorldState, seconds: number): WorldState {
  const copies = world.copies;
  if (copies === undefined || copies.length === 0) return world;
  const moved = copies.map((copy) => {
    if (copy.rule === "fall")
      return { ...copy, y: round(Math.min(STAGE_BOTTOM, copy.y + FALL_SPEED * seconds)) };
    if (copy.rule === "follow") {
      const dx = world.sprite.x - copy.x;
      const dy = world.sprite.y - copy.y;
      const distance = Math.hypot(dx, dy);
      const gap = FOLLOW_GAP * (copy.slot + 1);
      if (distance <= gap) return copy;
      const step = Math.min(FOLLOW_SPEED * seconds, distance - gap);
      return {
        ...copy,
        x: round(copy.x + (dx / distance) * step),
        y: round(copy.y + (dy / distance) * step),
      };
    }
    return copy;
  });
  return createWorldState({ ...world, copies: moved });
}

/** Where the copies end up when a run is shown finished: landed, or trailing behind. */
export function settleCopiesWorld(world: WorldState): WorldState {
  const copies = world.copies;
  if (copies === undefined || copies.length === 0) return world;
  const heading = (world.sprite.heading * Math.PI) / 180;
  const settled = copies.map((copy) => {
    if (copy.rule === "fall") return { ...copy, y: STAGE_BOTTOM };
    if (copy.rule === "follow") {
      const gap = FOLLOW_GAP * (copy.slot + 1);
      return {
        ...copy,
        x: round(world.sprite.x - Math.cos(heading) * gap),
        y: round(world.sprite.y - Math.sin(heading) * gap),
      };
    }
    return copy;
  });
  return createWorldState({ ...world, copies: settled });
}

/** Whether any copy is still on its way: a fall not landed, a follower not yet at its gap. */
export function copiesMoving(world: WorldState): boolean {
  return (world.copies ?? []).some((copy) => {
    if (copy.rule === "fall") return copy.y < STAGE_BOTTOM;
    if (copy.rule === "follow")
      return (
        Math.hypot(world.sprite.x - copy.x, world.sprite.y - copy.y) >
        FOLLOW_GAP * (copy.slot + 1) + 0.5
      );
    return false;
  });
}

/** How many copies are live across these worlds. */
export function liveCopies(worlds: readonly WorldState[]): number {
  return worlds.reduce((sum, world) => sum + (world.copies?.length ?? 0), 0);
}
