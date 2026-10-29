export interface OriReviewableProposal {
  readonly schemaVersion: "ori/proposal/v0";
  readonly operation: "append";
  readonly requiresLearnerApproval: true;
  readonly blocks: readonly [
    | { readonly kind: "move"; readonly steps: number }
    | { readonly kind: "turn"; readonly direction: "left" | "right" },
  ];
}
export function parseOriReviewableProposal(raw: unknown): OriReviewableProposal | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  if (
    Object.keys(p).sort().join() !== "blocks,operation,requiresLearnerApproval,schemaVersion" ||
    p["schemaVersion"] !== "ori/proposal/v0" ||
    p["operation"] !== "append" ||
    p["requiresLearnerApproval"] !== true ||
    !Array.isArray(p["blocks"]) ||
    p["blocks"].length !== 1
  )
    return null;
  const b = p["blocks"][0];
  if (!b || typeof b !== "object" || Array.isArray(b)) return null;
  const block = b as Record<string, unknown>;
  if (block["kind"] === "move") {
    if (
      Object.keys(block).sort().join() !== "kind,steps" ||
      !Number.isSafeInteger(block["steps"]) ||
      (block["steps"] as number) < 1 ||
      (block["steps"] as number) > 5
    )
      return null;
  } else if (block["kind"] === "turn") {
    if (
      Object.keys(block).sort().join() !== "direction,kind" ||
      !["left", "right"].includes(String(block["direction"]))
    )
      return null;
  } else return null;
  return raw as OriReviewableProposal;
}
export function describeOriProposal(proposal: OriReviewableProposal): string {
  const block = proposal.blocks[0];
  return block.kind === "move"
    ? `Agregar movimiento de ${block.steps} paso(s)`
    : `Agregar giro hacia ${block.direction === "left" ? "la izquierda" : "la derecha"}`;
}
