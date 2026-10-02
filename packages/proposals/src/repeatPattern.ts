import type { ProjectProgram, Statement } from "@agorix/program-model";

export const MIN_REPEAT_PATTERN_COUNT = 3;
export const MAX_REPEAT_PATTERN_PERIOD = 4;

export interface RepeatPattern {
  readonly scriptIndex: number;
  /** Index of the first statement of the first repetition. */
  readonly startIndex: number;
  /** Number of statements in one repetition. */
  readonly period: number;
  readonly count: number;
  readonly body: readonly Statement[];
}

/**
 * Finds the first top-level run of one block of statements written out three
 * or more times in a row. Pure and deterministic: no model call, no mutation.
 * Among runs starting at the same statement, the one covering the most
 * statements wins.
 */
export function detectRepeatPattern(program: ProjectProgram): RepeatPattern | undefined {
  for (const [scriptIndex, script] of program.scripts.entries()) {
    const keys = script.statements.map((statement) => JSON.stringify(statement));
    for (let start = 0; start < keys.length; start += 1) {
      let best: RepeatPattern | undefined;
      for (let period = 1; period <= MAX_REPEAT_PATTERN_PERIOD; period += 1) {
        let count = 1;
        while (blockEquals(keys, start, start + count * period, period)) {
          count += 1;
        }
        if (
          count >= MIN_REPEAT_PATTERN_COUNT &&
          (best === undefined || count * period > best.count * best.period)
        ) {
          best = {
            scriptIndex,
            startIndex: start,
            period,
            count,
            body: script.statements.slice(start, start + period),
          };
        }
      }
      if (best !== undefined) {
        return best;
      }
    }
  }
  return undefined;
}

function blockEquals(keys: readonly string[], a: number, b: number, length: number): boolean {
  if (b + length > keys.length) {
    return false;
  }
  for (let offset = 0; offset < length; offset += 1) {
    if (keys[a + offset] !== keys[b + offset]) {
      return false;
    }
  }
  return true;
}
