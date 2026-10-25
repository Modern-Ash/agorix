import type { ProjectCreativeState, ProjectProgram } from "@agorix/program-model";
import {
  RuntimeSession,
  type MultiActorRunResult,
  type RuntimeEvent,
  type RuntimeSessionSnapshot,
} from "@agorix/runtime";
import type { Sim } from "./lockstep.js";

/**
 * Adapter from the deterministic runtime to the lockstep `Sim` contract. Inputs arrive in roster
 * order; the caller decides which runtime event each one represents. Clocks and randomness stay
 * inside the session, so every device that applies the same frames reaches the same digest.
 */

export interface RuntimeSimOptions {
  readonly program: ProjectProgram;
  readonly creative?: ProjectCreativeState;
  readonly randomSeed?: number;
  readonly maxStepsPerFrame?: number;
  /** Map one child's input to a runtime event, or return undefined for "no action". */
  readonly eventForInput: (input: unknown, frame: number, slot: number) => RuntimeEvent | undefined;
  readonly onFrame?: (frame: RuntimeFrame, result: MultiActorRunResult) => void;
}

export interface RuntimeFrame {
  readonly n: number;
  readonly inputs: readonly (unknown | null)[];
}

export class RuntimeSim implements Sim {
  private readonly session: RuntimeSession;
  private readonly eventForInput: RuntimeSimOptions["eventForInput"];
  private readonly onFrame: RuntimeSimOptions["onFrame"];

  constructor(options: RuntimeSimOptions) {
    this.session = new RuntimeSession({
      program: options.program,
      // Keep the field present only when set; `undefined` is meaningful for the runtime defaults.
      ...(options.creative === undefined ? {} : { creative: options.creative }),
      ...(options.randomSeed === undefined ? {} : { randomSeed: options.randomSeed }),
      ...(options.maxStepsPerFrame === undefined
        ? {}
        : { maxStepsPerStep: options.maxStepsPerFrame }),
    });
    this.eventForInput = options.eventForInput;
    this.onFrame = options.onFrame;
  }

  apply(frame: RuntimeFrame): void {
    const events: RuntimeEvent[] = [];
    frame.inputs.forEach((input, slot) => {
      if (input === null) return;
      const event = this.eventForInput(input, frame.n, slot);
      if (event !== undefined) events.push(event);
    });
    const result = this.session.step(events);
    this.onFrame?.(frame, result);
  }

  digest(): number {
    return this.session.digest();
  }

  snapshot(): RuntimeSessionSnapshot {
    return this.session.snapshot();
  }

  restore(snapshot: unknown): void {
    this.session.restore(snapshot);
  }
}
