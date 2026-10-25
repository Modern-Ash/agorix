import type { FetchLike } from "../../accounts/httpClient.js";

/** The parts of the admin registry's group section that the organizer's device acts on. */
export interface GroupSettings {
  readonly revision: number | null;
  readonly image: {
    readonly enabled: boolean;
    readonly unsafe: number;
    readonly uncertain: number;
  };
  readonly text: {
    readonly enabled: boolean;
    readonly blockedTerms: { readonly es: readonly string[]; readonly en: readonly string[] };
    readonly piiPatterns: readonly ("phone" | "email" | "address" | "url")[];
  };
  readonly holdAll: boolean;
  readonly reactions: { readonly es: readonly string[]; readonly en: readonly string[] };
}

const PII = ["phone", "email", "address", "url"] as const;
const REACTIONS = ["like", "party", "think", "heart"] as const;

/**
 * What applies when the registry cannot be read: the strictest values. Moderation on, every item
 * held for the organizer, all personal-data checks on. Mirrors the registry defaults.
 */
export const DEFAULT_GROUP_SETTINGS: GroupSettings = {
  revision: null,
  image: { enabled: true, unsafe: 0.5, uncertain: 0.2 },
  text: { enabled: true, blockedTerms: { es: [], en: [] }, piiPatterns: [...PII] },
  holdAll: true,
  reactions: { es: [...REACTIONS], en: [...REACTIONS] },
};

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function list<T extends string>(
  value: unknown,
  allowed: readonly T[],
  max: number,
): T[] | undefined {
  if (!Array.isArray(value) || value.length > max) return undefined;
  const out: T[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !(allowed as readonly string[]).includes(item))
      return undefined;
    if (!out.includes(item as T)) out.push(item as T);
  }
  return out;
}

function terms(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length > 200) return undefined;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || item.length < 1 || item.length > 32) return undefined;
    out.push(item);
  }
  return out;
}

/** All or nothing: any malformed part makes the whole response unusable, so defaults apply. */
export function parseGroupSettings(body: unknown): GroupSettings | undefined {
  const root = record(body);
  const group = record(root?.["group"]);
  const moderation = record(group?.["moderation"]);
  const image = record(moderation?.["image"]);
  const text = record(moderation?.["text"]);
  const queue = record(group?.["approvalQueue"]);
  const reactions = record(group?.["reactions"]);
  const blocked = record(text?.["blockedTerms"]);
  if (!root || !image || !text || !queue || !reactions || !blocked) return undefined;
  const revision = root["revision"];
  const unsafe = image["unsafeThreshold"];
  const uncertain = image["uncertainThreshold"];
  const pii = list(text["piiPatterns"], PII, 4);
  const es = terms(blocked["es"]);
  const en = terms(blocked["en"]);
  const reactEs = list(reactions["es"], REACTIONS, 4);
  const reactEn = list(reactions["en"], REACTIONS, 4);
  if (
    typeof revision !== "number" ||
    typeof unsafe !== "number" ||
    typeof uncertain !== "number" ||
    !(unsafe > 0 && unsafe <= 1 && uncertain >= 0 && uncertain <= unsafe) ||
    typeof image["enabled"] !== "boolean" ||
    typeof text["enabled"] !== "boolean" ||
    typeof queue["holdAll"] !== "boolean" ||
    !pii ||
    !es ||
    !en ||
    !reactEs ||
    !reactEn
  ) {
    return undefined;
  }
  return {
    revision,
    image: { enabled: image["enabled"], unsafe, uncertain },
    text: { enabled: text["enabled"], blockedTerms: { es, en }, piiPatterns: pii },
    holdAll: queue["holdAll"],
    reactions: { es: reactEs, en: reactEn },
  };
}

/** One same-origin read. Never throws: on any failure the strict defaults apply. */
export async function loadGroupSettings(
  fetchLike: FetchLike = (input, init) => globalThis.fetch(input, init) as ReturnType<FetchLike>,
): Promise<GroupSettings> {
  try {
    const response = await fetchLike("/api/tutor/group-config", {
      method: "GET",
      headers: { accept: "application/json" },
      credentials: "same-origin",
    });
    if (response.status !== 200) return DEFAULT_GROUP_SETTINGS;
    return parseGroupSettings(JSON.parse(await response.text())) ?? DEFAULT_GROUP_SETTINGS;
  } catch {
    return DEFAULT_GROUP_SETTINGS;
  }
}
