import { validateOriContextInput, type OriContextInput } from "./oriContextPreview.js";
import type { OriRuntimePreview } from "./oriRuntimePreview.js";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createOriExternalShadowDispatcher, type OriExternalShadow } from "./oriExternalShadow.js";
import { validateTutorRequest } from "@agorix/tutor-contract";
import {
  createFreeWorldMission,
  getKidsMission,
  defaultKidsCatalog,
  KIDS_MISSION_IDS,
  KIDS_MISSION_WORLDS,
  type KidsMissionWorld,
  KIDS_FREE_MISSION_ID,
  KIDS_GRID,
} from "@agorix/curriculum";
import { validateProgram, type ProjectProgram } from "@agorix/program-model";
import {
  runOriAdvancedStage,
  createOriStudioInput,
  runOriStudio,
  validateOriStudioProposal,
  type OriStudioContext,
  type OriAdvancedActorId,
  validateOriAdvancedStageProposal,
} from "@agorix/ori-agent";
import { createOriChatStats } from "./oriChatStats.js";
import { gateAiConfig } from "./aiConfigGate.js";
import {
  createMemoryAdvancedStageRepository,
  proveAdvancedEntry,
  proveAdvancedScene,
  proveAdvancedReact,
  type AdvancedStageRepository,
} from "./advancedSessions.js";
import {
  evaluateOriAgentOutput,
  isOriChatTextValid,
  ORI_CHAT_FALLBACK,
  ORI_CHAT_REFUSAL,
  composeOriInstructions,
  fixedOriInstructions,
  getOriAgentDefinitions,
  ORI_AGENT_LOCKED_RULES,
  ORI_INTERVENTION_DEFAULT,
  runOriChat,
  simulateOriIntervention,
  type OriAgentCapability,
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
import type { OriCliDiagnostics } from "./oriCli.js";
import {
  AiConfigError,
  behaviorForBucket,
  configDiff,
  validateAiConfig,
  type AiCapability,
  type AiConfigRepository,
  type AiPolicy,
} from "./aiConfig.js";
import { AdminAuth } from "./adminAuth.js";

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
  readonly aiConfig?: AiConfigRepository;
  readonly adminAuth?: AdminAuth;
  readonly oriExternalShadow?: OriExternalShadow;
  readonly oriExternalShadowEnabled?: boolean;
  readonly oriRuntimePreview?: (intent: string) => Promise<OriRuntimePreview>;
  readonly oriRuntimePreviewEnabled?: boolean;
  readonly oriContextPreview?: (input: OriContextInput) => Promise<OriRuntimePreview>;
  readonly oriContextPreviewEnabled?: boolean;
}

interface Health {
  readonly configured: boolean;
  readonly available: boolean;
  readonly providerInUse: "deterministic" | "openai-compatible" | "codex" | "opencode";
  readonly lastErrorClass: ProviderRuntimeErrorCode | null;
  /** Adult diagnostics only; never included in a child's Ori response. */
  readonly lastOriSource: "model" | "fallback" | "refusal" | null;
  readonly oriMetrics?: Omit<OriCliDiagnostics, "lastErrorClass">;
}

/**
 * Same-origin HTTP surface for the Learning Companion (issue #348). It sits behind the web
 * host (`/api/tutor/*`), reads provider secrets from the server environment and policies
 * from the versioned server-side registry, and
 * answers with the deterministic fallback whenever the provider is missing or fails. The
 * browser never receives a provider token, endpoint or diagnostic detail.
 */
export function createTutorServer(options: TutorServerOptions): Server {
  const { config } = options;
  const fetchImpl = options.fetch ?? fetch;
  const ttl = options.healthTtlMs ?? HEALTH_TTL_MS;
  const chatStats = createOriChatStats();
  const now = options.now ?? Date.now;
  let cached: { readonly at: number; readonly health: Health } | undefined;
  let lastErrorClass: ProviderRuntimeErrorCode | null = null;
  let lastOriSource: Health["lastOriSource"] = null;
  const chatRate = new Map<string, { count: number; start: number }>();
  const advancedStages = options.advancedStages ?? createMemoryAdvancedStageRepository(now);
  const oriShadowDispatcher = createOriExternalShadowDispatcher();

  function policy(capability: AiCapability): AiPolicy | undefined {
    return options.aiConfig?.current().config.capabilities[capability];
  }

  function allowed(request: IncomingMessage, capability: AiCapability): boolean {
    const limit =
      policy(capability)?.requestsPerMinute ??
      (capability === "chat" || capability === "goals" ? 6 : 60);
    const key = `${request.headers["x-real-ip"] ?? request.socket.remoteAddress ?? "unknown"}:${capability}`;
    const current = chatRate.get(key);
    const stamp = now();
    const next =
      !current || stamp - current.start >= 60_000
        ? { count: 1, start: stamp }
        : { count: current.count + 1, start: current.start };
    chatRate.set(key, next);
    return next.count <= limit;
  }

  async function health(): Promise<Health> {
    if (cached !== undefined && now() - cached.at < ttl) return cached.health;
    if (options.ori) {
      const ori = await options.ori.health();
      const diagnostics = options.ori.diagnostics();
      const oriMetrics = {
        attempts: diagnostics.attempts,
        modelResponses: diagnostics.modelResponses,
        p50Ms: diagnostics.p50Ms,
        p95Ms: diagnostics.p95Ms,
      };
      const value: Health = { ...ori, lastErrorClass, lastOriSource, oriMetrics };
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
    if (path.startsWith("/api/tutor/admin/")) return adminRoute(path, request, response);
    if (path === "/api/tutor/group-config") {
      // Public and read-only on purpose: the closed-group parameters hold no secret, and the group
      // server and the organizer's device both need them. Admin credentials never apply here.
      if (request.method !== "GET") return send(response, 405, error("method-not-allowed"));
      if (!options.aiConfig) return send(response, 503, error("config-unavailable"));
      const { revision, config } = options.aiConfig.current();
      return send(response, 200, { revision, group: config.group });
    }
    if (path === "/api/tutor/ori/context-preview") {
      if (request.method !== "POST") return send(response, 405, error("method-not-allowed"));
      if (!options.oriContextPreviewEnabled || !options.oriContextPreview)
        return send(response, 404, error("not-found"));
      if (!sameOrigin(request)) return send(response, 403, error("forbidden-origin"));
      if (!(request.headers["content-type"] ?? "").includes("application/json"))
        return send(response, 415, error("unsupported-media-type"));
      if (!allowed(request, "chat")) return send(response, 429, error("rate-limited"));
      const body = await readBody(request);
      if (body === "too-large") return send(response, 413, error("payload-too-large"));
      let input: OriContextInput | null;
      try {
        input = validateOriContextInput(JSON.parse(body));
      } catch {
        input = null;
      }
      if (!input) return send(response, 400, error("invalid-request"));
      return send(response, 200, await options.oriContextPreview(input));
    }
    if (path === "/api/tutor/ori/runtime-preview") {
      if (request.method !== "POST") return send(response, 405, error("method-not-allowed"));
      if (!options.oriRuntimePreviewEnabled || !options.oriRuntimePreview)
        return send(response, 404, error("not-found"));
      if (!sameOrigin(request)) return send(response, 403, error("forbidden-origin"));
      if (!(request.headers["content-type"] ?? "").includes("application/json"))
        return send(response, 415, error("unsupported-media-type"));
      if (!allowed(request, "chat")) return send(response, 429, error("rate-limited"));
      const body = await readBody(request);
      if (body === "too-large") return send(response, 413, error("payload-too-large"));
      let intent: string;
      try {
        const value: unknown = JSON.parse(body);
        if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("invalid");
        const data = value as Record<string, unknown>;
        if (
          Object.keys(data).length !== 1 ||
          typeof data["intent"] !== "string" ||
          !["help", "repeat", "turn", "move", "debug"].includes(data["intent"])
        )
          throw Error("invalid");
        intent = data["intent"];
      } catch {
        return send(response, 400, error("invalid-request"));
      }
      const result = await options.oriRuntimePreview(intent);
      return send(response, 200, result);
    }
    if (path === "/api/tutor/health") {
      if (request.method !== "GET") return send(response, 405, error("method-not-allowed"));
      return send(response, 200, await health());
    }
    if (path === "/api/tutor/behavior") {
      if (request.method !== "GET") return send(response, 405, error("method-not-allowed"));
      // Numbers only: no prompt, provider or model ever reaches the browser. The bucket is a random
      // device number (0 to 99) that only decides whether a gradual rollout has reached it.
      const raw = new URL(request.url ?? "/", "http://localhost").searchParams.get("bucket");
      const bucket = raw !== null && /^\d{1,2}$/.test(raw) ? Number(raw) : undefined;
      const behavior = options.aiConfig
        ? behaviorForBucket(options.aiConfig.history(), bucket)
        : undefined;
      return send(response, 200, {
        intervention: behavior?.intervention ?? { ...ORI_INTERVENTION_DEFAULT },
      });
    }
    if (path === "/api/tutor/catalog") {
      if (request.method !== "GET") return send(response, 405, error("method-not-allowed"));
      // Cells and short titles only: the missions as published, never a prompt or a setting.
      return send(response, 200, {
        catalog: options.aiConfig?.current().config.catalog ?? defaultKidsCatalog(),
      });
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
    if (path === "/api/tutor/studio/ori") {
      if (request.method !== "POST") return send(response, 405, error("method-not-allowed"));
      return respondStudio(request, response);
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

  async function adminRoute(
    path: string,
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    const auth = options.adminAuth;
    const repository = options.aiConfig;
    if (!auth?.configured || !repository) return send(response, 503, error("admin-unavailable"));
    if (!sameOrigin(request)) return send(response, 403, error("forbidden-origin"));
    if (path === "/api/tutor/admin/session" && request.method === "POST") {
      if (!(request.headers["content-type"] ?? "").includes("application/json"))
        return send(response, 415, error("unsupported-media-type"));
      const body = await readBody(request);
      if (body === "too-large") return send(response, 413, error("payload-too-large"));
      let password: string;
      try {
        const raw = JSON.parse(body) as Record<string, unknown>;
        if (
          !raw ||
          Array.isArray(raw) ||
          Object.keys(raw).join() !== "password" ||
          typeof raw.password !== "string" ||
          raw.password.length > 256
        )
          throw new Error("invalid");
        password = raw.password;
      } catch {
        return send(response, 400, error("invalid-request"));
      }
      const session = auth.signIn(password, request, response);
      return session ? send(response, 200, session) : send(response, 401, error("unauthorized"));
    }
    const session = auth.read(request);
    if (!session) return send(response, 401, error("unauthorized"));
    if (path === "/api/tutor/admin/session" && request.method === "GET")
      return send(response, 200, session);
    if (request.method !== "GET" && request.headers["x-agorix-admin-csrf"] !== session.csrf)
      return send(response, 403, error("invalid-csrf"));
    if (path === "/api/tutor/admin/session" && request.method === "DELETE") {
      auth.signOut(request, response);
      return send(response, 200, { ok: true });
    }
    if (path === "/api/tutor/admin/agents" && request.method === "GET") {
      // Admin only: the fixed contract an administrator's text is added after, never replaces.
      const extra = (capability: OriAgentCapability) =>
        repository.current().config.capabilities[capability].promptTemplate;
      return send(response, 200, {
        lockedRules: ORI_AGENT_LOCKED_RULES,
        agents: getOriAgentDefinitions().map((agent) => {
          const fixed = fixedOriInstructions(agent.capability, "es");
          return {
            ...agent,
            fixedInstructions: fixed,
            effectiveInstructions: composeOriInstructions(fixed, extra(agent.capability)),
          };
        }),
      });
    }
    if (path === "/api/tutor/admin/ori-stats" && request.method === "GET")
      return send(response, 200, chatStats.snapshot());
    if (path === "/api/tutor/admin/config" && request.method === "GET")
      return send(response, 200, {
        current: repository.current(),
        history: repository.history().map(({ config, ...meta }) => ({
          ...meta,
          rolloutPercent: config.behavior.rolloutPercent,
        })),
      });
    if (
      ![
        "/api/tutor/admin/preview",
        "/api/tutor/admin/publish",
        "/api/tutor/admin/rollback",
      ].includes(path) ||
      request.method !== "POST"
    )
      return send(response, 404, error("not-found"));
    if (!(request.headers["content-type"] ?? "").includes("application/json"))
      return send(response, 415, error("unsupported-media-type"));
    const body = await readBody(request);
    if (body === "too-large") return send(response, 413, error("payload-too-large"));
    try {
      const raw = JSON.parse(body) as Record<string, unknown>;
      const expected = raw.expectedRevision;
      if (!Number.isInteger(expected) || (expected as number) < 1)
        throw new AiConfigError("invalid-config");
      if (path === "/api/tutor/admin/rollback") {
        if (
          Object.keys(raw).sort().join() !== "expectedRevision,sourceRevision" ||
          !Number.isInteger(raw.sourceRevision)
        )
          throw new AiConfigError("invalid-config");
        return send(response, 200, {
          current: repository.rollback(
            raw.sourceRevision as number,
            expected as number,
            session.author,
          ),
        });
      }
      if (Object.keys(raw).sort().join() !== "config,expectedRevision")
        throw new AiConfigError("invalid-config");
      const current = repository.current();
      // An older client posting v1 keeps the current group settings instead of resetting them.
      const config = validateAiConfig(raw.config, current.config);
      if (current.revision !== expected) throw new AiConfigError("revision-conflict");
      const failures = await gateAiConfig(config);
      if (path === "/api/tutor/admin/preview")
        return send(response, 200, {
          valid: failures.length === 0,
          failures,
          changed: configDiff(current.config, config),
          expectedRevision: current.revision,
          // Synthetic learners only: what Ori would do under this candidate, never real data.
          simulation: simulateOriIntervention(config.behavior.intervention),
        });
      if (failures.length > 0) return send(response, 422, { error: "gate-failed", failures });
      return send(response, 200, {
        current: repository.publish(config, expected as number, session.author),
      });
    } catch (cause) {
      const code = cause instanceof AiConfigError ? cause.code : "invalid-config";
      return send(
        response,
        code === "revision-conflict" ? 409 : code === "revision-not-found" ? 404 : 400,
        error(code),
      );
    }
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
    if (!allowed(request, "legacy")) return send(response, 429, error("rate-limited"));
    const legacy = policy("legacy");
    const effectiveConfig: TutorAdapterConfig = legacy
      ? {
          ...config,
          adapter:
            !legacy.enabled || legacy.provider === "disabled"
              ? "fake"
              : (legacy.provider as "fake" | "openai-compatible"),
          model: legacy.model,
          timeoutMs: legacy.timeoutMs,
          promptTemplate: legacy.promptTemplate,
        }
      : config;
    const result = await requestTutorResponse(tutorRequest, effectiveConfig, {
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
      world: KidsMissionWorld;
    };
    try {
      const raw = JSON.parse(body) as Record<string, unknown>;
      if (
        !raw ||
        typeof raw !== "object" ||
        Array.isArray(raw) ||
        // The world is optional: older browsers do not send it and mean the space world.
        ![
          "hintLevel,locale,missionId,program",
          "hintLevel,locale,missionId,program,world",
        ].includes(Object.keys(raw).sort().join(",")) ||
        (raw.world !== undefined &&
          !(KIDS_MISSION_WORLDS as readonly unknown[]).includes(raw.world)) ||
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
        world: (raw.world as KidsMissionWorld | undefined) ?? "space",
      };
    } catch {
      return send(response, 400, error("invalid-request"));
    }
    if (!allowed(request, "mission")) return send(response, 429, error("rate-limited"));
    const missionIndex = KIDS_MISSION_IDS.indexOf(
      input.missionId as (typeof KIDS_MISSION_IDS)[number],
    ) as 0 | 1 | 2;
    oriShadowDispatcher.dispatch(
      options.oriExternalShadowEnabled === true,
      options.oriExternalShadow,
      {
        missionIndex,
        hintLevel: input.hintLevel,
        scriptCount: input.program.scripts.length,
      },
    );
    // The idea is built for the mission as it is published, so it matches what the child sees.
    const mission = getKidsMission(
      input.missionId,
      input.locale,
      input.world,
      options.aiConfig?.current().config.catalog,
    );
    const context = {
      mission,
      missionIndex,
      program: input.program,
      locale: input.locale,
      hintLevel: input.hintLevel,
    };
    const decision =
      policy("mission")?.enabled === false
        ? evaluateOriAgentOutput(context, undefined)
        : options.ori
          ? await options.ori.respond(context)
          : evaluateOriAgentOutput(context, undefined);
    if (options.ori)
      lastErrorClass =
        policy("mission")?.enabled === false
          ? "not-configured"
          : options.ori.diagnostics().lastErrorClass;
    else lastErrorClass = decision.source === "fallback" ? "provider-unavailable" : null;
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
        ![
          "programs",
          "programs,sceneProgram,stage",
          "programs,reactProgram,sceneProgram,stage",
        ].includes(Object.keys(raw).sort().join()) ||
        !proveAdvancedEntry(raw.programs)
      )
        throw new Error("invalid proof");
      const stage = raw.stage === undefined ? "scene" : raw.stage;
      if (stage !== "scene" && stage !== "react" && stage !== "score")
        throw new Error("invalid stage");
      if (stage !== "scene" && !proveAdvancedScene(raw.sceneProgram))
        throw new Error("invalid scene proof");
      if (stage === "score" && !proveAdvancedReact(raw.reactProgram))
        throw new Error("invalid reaction proof");
      return send(response, 200, { token: advancedStages.create(stage), stage });
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
        !advancedStages.get(raw.token)
      )
        throw new Error("invalid stage");
      const stage = advancedStages.get(raw.token)!;
      const context = {
        stage,
        actorId: raw.actorId as OriAdvancedActorId,
        locale: raw.locale as "es" | "en",
        program: validateProgram(raw.program as ProjectProgram),
      };
      let decision;
      try {
        if (!allowed(request, "advanced")) return send(response, 429, error("rate-limited"));
        decision =
          policy("advanced")?.enabled === false
            ? await runOriAdvancedStage(context)
            : options.ori
              ? await options.ori.advanced(context)
              : await runOriAdvancedStage(context);
      } catch {
        decision = await runOriAdvancedStage(context);
      }
      if (decision.proposal) validateOriAdvancedStageProposal(context, decision.proposal);
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

  async function respondStudio(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (!(request.headers["content-type"] ?? "").includes("application/json"))
      return send(response, 415, error("unsupported-media-type"));
    if (!sameOrigin(request)) return send(response, 403, error("forbidden-origin"));
    const body = await readBody(request);
    if (body === "too-large") return send(response, 413, error("payload-too-large"));
    let context: OriStudioContext;
    try {
      const raw = JSON.parse(body) as Record<string, unknown>;
      if (
        !raw ||
        Array.isArray(raw) ||
        Object.keys(raw).sort().join() !== "actorId,locale,program" ||
        typeof raw.actorId !== "string" ||
        raw.actorId.length > 64 ||
        (raw.locale !== "es" && raw.locale !== "en")
      )
        throw new Error("invalid studio request");
      context = {
        actorId: raw.actorId,
        locale: raw.locale,
        program: validateProgram(raw.program as ProjectProgram),
      };
      createOriStudioInput(context);
    } catch {
      return send(response, 400, error("invalid-request"));
    }
    let decision;
    try {
      if (!allowed(request, "studio")) return send(response, 429, error("rate-limited"));
      decision =
        policy("studio")?.enabled === false
          ? await runOriStudio(context)
          : options.ori
            ? await options.ori.studio(context)
            : await runOriStudio(context);
      if (decision.proposal) validateOriStudioProposal(context, decision.proposal);
    } catch {
      decision = await runOriStudio(context);
    }
    lastOriSource = decision.source;
    cached = undefined;
    return send(response, 200, {
      message: decision.message,
      ...(decision.proposal ? { proposal: decision.proposal } : {}),
    });
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
      chatStats.record("invalid");
      return send(response, 400, error("invalid-request"));
    }
    if (!allowed(request, "chat")) {
      chatStats.record("rate-limited");
      return send(response, 429, error("rate-limited"));
    }
    const message =
      policy("chat")?.enabled === false
        ? await runOriChat(context)
        : options.ori
          ? await options.ori.chat(context)
          : await runOriChat(context);
    chatStats.record(
      message === ORI_CHAT_REFUSAL[context.locale]
        ? "refused"
        : message === ORI_CHAT_FALLBACK[context.locale]
          ? "fallback"
          : "answered",
    );
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
    if (!allowed(request, "goals")) return send(response, 429, error("rate-limited"));
    const proposal =
      policy("goals")?.enabled === false
        ? await runOriGoalAgent(locale)
        : options.ori
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
