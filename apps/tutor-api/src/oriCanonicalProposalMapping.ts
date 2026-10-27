import type { MoveStatement, Statement, TurnStatement } from "@agorix/program-model";

/**
 * Strictly translate a validated Ori v0 single-block proposal into the
 * canonical Agorix AST. This function is pure: it never mutates a project.
 * Authorization, learner approval and compare-and-swap persistence are
 * separate trusted-host responsibilities.
 */
export function mapOriProposalToCanonicalStatement(
  proposal: unknown,
  allowedBlocks: readonly string[],
): Statement | null {
  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal)) return null;
  const value = proposal as Record<string, unknown>;
  if (
    Object.keys(value).sort().join() !== "blocks,operation,requiresLearnerApproval,schemaVersion" ||
    value["schemaVersion"] !== "ori/proposal/v0" ||
    value["operation"] !== "append" ||
    value["requiresLearnerApproval"] !== true ||
    !Array.isArray(value["blocks"]) ||
    value["blocks"].length !== 1
  )
    return null;
  const raw: unknown = value["blocks"][0];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const block = raw as Record<string, unknown>;
  if (block["kind"] === "move") {
    if (
      Object.keys(block).sort().join() !== "kind,steps" ||
      !allowedBlocks.includes("move") ||
      !Number.isSafeInteger(block["steps"]) ||
      (block["steps"] as number) < 1 ||
      (block["steps"] as number) > 5
    )
      return null;
    return Object.freeze({ type: "move", steps: block["steps"] as number } satisfies MoveStatement);
  }
  if (block["kind"] === "turn") {
    if (
      Object.keys(block).sort().join() !== "direction,kind" ||
      !allowedBlocks.includes("turn") ||
      (block["direction"] !== "left" && block["direction"] !== "right")
    )
      return null;
    // Ori's relative left/right uses a quarter turn; Agorix stores signed degrees.
    const degrees = block["direction"] === "left" ? -90 : 90;
    return Object.freeze({ type: "turn", degrees } satisfies TurnStatement);
  }
  return null;
}
