/**
 * POC validation limits (issue #13). Explicit named constants, not implicit
 * engine/stack limits, per the issue-13 intent's constraint.
 */

export const MOVE_STEPS_MIN = -1000;
export const MOVE_STEPS_MAX = 1000;

export const TURN_DEGREES_MIN = -1000;
export const TURN_DEGREES_MAX = 1000;

export const REPEAT_COUNT_MIN = 1;
export const REPEAT_COUNT_MAX = 1000;

export const NUMERIC_LITERAL_MIN = -1_000_000;
export const NUMERIC_LITERAL_MAX = 1_000_000;

/** Total statement + expression nodes allowed across the whole program. */
export const MAX_PROGRAM_NODES = 500;

/** Max nesting depth of repeat/if bodies (a script's top level counts as depth 1). */
export const MAX_NESTING_DEPTH = 20;
