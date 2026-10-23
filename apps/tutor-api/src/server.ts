import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { validateTutorRequest } from "@agorix/tutor-contract";
import {
  createFreeWorldMission,
  getKidsMission,
  KIDS_MISSION_IDS,
  KIDS_FREE_MISSION_ID,
  KIDS_GRID,
} from "@agorix/curriculum";
import { validateProgram, type ProjectProgram } from "@agorix/program-model";
import {
  runOriAdvanced,
  type OriAdvancedActorId,
  validateOriAdvancedProposal,
} from "@agorix/ori-agent";
import {
  createMemoryAdvancedStageRepository,
  proveAdvancedEntry,
  type AdvancedStageRepository,
} from "./advancedSessions.js";
import {
  evaluateOriAgentOutput,
  isOriChatTextValid,
  runOriChat,
  type OriChatContext,
  runOriGoalAgent,
} from "@agorix/ori-agent";
import type { ProviderRuntimeErrorCode, ProviderRuntimeFetch } from "@agorix/provider-runtime";
import {
  isTutorAdapterConfigured,
  requestTutorResponse,
  type TutorAdapterConfig,
} from "./index.js";
import type { OriCliService } from "./oriCli.js";

export const MAX_BODY_BYTES = 64 * 1024;
const HEALTH_TTL_MS = 15_000;

export interface TutorServerOptions {
  readonly config: TutorAdapterConfig;
  /** Injected for tests; defaults to the platform `fetch`. */
  readonly fetch?: typeof fetch;
  readonly healthTtlMs?: number;
  readonly now?: () => number;
  readonly ori?: OriCliService;
  readonly advancedStages?: AdvancedStageRepository;
}

interface Health {
  readonly configured: boolean;
  readonly available: boolean;
  readonly providerInUse: "deterministic" | "openai-compatible" | "codex" | "opencode";
  readonly lastErrorClass: ProviderRuntimeErrorCode | null;
  /** Adult diagnostics only; never included in a child's Ori response. */
  readonly lastOriSource: "model" | "fallback" | "refusal" | null;
}

/**
 * Same-origin HTTP surface for the Learning Companion (issue #348). It sits behind the web
 * host (`/api/tutor/*`), reads provider settings from the server environment only, and
 * answers with the deterministic fallback whenever the provider is missing or fails. The
 * browser never receives a provider token, endpoint or diagnostic detail.
 */
export function createTutorServer(options: TutorServerOptions): Server {
  const { config } = options;
  const fetchImpl = options.fetch ?? fetch;
  const ttl = options.healthTtlMs ?? HEALTH_TTL_MS;
  const now = options.now ?? Date.now;
  let cached: { readonly at: number; readonly health: Health } | undefined;
  let lastErrorClass: ProviderRuntimeErrorCode | null = null;
  let lastOriSource: Health["lastOriSource"] = null;
  const chatRate = new Map<string, { count: number; start: number }>();
  const advancedStages = options.advancedStages ?? createMemoryAdvancedStageRepository(now);

  async function health(): Promise<Health> {
    if (cached !== undefined && now() - cached.at < ttl) return cached.health;
    if (options.ori) {
      const ori = await options.ori.health();
      const value: Health = { ...ori, lastErrorClass, lastOriSource };
      cached = { at: now(), health: value };
      return value;
    }
    const configured = isTutorAdapterConfigured(config);
    const available = configured && (await probe());
    const value: Health = {
      configured,
      available,
      providerInUse:
        available && config.adapter === "openai-compatible" ? "openai-compatible" : "deterministic",
      lastErrorClass,
      lastOriSource,
    };
    cached = { at: now(), health: value };
    return value;
  }

  async function probe(): Promise<boolean> {
    if (config.adapter === "fake") {
      lastErrorClass = null;
      return true;
    }
    const baseUrl = config.baseUrl;
    if (baseUrl === undefined) return false;
    const headers: Record<string, string> = {};
    if (config.authToken !== undefined) {
      headers[config.authHeaderName ?? "authorization"] =
        config.authHeaderName === undefined ? `Bearer ${config.authToken}` : config.authToken;
    }
    try {
      const response = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/models`, {
        headers,
        signal: AbortSignal.timeout(config.timeoutMs),
      });
      if (response.ok) {
        lastErrorClass = null;
        return true;
      }
      lastErrorClass =
        response.status === 401 || response.status === 403
          ? "authentication-failed"
          : response.status >= 500
            ? "provider-error"
            : "provider-unavailable";
      return false;
    } catch (cause) {
      lastErrorClass =
        cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError")
          ? "timeout"
          : "provider-unavailable";
      return false;
    }
  }

  return createServer((request, response) => {
    handle(request, response).catch(() => send(response, 500, error("internal")));
  });

  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const path = new URL(request.url ?? "/", "http://local").pathname;
    if (path === "/api/tutor/health") {
      if (request.method !== "GET") return send(response, 405, error("method-not-allowed"));
      return send(response, 200, await health());
    }
    if (path === "/api/tutor/respond") {
      if (request.method !== "POST") return send(response, 405, error("method-not-allowed"));
      return respond(request, response);
    }
    if (path === "/api/tutor/ori") {
      if (request.method !== "POST") return send(response, 405, error("method-not-allowed"));
      return respondOri(request, response);
    }
    if (path === "/api/tutor/advanced/session") {
      if (request.method !== "POST") return send(response, 405, error("method-not-allowed"));
      return advancedSession(request, response);
    }
    if (path === "/api/tutor/advanced/ori") {
      if (request.method !== "POST") return send(response, 405, error("method-not-allowed"));
      return respondAdvanced(request, response);
    }
    if (path === "/api/tutor/chat") {
      if (request.method !== "POST") return send(response, 405, error("method-not-allowed"));
      return respondChat(request, response);
    }
    if (path === "/api/tutor/goals") {
      if (request.method !== "POST") return send(response, 405, error("method-not-allowed"));
      return respondGoal(request, response);
    }
    return send(response, 404, error("not-found"));
  }

  async function respond(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (!(request.headers["content-type"] ?? "").includes("application/json")) {
      return send(response, 415, error("unsupported-media-type"));
    }
    if (!sameOrigin(request)) return send(response, 403, error("forbidden-origin"));
    const body = await readBody(request);
    if (body === "too-large") return send(response, 413, error("payload-too-large"));
    let tutorRequest;
    try {
      tutorRequest = validateTutorRequest(JSON.parse(body));
    } catch {
      return send(response, 400, error("invalid-request"));
    }
    const result = await requestTutorResponse(tutorRequest, config, {
      fetch: fetchImpl as unknown as ProviderRuntimeFetch,
    });
    if (result.diagnostics.errorCode !== undefined) lastErrorClass = result.diagnostics.errorCode;
    else lastErrorClass = null;
    cached = undefined;
    return send(response, 200, { response: result.response, source: result.diagnostics.source });
  }

  async function respondOri(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (!(request.headers["content-type"] ?? "").includes("application/json")) {
      return send(response, 415, error("unsupported-media-type"));
    }
    if (!sameOrigin(request)) return send(response, 403, error("forbidden-origin"));
    const body = await readBody(request);
    if (body === "too-large") return send(response, 413, error("payload-too-large"));
    let input: {
      missionId: string;
      locale: "es" | "en";
      hintLevel: 1 | 2 | 3 | 4 | 5;
      program: ProjectProgram;
    };
    try {
      const raw = JSON.parse(body) as Record<string, unknown>;
      if (
        !raw ||
        typeof raw !== "object" ||
        Array.isArray(raw) ||
        Object.keys(raw).sort().join(",") !== "hintLevel,locale,missionId,program" ||
        typeof raw.missionId !== "string" ||
        !KIDS_MISSION_IDS.includes(raw.missionId as (typeof KIDS_MISSION_IDS)[number]) ||
        (raw.locale !== "es" && raw.locale !== "en") ||
        ![1, 2, 3, 4, 5].includes(raw.hintLevel as number)
      )
        throw new Error("invalid Ori request");
      input = {
        missionId: raw.missionId,
        locale: raw.locale,
        hintLevel: raw.hintLevel as 1 | 2 | 3 | 4 | 5,
        program: validateProgram(raw.program as ProjectProgram),
      };
    } catch {
      return send(response, 400, error("invalid-request"));
    }
    const missionIndex = KIDS_MISSION_IDS.indexOf(
      input.missionId as (typeof KIDS_MISSION_IDS)[number],
    ) as 0 | 1 | 2;
    const mission = getKidsMission(input.missionId, input.locale);
    const context = {
      mission,
      missionIndex,
      program: input.program,
      locale: input.locale,
      hintLevel: input.hintLevel,
    };
    const decision = options.ori
      ? await options.ori.respond(context)
      : evaluateOriAgentOutput(context, undefined);
    if (decision.source === "fallback") lastErrorClass = "provider-unavailable";
    else lastErrorClass = null;
    lastOriSource = decision.source;
    cached = undefined;
    return send(response, 200, {
      message: decision.message,
      ...(decision.proposal === undefined ? {} : { proposal: decision.proposal }),
    });
  }

  async function advancedSession(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    if (!(request.headers["content-type"] ?? "").includes("application/json"))
      return send(response, 415, error("unsupported-media-type"));
    if (!sameOrigin(request)) return send(response, 403, error("forbidden-origin"));
    const body = await readBody(request);
    if (body === "too-large") return send(response, 413, error("payload-too-large"));
    try {
      const raw = JSON.parse(body) as Record<string, unknown>;
      if (
        !raw ||
        Array.isArray(raw) ||
        Object.keys(raw).sort().join() !== "programs" ||
        !proveAdvancedEntry(raw.programs)
      )
        throw new Error("invalid proof");
      return send(response, 200, { token: advancedStages.create("scene"), stage: "scene" });
    } catch {
      return send(response, 400, error("invalid-request"));
    }
  }

  async function respondAdvanced(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    if (!(request.headers["content-type"] ?? "").includes("application/json"))
      return send(response, 415, error("unsupported-media-type"));
    if (!sameOrigin(request)) return send(response, 403, error("forbidden-origin"));
    const body = await readBody(request);
    if (body === "too-large") return send(response, 413, error("payload-too-large"));
    try {
      const raw = JSON.parse(body) as Record<string, unknown>;
      if (
        !raw ||
        Array.isArray(raw) ||
        Object.keys(raw).sort().join() !== "actorId,locale,program,token" ||
        typeof raw.token !== "string" ||
        raw.token.length > 64 ||
        (raw.locale !== "es" && raw.locale !== "en") ||
        (raw.actorId !== "actor:ori" && raw.actorId !== "actor:friend") ||
        advancedStages.get(raw.token) !== "scene"
      )
        throw new Error("invalid stage");
      const context = {
        stage: "scene" as const,
        actorId: raw.actorId as OriAdvancedActorId,
        locale: raw.locale as "es" | "en",
        program: validateProgram(raw.program as ProjectProgram),
      };
      let decision;
      try {
        decision = options.ori
          ? await options.ori.advanced(context)
          : await runOriAdvanced(context);
      } catch {
        decision = await runOriAdvanced(context);
      }
      if (decision.proposal) validateOriAdvancedProposal(context, decision.proposal);
      lastOriSource = decision.source;
      cached = undefined;
      return send(response, 200, {
        message: decision.message,
        ...(decision.proposal ? { proposal: decision.proposal } : {}),
      });
    } catch {
      return send(response, 400, error("invalid-request"));
    }
  }

  async function respondChat(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (!(request.headers["content-type"] ?? "").includes("application/json"))
      return send(response, 415, error("unsupported-media-type"));
    if (!sameOrigin(request)) return send(response, 403, error("forbidden-origin"));
    const body = await readBody(request);
    if (body === "too-large") return send(response, 413, error("payload-too-large"));
    let context: OriChatContext;
    try {
      const raw = JSON.parse(body) as Record<string, unknown>;
      if (
        !raw ||
        typeof raw !== "object" ||
        Array.isArray(raw) ||
        !["locale,missionId,program,text", "goalCell,locale,missionId,program,text"].includes(
          Object.keys(raw).sort().join(","),
        ) ||
        typeof raw.missionId !== "string" ||
        (!(KIDS_MISSION_IDS as readonly string[]).includes(raw.missionId) &&
          raw.missionId !== KIDS_FREE_MISSION_ID) ||
        (raw.locale !== "es" && raw.locale !== "en") ||
        !isOriChatTextValid(raw.text)
      )
        throw new Error("invalid chat request");
      const goal = raw.goalCell;
      if (raw.missionId === KIDS_FREE_MISSION_ID) {
        if (!goal || typeof goal !== "object" || Array.isArray(goal))
          throw new Error("invalid goal");
        const cell = goal as Record<string, unknown>;
        if (
          Object.keys(cell).sort().join(",") !== "cx,cy" ||
          !Number.isInteger(cell.cx) ||
          !Number.isInteger(cell.cy) ||
          (cell.cx as number) < 0 ||
          (cell.cx as number) >= KIDS_GRID.cols ||
          (cell.cy as number) < 0 ||
          (cell.cy as number) >= KIDS_GRID.rows
        )
          throw new Error("invalid goal");
      } else if (goal !== undefined) throw new Error("unexpected goal");
      context = {
        mission:
          raw.missionId === KIDS_FREE_MISSION_ID
            ? createFreeWorldMission(goal as { cx: number; cy: number }, raw.locale)
            : getKidsMission(raw.missionId, raw.locale),
        program: validateProgram(raw.program as ProjectProgram),
        locale: raw.locale,
        text: raw.text,
      };
    } catch {
      return send(response, 400, error("invalid-request"));
    }
    const key = request.socket.remoteAddress ?? "unknown";
    const current = chatRate.get(key);
    const stamp = now();
    const next =
      !current || stamp - current.start >= 60_000
        ? { count: 1, start: stamp }
        : { count: current.count + 1, start: current.start };
    chatRate.set(key, next);
    if (next.count > 6) return send(response, 429, error("rate-limited"));
    const message = options.ori ? await options.ori.chat(context) : await runOriChat(context);
    return send(response, 200, { message });
  }

  async function respondGoal(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (!(request.headers["content-type"] ?? "").includes("application/json"))
      return send(response, 415, error("unsupported-media-type"));
    if (!sameOrigin(request)) return send(response, 403, error("forbidden-origin"));
    const body = await readBody(request);
    if (body === "too-large") return send(response, 413, error("payload-too-large"));
    let locale: "es" | "en";
    try {
      const raw = JSON.parse(body) as Record<string, unknown>;
      if (
        !raw ||
        typeof raw !== "object" ||
        Array.isArray(raw) ||
        Object.keys(raw).join(",") !== "locale" ||
        (raw.locale !== "es" && raw.locale !== "en")
      )
        throw new Error("invalid goal request");
      locale = raw.locale;
    } catch {
      return send(response, 400, error("invalid-request"));
    }
    const key = request.socket.remoteAddress ?? "unknown";
    const current = chatRate.get(key);
    const stamp = now();
    const next =
      !current || stamp - current.start >= 60_000
        ? { count: 1, start: stamp }
        : { count: current.count + 1, start: current.start };
    chatRate.set(key, next);
    if (next.count > 6) return send(response, 429, error("rate-limited"));
    const proposal = options.ori
      ? await options.ori.proposeGoal(locale)
      : await runOriGoalAgent(locale);
    return send(response, 200, {
      cell: proposal.cell,
      successCheck: proposal.successCheck,
      message: proposal.message,
    });
  }
}

/** A browser request must come from the host that served the page; non-browser callers send no Origin. */
function sameOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  if (origin === undefined) return true;
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
}

async function readBody(request: IncomingMessage): Promise<string | "too-large"> {
  const declared = Number(request.headers["content-length"] ?? 0);
  if (declared > MAX_BODY_BYTES) return "too-large";
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > MAX_BODY_BYTES) return "too-large";
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function error(code: string): { readonly error: { readonly code: string } } {
  return { error: { code } };
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(body));
}
