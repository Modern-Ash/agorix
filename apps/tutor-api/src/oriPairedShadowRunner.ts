import { createHash } from "node:crypto";
import { buildOriParityReport } from "./oriParityReport.js";
import type { OriGoldenCase } from "./oriGoldenParity.js";

export interface OriShadowObservation {
  readonly kind: string;
  readonly hintLevel: number;
}
export interface OriShadowScenario {
  readonly caseId: string;
  /** Minimal, synthetic, already-authorized shared input; no child PII. */
  readonly context: Readonly<Record<string, string | number | boolean>>;
}
export type OriShadowRunner = (
  context: OriShadowScenario["context"],
) => Promise<OriShadowObservation | null>;

function canonicalContext(context: OriShadowScenario["context"]): string {
  return JSON.stringify(
    Object.keys(context)
      .sort()
      .map((key) => [key, context[key]]),
  );
}

/**
 * Executes two independent runners against the same frozen synthetic context.
 * Failures and missing observations are recorded, never substituted by success.
 * This is an offline comparison, not a child-facing request path.
 */
export async function runOriPairedShadow({
  scenarios,
  legacy,
  ori,
}: {
  readonly scenarios: readonly OriShadowScenario[];
  readonly legacy: OriShadowRunner;
  readonly ori: OriShadowRunner;
}) {
  const cases: OriGoldenCase[] = [];
  for (const scenario of scenarios) {
    if (!scenario.caseId || scenario.caseId.length > 80) throw new TypeError("Invalid scenario ID");
    const serialized = canonicalContext(scenario.context);
    const context = Object.freeze({ ...scenario.context });
    const digest = createHash("sha256").update(serialized).digest("hex");
    // Legacy is the comparison baseline: a missing baseline is not evidence.
    const baseline = await legacy(context);
    if (!baseline) throw new Error("Missing legacy baseline for " + scenario.caseId);
    let candidate: OriShadowObservation | null = null;
    try {
      candidate = await ori(context);
    } catch {
      candidate = null;
    }
    cases.push({
      caseId: scenario.caseId,
      contextDigest: digest,
      legacy: baseline,
      ori: candidate,
    });
  }
  return buildOriParityReport(cases);
}
