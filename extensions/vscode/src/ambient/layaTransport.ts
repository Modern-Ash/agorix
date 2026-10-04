import type { LayaBatchTransport } from "@agorix/learning-decision-plane";
import { classifyEndpointLocality, type StudioFetch } from "../studioProvider.js";

export interface HttpLayaTransportOptions {
  readonly endpoint: string;
  readonly allowRemote: boolean;
  readonly timeoutMs: number;
  readonly fetch: StudioFetch;
}

export function createHttpLayaTransport(
  options: HttpLayaTransportOptions,
): LayaBatchTransport | undefined {
  const endpoint = normalizeEndpoint(options.endpoint);
  const locality = endpoint === "" ? undefined : classifyEndpointLocality(endpoint);
  if (locality === undefined || (locality === "remote" && !options.allowRemote)) {
    return undefined;
  }
  return {
    async decideMany(input) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs);
      try {
        const response = await options.fetch(`${endpoint}/decideMany`, {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify(input),
          signal: controller.signal,
        });
        if (!response.ok) return [];
        const parsed = JSON.parse(await response.text()) as unknown;
        return sanitizeLayaAnswers(parsed);
      } catch {
        return [];
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

function normalizeEndpoint(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function sanitizeLayaAnswers(value: unknown): readonly {
  readonly id: string;
  readonly value: string | number;
  readonly confidence: number;
}[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const record = item as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      (typeof record.value !== "string" && typeof record.value !== "number") ||
      typeof record.confidence !== "number" ||
      !Number.isFinite(record.confidence)
    ) {
      return [];
    }
    return [
      {
        id: record.id,
        value: record.value,
        confidence: Math.max(0, Math.min(1, record.confidence)),
      },
    ];
  });
}
