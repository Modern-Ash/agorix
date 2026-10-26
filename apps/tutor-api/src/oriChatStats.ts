/**
 * Aggregated Ori chat counters for adults and admins. Only class counts per hour are kept, in
 * memory: no text, no prompts, no identifiers, and nothing is written to disk.
 */
export type OriChatClass = "answered" | "refused" | "fallback" | "rate-limited" | "invalid";

export interface OriChatStatsWindow {
  readonly hourStart: string;
  readonly counts: Readonly<Record<OriChatClass, number>>;
}

const CLASSES: readonly OriChatClass[] = [
  "answered",
  "refused",
  "fallback",
  "rate-limited",
  "invalid",
];
const HOUR_MS = 3_600_000;
const WINDOW_HOURS = 24;

export function createOriChatStats(now: () => number = Date.now) {
  const buckets = new Map<number, Record<OriChatClass, number>>();
  function prune(hour: number) {
    for (const key of buckets.keys()) if (key <= hour - WINDOW_HOURS) buckets.delete(key);
  }
  return {
    record(kind: OriChatClass): void {
      const hour = Math.floor(now() / HOUR_MS);
      prune(hour);
      const bucket =
        buckets.get(hour) ??
        (Object.fromEntries(CLASSES.map((name) => [name, 0])) as Record<OriChatClass, number>);
      bucket[kind] += 1;
      buckets.set(hour, bucket);
    },
    snapshot(): { windows: OriChatStatsWindow[]; totals: Record<OriChatClass, number> } {
      const hour = Math.floor(now() / HOUR_MS);
      prune(hour);
      const totals = Object.fromEntries(CLASSES.map((name) => [name, 0])) as Record<
        OriChatClass,
        number
      >;
      const windows = [...buckets.entries()]
        .sort(([a], [b]) => a - b)
        .map(([key, counts]) => {
          for (const name of CLASSES) totals[name] += counts[name];
          return { hourStart: new Date(key * HOUR_MS).toISOString(), counts: { ...counts } };
        });
      return { windows, totals };
    },
  };
}
