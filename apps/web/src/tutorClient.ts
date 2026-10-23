import {
  createDeterministicTutorResponse,
  parseTutorResponse,
  type TutorRequest,
  type TutorResponse,
} from "@agorix/tutor-contract";
import type { AiStatus } from "./aiStatus.js";

export type TutorHintSource = "server" | "local";

export interface WebTutorHint {
  readonly response: TutorResponse;
  readonly source: TutorHintSource;
}

const RESPONSE_PATH = "/api/tutor/respond";
const MAX_BODY_BYTES = 64 * 1024;

/** The Web coach sends only the bounded mission/program/runtime contract to its own server. */
export async function requestWebTutorHint(
  request: TutorRequest,
  status: AiStatus,
  fetchImpl: typeof fetch = fetch,
): Promise<WebTutorHint> {
  const local = (): WebTutorHint => ({
    response: createDeterministicTutorResponse(request),
    source: "local",
  });
  if (status !== "active") return local();

  const body = JSON.stringify(request);
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) return local();

  try {
    const response = await fetchImpl(RESPONSE_PATH, {
      method: "POST",
      credentials: "same-origin",
      headers: { accept: "application/json", "content-type": "application/json" },
      body,
      signal: AbortSignal.timeout(8_000),
    });
    if (
      !response.ok ||
      !(response.headers.get("content-type") ?? "").includes("application/json")
    ) {
      return local();
    }
    const payload: unknown = await response.json();
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return local();
    const value = payload as Record<string, unknown>;
    if (value.source !== "runtime") return local();
    return { response: parseTutorResponse(value.response), source: "server" };
  } catch {
    return local();
  }
}
