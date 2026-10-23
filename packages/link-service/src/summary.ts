import { LinkError } from "./types.js";

/**
 * The only thing a linked device may upload. It mirrors the aggregates the Kids adults panel
 * already shows. No timestamps per event, no free text, no images, no project contents.
 */
export interface LinkSummary {
  readonly version: 1;
  readonly completedMissions: number;
  readonly practicedConcepts: readonly [number, number, number];
  readonly decisions: {
    readonly used: number;
    readonly changed: number;
    readonly rejected: number;
  };
  readonly minutesByDay: readonly { readonly day: string; readonly minutes: number }[];
  readonly ageBand: "6-8" | "9-12" | "13+";
  readonly dailyLimitMinutes: number;
}

export const SUMMARY_MAX_BYTES = 4096;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function fail(): never {
  throw new LinkError("INVALID_SUMMARY", "Invalid summary");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): void {
  const actual = Object.keys(value);
  if (actual.length !== keys.length || !keys.every((key) => actual.includes(key))) fail();
}

function int(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) fail();
  return value;
}

function validDay(value: unknown): string {
  if (typeof value !== "string" || !DAY.test(value)) fail();
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail();
  return value;
}

/** Strict: unknown keys, wrong types, out-of-range numbers and oversize payloads are rejected. */
export function parseLinkSummary(input: unknown): LinkSummary {
  if (!isObject(input)) fail();
  exactKeys(input, [
    "version",
    "completedMissions",
    "practicedConcepts",
    "decisions",
    "minutesByDay",
    "ageBand",
    "dailyLimitMinutes",
  ]);
  if (input["version"] !== 1) fail();
  const concepts = input["practicedConcepts"];
  if (!Array.isArray(concepts) || concepts.length !== 3) fail();
  const decisions = input["decisions"];
  if (!isObject(decisions)) fail();
  exactKeys(decisions, ["used", "changed", "rejected"]);
  const minutes = input["minutesByDay"];
  if (!Array.isArray(minutes) || minutes.length > 14) fail();
  const seen = new Set<string>();
  const minutesByDay = minutes.map((entry) => {
    if (!isObject(entry)) fail();
    exactKeys(entry, ["day", "minutes"]);
    const day = validDay(entry["day"]);
    if (seen.has(day)) fail();
    seen.add(day);
    return { day, minutes: int(entry["minutes"], 0, 1440) };
  });
  const ageBand = input["ageBand"];
  if (ageBand !== "6-8" && ageBand !== "9-12" && ageBand !== "13+") fail();
  const summary: LinkSummary = {
    version: 1,
    completedMissions: int(input["completedMissions"], 0, 12),
    practicedConcepts: [int(concepts[0], 0, 4), int(concepts[1], 0, 4), int(concepts[2], 0, 4)],
    decisions: {
      used: int(decisions["used"], 0, 100_000),
      changed: int(decisions["changed"], 0, 100_000),
      rejected: int(decisions["rejected"], 0, 100_000),
    },
    minutesByDay,
    ageBand,
    dailyLimitMinutes: int(input["dailyLimitMinutes"], 10, 120),
  };
  if (JSON.stringify(summary).length > SUMMARY_MAX_BYTES) fail();
  return summary;
}
