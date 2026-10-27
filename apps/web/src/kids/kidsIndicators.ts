import { localDay } from "./kidsAdults.js";

/**
 * Learning indicators for adults (issue #632). Only whole-number counters per local day, kept on
 * this device for a fortnight: no program, no text, no project, no character, no time of day. Never
 * sent anywhere. Definitions live in docs/product/LEARNING_INDICATORS.md.
 */
export const KIDS_INDICATORS_KEY = "agorix.kids.indicators.v1";
export const INDICATORS_RETENTION_DAYS = 14;
const COUNTER_CAP = 9_999;

export const INDICATOR_COUNTERS = [
  "runs",
  "completedRuns",
  "independentRuns",
  "hints",
  "solutionsShown",
  "predictions",
  "predictionsMatched",
  "oriFallbacks",
  "chatFallbacks",
] as const;
export type IndicatorCounter = (typeof INDICATOR_COUNTERS)[number];
export type IndicatorDay = Readonly<Record<IndicatorCounter, number>>;
export interface Indicators {
  readonly days: Readonly<Record<string, IndicatorDay>>;
}

type Store = Pick<Storage, "getItem" | "setItem">;

function browserStore(): Store | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function emptyDay(): Record<IndicatorCounter, number> {
  return Object.fromEntries(INDICATOR_COUNTERS.map((name) => [name, 0])) as Record<
    IndicatorCounter,
    number
  >;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Field by field: anything unknown, negative, fractional or oversized is dropped, not trusted. */
export function readIndicators(raw: unknown): Indicators {
  const days: Record<string, IndicatorDay> = {};
  const source =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as { days?: unknown }).days
      : undefined;
  if (source && typeof source === "object" && !Array.isArray(source)) {
    for (const [day, value] of Object.entries(source).slice(0, 60)) {
      if (!DAY.test(day) || !value || typeof value !== "object") continue;
      const counters = emptyDay();
      for (const name of INDICATOR_COUNTERS) {
        const count = (value as Record<string, unknown>)[name];
        if (Number.isInteger(count) && (count as number) >= 0) {
          counters[name] = Math.min(COUNTER_CAP, count as number);
        }
      }
      days[day] = counters;
    }
  }
  return { days };
}

export function loadIndicators(store: Store | undefined = browserStore()): Indicators {
  try {
    return readIndicators(JSON.parse(store?.getItem(KIDS_INDICATORS_KEY) ?? "null"));
  } catch {
    return { days: {} };
  }
}

function shiftDay(day: string, offset: number): string {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  return localDay(new Date(year, month - 1, date + offset));
}

/** Add to a counter and drop days older than the retention window. A failure never reaches the child. */
export function bumpIndicator(
  name: IndicatorCounter,
  amount = 1,
  store: Store | undefined = browserStore(),
  day: string = localDay(),
): void {
  try {
    const current = loadIndicators(store);
    const oldest = shiftDay(day, -(INDICATORS_RETENTION_DAYS - 1));
    const days: Record<string, IndicatorDay> = {};
    for (const [key, value] of Object.entries(current.days)) {
      if (key >= oldest) days[key] = value;
    }
    const today = { ...(days[day] ?? emptyDay()) };
    today[name] = Math.min(COUNTER_CAP, today[name] + amount);
    days[day] = today;
    store?.setItem(KIDS_INDICATORS_KEY, JSON.stringify({ days }));
  } catch {
    // Without storage the app works exactly the same.
  }
}

export interface IndicatorSummary {
  readonly days: number;
  readonly totals: IndicatorDay;
  /** Whole percent, or null when there is nothing to divide. */
  readonly independentPercent: number | null;
  readonly completedPercent: number | null;
  readonly predictionPercent: number | null;
  readonly hintsPerRun: number | null;
}

const percent = (part: number, whole: number) =>
  whole === 0 ? null : Math.round((part / whole) * 100);

/** The last `windowDays` days up to `today`, added up. */
export function summarizeIndicators(
  indicators: Indicators,
  windowDays = 7,
  today: string = localDay(),
): IndicatorSummary {
  const from = shiftDay(today, -(windowDays - 1));
  const totals = emptyDay();
  let days = 0;
  for (const [day, value] of Object.entries(indicators.days)) {
    if (day < from || day > today) continue;
    days += 1;
    for (const name of INDICATOR_COUNTERS) totals[name] += value[name];
  }
  return {
    days,
    totals,
    independentPercent: percent(totals.independentRuns, totals.runs),
    completedPercent: percent(totals.completedRuns, totals.runs),
    predictionPercent: percent(totals.predictionsMatched, totals.predictions),
    hintsPerRun: totals.runs === 0 ? null : Math.round((totals.hints / totals.runs) * 10) / 10,
  };
}

export function clearIndicators(store: Store | undefined = browserStore()): void {
  try {
    store?.setItem(KIDS_INDICATORS_KEY, JSON.stringify({ days: {} }));
  } catch {
    // Nothing to clear without storage.
  }
}
