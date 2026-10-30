export interface OriKidsActivity {
  readonly sequence: number;
  readonly kind: "run";
  readonly evidenceKey: string;
}

export type OriKidsHintRequest = (expectedLevel: number) => Promise<{
  readonly level: number;
  readonly text: string;
} | null>;
