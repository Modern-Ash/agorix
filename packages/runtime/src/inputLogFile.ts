import { CLOCK_PARTS } from "@agorix/program-model";
import {
  LIVE_MAX_INPUTS,
  LIVE_MAX_SECONDS,
  LIVE_TICK_SECONDS,
  type LiveInput,
  type LiveInputLog,
} from "./liveRuntime.js";
import type { RuntimeEvent } from "./multiActor.js";

/** The file kind that carries one run's inputs, so a run can be shared and replayed exactly. */
export const RUN_INPUTS_FILE_KIND = "agorix/run-inputs/v1";
/** Largest file read, in characters; a bigger one is refused before it is parsed. */
export const RUN_INPUTS_MAX_CHARS = 2_000_000;

const MAX_TICKS = Math.ceil(LIVE_MAX_SECONDS / LIVE_TICK_SECONDS);
const KEY_MAX = 32;
const ID_MAX = 200;
const WORD_MAX = 100;

/** Why a run-inputs file was refused; the message names the field, never its content. */
export class RunInputsFileError extends Error {
  constructor(reason: string) {
    super(`run inputs file refused: ${reason}`);
    this.name = "RunInputsFileError";
  }
}

export interface EncodeRunInputsOptions {
  /**
   * Typed answers are the learner's own words. They are left out unless the caller asks for them,
   * so a shared file carries no text the child typed; a replay then waits at that question.
   */
  readonly includeAnswers?: boolean;
  /** Ties the file to one program (for example its semantic hash); checked when it is read. */
  readonly programHash?: string;
}

export interface ParsedRunInputs {
  readonly log: LiveInputLog;
  readonly programHash?: string;
  readonly answersIncluded: boolean;
}

/** One file for a run's inputs. The same program and this file replay the run exactly. */
export function encodeRunInputs(log: LiveInputLog, options: EncodeRunInputsOptions = {}): string {
  const inputs = log.inputs.filter((input) => options.includeAnswers || input.kind !== "answers");
  return JSON.stringify({
    kind: RUN_INPUTS_FILE_KIND,
    ...(options.programHash === undefined ? {} : { programHash: options.programHash }),
    answersIncluded: options.includeAnswers === true,
    log: { ...log, inputs },
  });
}

function fail(reason: string): never {
  throw new RunInputsFileError(reason);
}

function record(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    fail(`${where} must be an object`);
  return value as Record<string, unknown>;
}

function only(object: Record<string, unknown>, allowed: readonly string[], where: string): void {
  for (const key of Object.keys(object))
    if (!allowed.includes(key)) fail(`${where}.${key} is not allowed`);
}

function whole(value: unknown, min: number, max: number, where: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max)
    fail(`${where} must be a whole number from ${min} to ${max}`);
  return value;
}

function finite(value: unknown, where: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(`${where} must be a number`);
  return value;
}

function text(value: unknown, max: number, where: string): string {
  if (typeof value !== "string" || value.length > max)
    fail(`${where} must be text of at most ${max}`);
  return value;
}

function eventOf(value: unknown, where: string): RuntimeEvent {
  const event = record(value, where);
  switch (event["type"]) {
    case "start":
      only(event, ["type"], where);
      return { type: "start" };
    case "keyPressed":
      only(event, ["type", "key"], where);
      return { type: "keyPressed", key: text(event["key"], KEY_MAX, `${where}.key`) };
    case "actorClicked":
      only(event, ["type", "actorId"], where);
      return { type: "actorClicked", actorId: text(event["actorId"], ID_MAX, `${where}.actorId`) };
    case "message": {
      only(event, ["type", "message", "senderActorId"], where);
      const message = text(event["message"], WORD_MAX, `${where}.message`);
      return event["senderActorId"] === undefined
        ? { type: "message", message }
        : {
            type: "message",
            message,
            senderActorId: text(event["senderActorId"], ID_MAX, `${where}.senderActorId`),
          };
    }
    case "backdropSwitched":
      only(event, ["type", "backdropId"], where);
      return {
        type: "backdropSwitched",
        backdropId: text(event["backdropId"], ID_MAX, `${where}.backdropId`),
      };
    case "timerPassed":
      only(event, ["type", "seconds"], where);
      return { type: "timerPassed", seconds: finite(event["seconds"], `${where}.seconds`) };
    case "loudnessPassed":
      only(event, ["type", "level"], where);
      return { type: "loudnessPassed", level: finite(event["level"], `${where}.level`) };
    case "cloneStarted":
      only(event, ["type", "actorId"], where);
      return { type: "cloneStarted", actorId: text(event["actorId"], ID_MAX, `${where}.actorId`) };
    default:
      return fail(`${where}.type is not a known event`);
  }
}

function numberMap(
  value: unknown,
  where: string,
  read: (item: unknown, at: string) => number | string,
): Record<string, number | string> {
  const source = record(value, where);
  const keys = Object.keys(source);
  if (keys.length > 64) fail(`${where} has too many entries`);
  const out: Record<string, number | string> = {};
  for (const key of keys) out[key] = read(source[key], `${where}.${key}`);
  return out;
}

function inputOf(value: unknown, ticks: number, where: string): LiveInput {
  const input = record(value, where);
  const tick = whole(input["tick"], 0, ticks, `${where}.tick`);
  switch (input["kind"]) {
    case "event":
      only(input, ["tick", "kind", "event"], where);
      return { tick, kind: "event", event: eventOf(input["event"], `${where}.event`) };
    case "keys": {
      only(input, ["tick", "kind", "keys"], where);
      const keys = input["keys"];
      if (!Array.isArray(keys) || keys.length > 16) fail(`${where}.keys must be a short list`);
      return {
        tick,
        kind: "keys",
        keys: keys.map((key, i) => text(key, KEY_MAX, `${where}.keys.${i}`)),
      };
    }
    case "pointer":
      only(input, ["tick", "kind", "x", "y", "down"], where);
      if (typeof input["down"] !== "boolean") fail(`${where}.down must be true or false`);
      return {
        tick,
        kind: "pointer",
        x: finite(input["x"], `${where}.x`),
        y: finite(input["y"], `${where}.y`),
        down: input["down"],
      };
    case "choices":
      only(input, ["tick", "kind", "choices"], where);
      return {
        tick,
        kind: "choices",
        choices: numberMap(input["choices"], `${where}.choices`, (item, at) =>
          finite(item, at),
        ) as Record<string, number>,
      };
    case "loudness":
      only(input, ["tick", "kind", "level"], where);
      return { tick, kind: "loudness", level: finite(input["level"], `${where}.level`) };
    case "clock": {
      only(input, ["tick", "kind", "clock"], where);
      const clock = record(input["clock"], `${where}.clock`);
      const sample: Partial<Record<(typeof CLOCK_PARTS)[number], number>> = {};
      for (const key of Object.keys(clock)) {
        if (!(CLOCK_PARTS as readonly string[]).includes(key))
          fail(`${where}.clock.${key} is not a clock part`);
        sample[key as (typeof CLOCK_PARTS)[number]] = whole(
          clock[key],
          0,
          9999,
          `${where}.clock.${key}`,
        );
      }
      return { tick, kind: "clock", clock: sample };
    }
    case "answers":
      only(input, ["tick", "kind", "answers"], where);
      return {
        tick,
        kind: "answers",
        answers: numberMap(input["answers"], `${where}.answers`, (item, at) =>
          text(item, WORD_MAX, at),
        ) as Record<string, string>,
      };
    default:
      return fail(`${where}.kind is not a known input`);
  }
}

/**
 * Reads a run-inputs file. Anything unexpected is refused with a reason that names the field: a
 * wrong kind, a size past a cap, an extra field, an input past the last tick or out of order.
 */
export function parseRunInputs(source: string): ParsedRunInputs {
  if (typeof source !== "string" || source.length > RUN_INPUTS_MAX_CHARS)
    fail("the file is too large");
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch {
    return fail("the file is not valid JSON");
  }
  const file = record(raw, "file");
  only(file, ["kind", "programHash", "answersIncluded", "log"], "file");
  if (file["kind"] !== RUN_INPUTS_FILE_KIND) fail("this is not a run-inputs file");
  if (typeof file["answersIncluded"] !== "boolean")
    fail("file.answersIncluded must be true or false");
  const log = record(file["log"], "log");
  only(log, ["version", "ticks", "randomSeed", "inputs"], "log");
  if (log["version"] !== 1) fail("log.version must be 1");
  const ticks = whole(log["ticks"], 0, MAX_TICKS, "log.ticks");
  const list = log["inputs"];
  if (!Array.isArray(list) || list.length > LIVE_MAX_INPUTS)
    fail("log.inputs has too many entries");
  const inputs = list.map((item, i) => inputOf(item, ticks, `log.inputs.${i}`));
  for (let i = 1; i < inputs.length; i += 1)
    if (inputs[i]!.tick < inputs[i - 1]!.tick) fail(`log.inputs.${i}.tick is out of order`);
  const randomSeed =
    log["randomSeed"] === undefined
      ? undefined
      : whole(log["randomSeed"], 0, 0xffffffff, "log.randomSeed");
  const programHash =
    file["programHash"] === undefined
      ? undefined
      : text(file["programHash"], 200, "file.programHash");
  return {
    log: { version: 1, ticks, ...(randomSeed === undefined ? {} : { randomSeed }), inputs },
    ...(programHash === undefined ? {} : { programHash }),
    answersIncluded: file["answersIncluded"],
  };
}
