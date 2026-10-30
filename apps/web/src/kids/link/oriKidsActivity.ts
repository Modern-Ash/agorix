export interface OriKidsActivity {
  readonly sequence: number;
  readonly kind: "run";
  readonly evidenceKey: string;
  readonly outcome: "success" | "wall" | "passed" | "short";
}

export function oriProposalOfferContext(activity: OriKidsActivity): string | null {
  return activity.outcome === "success" ? null : activity.evidenceKey;
}

export type OriKidsHintRequest = (expectedLevel: number) => Promise<{
  readonly level: number;
  readonly text: string;
} | null>;
