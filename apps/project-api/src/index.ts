import { createHash } from "node:crypto";
import { AuthPublicError, type AuthService } from "@agorix/auth-service";
import { GroupError, type GroupService } from "@agorix/group-service";
import { LinkError, normalizeEmail, type LinkService } from "@agorix/link-service";
import { PlatformContractError } from "@agorix/platform-contract";
import {
  AGORIX_PROJECT_MAX_BYTES,
  semanticProjectHash,
  type StoredProject,
} from "@agorix/persistence";
import {
  ProjectRepositoryError,
  validateStoredProject,
  type ProjectRecord,
  type ProjectRepository,
  type ProjectSummary,
} from "@agorix/project-repository";

export const PACKAGE_NAME = "@agorix/project-api";
export const PROJECT_API_CONTRACT_VERSION = "agorix/project-api/v1";
export const SESSION_COOKIE_NAME = "agorix_session";
/** Mutating requests must carry this header (value `1`): a non-simple header a cross-site form cannot set. */
export const CSRF_HEADER_NAME = "x-agorix-request";
export const IDEMPOTENCY_HEADER_NAME = "idempotency-key";

const BODY_ENVELOPE_BYTES = 16 * 1024;
/** Link, email and summary bodies are tiny; anything larger is refused before parsing. */
const SMALL_BODY_BYTES = 8 * 1024;
const MAX_IDEMPOTENCY_ENTRIES = 1000;
const PROJECT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const HISTORY_KEY_PATTERN = /undo|redo|history/i;

export type ProjectApiErrorCode =
  | "UNAUTHENTICATED"
  | "SESSION_EXPIRED"
  | "NOT_FOUND"
  | "VALIDATION"
  | "REVISION_CONFLICT"
  | "CSRF_REJECTED"
  | "TRANSIENT"
  | "RATE_LIMITED";

export interface ProjectApiErrorBody {
  readonly error: {
    readonly code: ProjectApiErrorCode;
    readonly message: string;
    readonly retryable: boolean;
    /** Validation only: stable machine reason, never echoes client content. */
    readonly reason?: string;
    /** Revision conflict only: safe metadata of the caller's own current project. */
    readonly recovery?: {
      readonly currentRevision: number;
      readonly currentUpdatedAt: string;
      readonly currentSemanticHash: string;
    };
  };
}

export interface ApiRequest {
  readonly method: string;
  /** Path plus optional query string, e.g. `/v1/projects?cursor=abc`. */
  readonly url: string;
  /** Header names must be lower-case. */
  readonly headers: Readonly<Record<string, string | undefined>>;
  /** Raw (unparsed) request body so size limits are enforced before parsing. */
  readonly body?: string;
}

export interface ApiResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
}

export interface ApiLogEvent {
  readonly route: string;
  readonly status: number;
  readonly errorCode?: ProjectApiErrorCode;
}

/** The adult-link surface (issues #505 to #508). Omit it and every `/v1/link` and `/v1/account` route is a 404. */
export type LinkApiService = Pick<
  LinkService,
  | "addEmail"
  | "resendVerification"
  | "verifyEmail"
  | "emailStatus"
  | "hasVerifiedEmail"
  | "createLinkCode"
  | "revokeLinkCodes"
  | "redeemLinkCode"
  | "resolveDevice"
  | "unlinkDevice"
  | "unlinkLink"
  | "setSyncEnabled"
  | "listDevices"
  | "putSummary"
  | "getSummaries"
  | "deleteAccountData"
>;

/** The closed-group surface (issue #566). Omit it and every `/v1/group` route is a 404. */
export type GroupApiService = Pick<
  GroupService,
  | "grantOrganizer"
  | "isOrganizer"
  | "createGroup"
  | "myGroup"
  | "setLocked"
  | "closeGroup"
  | "issueJoinCode"
  | "issueReconnectCode"
  | "redeemJoinCode"
  | "approve"
  | "removeSlot"
  | "assignTeam"
  | "deviceView"
>;

export const DEVICE_AUTH_SCHEME = "Bearer";
/** Set by the reverse proxy from the real connection; absent means one shared "unknown" bucket. */
export const CLIENT_ADDRESS_HEADER = "x-real-ip";

export interface ProjectApiOptions {
  readonly auth: Pick<
    AuthService,
    "register" | "signIn" | "signOut" | "resolveSession" | "deleteAccount"
  >;
  /**
   * Registration must carry an email (validated before the account exists). Needs `link`; without it
   * the option is ignored. Enabled by default when adult linking is configured.
   */
  readonly requireEmail?: boolean;
  /** Deployment-scoped adult registration allowlist. Empty/absent keeps the normal public flow. */
  readonly allowedAdultEmails?: readonly string[];
  readonly link?: LinkApiService;
  /** Closed same-room groups (ADR 0010). Off unless provided. */
  readonly group?: GroupApiService;
  readonly projects: ProjectRepository;
  /** Optional durable delete coordinator, used by the SQLite server for an all-or-nothing delete. */
  readonly deleteAccount?: (accountId: string, password: string) => Promise<void>;
  /** Allowed `Origin` values for mutating requests. Requests with a foreign Origin are rejected. */
  readonly allowedOrigins?: readonly string[];
  /** Adds `Secure` to the session cookie; must be true in production. */
  readonly secureCookies?: boolean;
  readonly maxBodyBytes?: number;
  /** Receives only route name, status and error code. Never ids, tokens, titles or payloads. */
  readonly log?: (event: ApiLogEvent) => void;
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ProjectApiErrorCode,
    message: string,
    readonly retryable = false,
    readonly reason?: string,
    readonly recovery?: ProjectApiErrorBody["error"]["recovery"],
  ) {
    super(message);
  }
}

interface CachedResponse {
  readonly fingerprint: string;
  readonly status: number;
  readonly body: unknown;
}

type Handler = (ctx: Context) => Promise<{ status: number; body: unknown }>;

interface Context {
  readonly ownerId: string;
  readonly request: ApiRequest;
  readonly params: readonly string[];
  readonly query: URLSearchParams;
  readonly idempotency?: string;
  readonly alias: string;
  readonly sessionExpiresAt: string;
}

interface Route {
  readonly name: string;
  readonly method: string;
  readonly pattern: RegExp;
  readonly handler: Handler;
}

export interface ProjectApi {
  handle(request: ApiRequest): Promise<ApiResponse>;
}

export function createProjectApi(options: ProjectApiOptions): ProjectApi {
  if (options.allowedAdultEmails && !options.link) {
    throw new Error("Adult registration allowlist requires email verification service");
  }
  const maxBodyBytes = options.maxBodyBytes ?? AGORIX_PROJECT_MAX_BYTES + BODY_ENVELOPE_BYTES;
  const allowedOrigins = new Set(options.allowedOrigins ?? []);
  const allowedAdultEmails = options.allowedAdultEmails
    ? new Set(options.allowedAdultEmails.map(normalizeEmail))
    : undefined;
  function requireAllowedAdultEmail(email: string): void {
    if (allowedAdultEmails && !allowedAdultEmails.has(normalizeEmail(email))) {
      throw new ApiError(400, "VALIDATION", "Invalid email", false, "EMAIL_INVALID");
    }
  }
  const idempotencyCache = new Map<string, CachedResponse>();
  const repo = options.projects;

  const routes: Route[] = [
    {
      name: "auth.register",
      method: "POST",
      pattern: /^\/v1\/auth\/register$/,
      handler: async () => ({ status: 404, body: null }),
    },
    {
      name: "auth.signIn",
      method: "POST",
      pattern: /^\/v1\/auth\/sign-in$/,
      handler: async () => ({ status: 404, body: null }),
    },
    {
      name: "auth.signOut",
      method: "POST",
      pattern: /^\/v1\/auth\/sign-out$/,
      handler: async () => ({ status: 404, body: null }),
    },
    {
      name: "session.get",
      method: "GET",
      pattern: /^\/v1\/session$/,
      handler: async (ctx) => ({
        status: 200,
        body: {
          contractVersion: PROJECT_API_CONTRACT_VERSION,
          account: { alias: ctx.alias },
          session: { expiresAt: ctx.sessionExpiresAt },
        },
      }),
    },
    {
      name: "account.delete",
      method: "DELETE",
      pattern: /^\/v1\/account$/,
      handler: async () => ({ status: 404, body: null }),
    },
    {
      name: "account.email.get",
      method: "GET",
      pattern: /^\/v1\/account\/email$/,
      handler: async (ctx) => ({ status: 200, body: await requireLink().emailStatus(ctx.ownerId) }),
    },
    {
      name: "account.projectCopyEligible",
      method: "GET",
      pattern: /^\/v1\/account\/project-copy-eligible$/,
      handler: async (ctx) => {
        if (!allowedAdultEmails || allowedAdultEmails.size !== 1)
          return { status: 404, body: null };
        const [allowedEmail] = allowedAdultEmails;
        if (!allowedEmail || !(await requireLink().hasVerifiedEmail(ctx.ownerId, allowedEmail))) {
          return { status: 404, body: null };
        }
        return { status: 200, body: { eligible: true } };
      },
    },
    {
      name: "account.email.set",
      method: "POST",
      pattern: /^\/v1\/account\/email$/,
      handler: async (ctx) => {
        const body = readBody(ctx.request, SMALL_BODY_BYTES, ["email"]);
        const email = requireString(body, "email");
        requireAllowedAdultEmail(email);
        await requireLink().addEmail(ctx.ownerId, email);
        return { status: 202, body: { status: "sent" } };
      },
    },
    {
      name: "account.email.resend",
      method: "POST",
      pattern: /^\/v1\/account\/email\/resend$/,
      handler: async (ctx) => {
        await requireLink().resendVerification(ctx.ownerId);
        return { status: 202, body: { status: "sent" } };
      },
    },
    {
      name: "account.email.verify",
      method: "POST",
      pattern: /^\/v1\/account\/email\/verify$/,
      handler: async () => ({ status: 404, body: null }),
    },
    {
      name: "link.codes.create",
      method: "POST",
      pattern: /^\/v1\/link\/codes$/,
      handler: async (ctx) => ({
        status: 201,
        body: await requireLink().createLinkCode(ctx.ownerId),
      }),
    },
    {
      name: "link.codes.revoke",
      method: "DELETE",
      pattern: /^\/v1\/link\/codes$/,
      handler: async (ctx) => {
        await requireLink().revokeLinkCodes(ctx.ownerId);
        return { status: 204, body: null };
      },
    },
    {
      name: "link.redeem",
      method: "POST",
      pattern: /^\/v1\/link\/redeem$/,
      handler: async () => ({ status: 404, body: null }),
    },
    {
      name: "link.devices.list",
      method: "GET",
      pattern: /^\/v1\/link\/devices$/,
      handler: async (ctx) => ({
        status: 200,
        body: { items: await requireLink().listDevices(ctx.ownerId) },
      }),
    },
    {
      name: "link.devices.update",
      method: "PATCH",
      pattern: /^\/v1\/link\/devices\/([^/]+)$/,
      handler: async (ctx) => {
        const body = readBody(ctx.request, SMALL_BODY_BYTES, ["syncEnabled"]);
        if (typeof body["syncEnabled"] !== "boolean") {
          throw new ApiError(400, "VALIDATION", "Invalid request", false, "INVALID_BODY");
        }
        await requireLink().setSyncEnabled(ctx.ownerId, linkIdParam(ctx), body["syncEnabled"]);
        return { status: 204, body: null };
      },
    },
    {
      name: "link.devices.delete",
      method: "DELETE",
      pattern: /^\/v1\/link\/devices\/([^/]+)$/,
      handler: async (ctx) => {
        await requireLink().unlinkLink(ctx.ownerId, linkIdParam(ctx));
        return { status: 204, body: null };
      },
    },
    {
      name: "link.summaries.list",
      method: "GET",
      pattern: /^\/v1\/link\/summaries$/,
      handler: async (ctx) => ({
        status: 200,
        body: { items: await requireLink().getSummaries(ctx.ownerId) },
      }),
    },
    {
      name: "link.summary.put",
      method: "PUT",
      pattern: /^\/v1\/link\/summary$/,
      handler: async () => ({ status: 404, body: null }),
    },
    {
      name: "link.self.delete",
      method: "DELETE",
      pattern: /^\/v1\/link\/self$/,
      handler: async () => ({ status: 404, body: null }),
    },
    {
      name: "group.organizer.enable",
      method: "POST",
      pattern: /^\/v1\/group\/organizer$/,
      handler: async (ctx) => {
        await requireGroup().grantOrganizer(ctx.ownerId);
        return { status: 204, body: null };
      },
    },
    {
      name: "group.create",
      method: "POST",
      pattern: /^\/v1\/group$/,
      handler: async (ctx) => {
        const body = readBody(ctx.request, SMALL_BODY_BYTES, ["authority"]);
        return {
          status: 201,
          body: await requireGroup().createGroup(ctx.ownerId, parseAuthority(body["authority"])),
        };
      },
    },
    {
      name: "group.get",
      method: "GET",
      pattern: /^\/v1\/group$/,
      handler: async (ctx) => {
        const view = await requireGroup().myGroup(ctx.ownerId);
        return { status: 200, body: view ?? { group: null, slots: [] } };
      },
    },
    {
      name: "group.update",
      method: "PATCH",
      pattern: /^\/v1\/group\/([^/]+)$/,
      handler: async (ctx) => {
        const body = readBody(ctx.request, SMALL_BODY_BYTES, ["locked"]);
        if (typeof body["locked"] !== "boolean") {
          throw new ApiError(400, "VALIDATION", "Invalid request", false, "INVALID_BODY");
        }
        await requireGroup().setLocked(ctx.ownerId, groupIdParam(ctx), body["locked"]);
        return { status: 204, body: null };
      },
    },
    {
      name: "group.close",
      method: "DELETE",
      pattern: /^\/v1\/group\/([^/]+)$/,
      handler: async (ctx) => {
        await requireGroup().closeGroup(ctx.ownerId, groupIdParam(ctx));
        return { status: 204, body: null };
      },
    },
    {
      name: "group.codes.create",
      method: "POST",
      pattern: /^\/v1\/group\/([^/]+)\/codes$/,
      handler: async (ctx) => ({
        status: 201,
        body: await requireGroup().issueJoinCode(ctx.ownerId, groupIdParam(ctx)),
      }),
    },
    {
      name: "group.slots.approve",
      method: "POST",
      pattern: /^\/v1\/group\/([^/]+)\/slots\/([^/]+)\/approve$/,
      handler: async (ctx) => {
        const body = readBody(ctx.request, SMALL_BODY_BYTES, ["consentAttested"]);
        if (typeof body["consentAttested"] !== "boolean") {
          throw new ApiError(400, "VALIDATION", "Invalid request", false, "INVALID_BODY");
        }
        return {
          status: 200,
          body: await requireGroup().approve(ctx.ownerId, groupIdParam(ctx), slotIdParam(ctx), {
            consentAttested: body["consentAttested"],
          }),
        };
      },
    },
    {
      name: "group.slots.reconnect",
      method: "POST",
      pattern: /^\/v1\/group\/([^/]+)\/slots\/([^/]+)\/reconnect$/,
      handler: async (ctx) => ({
        status: 201,
        body: await requireGroup().issueReconnectCode(
          ctx.ownerId,
          groupIdParam(ctx),
          slotIdParam(ctx),
        ),
      }),
    },
    {
      name: "group.slots.team",
      method: "PATCH",
      pattern: /^\/v1\/group\/([^/]+)\/slots\/([^/]+)$/,
      handler: async (ctx) => {
        const body = readBody(ctx.request, SMALL_BODY_BYTES, ["team"]);
        await requireGroup().assignTeam(
          ctx.ownerId,
          groupIdParam(ctx),
          slotIdParam(ctx),
          requireString(body, "team"),
        );
        return { status: 204, body: null };
      },
    },
    {
      name: "group.slots.remove",
      method: "DELETE",
      pattern: /^\/v1\/group\/([^/]+)\/slots\/([^/]+)$/,
      handler: async (ctx) => {
        await requireGroup().removeSlot(ctx.ownerId, groupIdParam(ctx), slotIdParam(ctx));
        return { status: 204, body: null };
      },
    },
    {
      name: "group.join",
      method: "POST",
      pattern: /^\/v1\/group\/join$/,
      handler: async () => ({ status: 404, body: null }),
    },
    {
      name: "group.device.get",
      method: "GET",
      pattern: /^\/v1\/group\/device$/,
      handler: async () => ({ status: 404, body: null }),
    },
    {
      name: "projects.list",
      method: "GET",
      pattern: /^\/v1\/projects$/,
      handler: async (ctx) => {
        const cursor = ctx.query.get("cursor") ?? undefined;
        const page = await repo.list(ctx.ownerId, cursor);
        return {
          status: 200,
          body: {
            items: page.items.map(toSummaryDto),
            ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
          },
        };
      },
    },
    {
      name: "projects.create",
      method: "POST",
      pattern: /^\/v1\/projects$/,
      handler: async (ctx) =>
        withIdempotency(ctx, async () => {
          const body = readBody(ctx.request, maxBodyBytes, ["title", "storedProject"]);
          const title = requireString(body, "title");
          const stored = requireStoredProject(body.storedProject, maxBodyBytes);
          const record = await repo.create(ctx.ownerId, title, stored);
          return { status: 201, body: toRecordDto(record) };
        }),
    },
    {
      name: "projects.get",
      method: "GET",
      pattern: /^\/v1\/projects\/([^/]+)$/,
      handler: async (ctx) => {
        const record = await repo.get(ctx.ownerId, projectIdParam(ctx));
        return { status: 200, body: toRecordDto(record) };
      },
    },
    {
      name: "projects.update",
      method: "PUT",
      pattern: /^\/v1\/projects\/([^/]+)$/,
      handler: async (ctx) => {
        const projectId = projectIdParam(ctx);
        const body = readBody(ctx.request, maxBodyBytes, [
          "expectedRevision",
          "storedProject",
          "title",
        ]);
        const expectedRevision = requireRevision(body.expectedRevision);
        const stored = requireStoredProject(body.storedProject, maxBodyBytes);
        const title = body.title === undefined ? undefined : requireString(body, "title");
        const current = await repo.get(ctx.ownerId, projectId);
        // Idempotent autosave: re-sending already-persisted canonical state (e.g. a retry after a
        // lost response) converges on the stored record instead of conflicting or bumping revision.
        if (
          current.semanticHash === semanticProjectHash(stored) &&
          (title === undefined || normalizeTitle(title) === current.title)
        ) {
          return { status: 200, body: { ...toRecordDto(current), unchanged: true } };
        }
        const record = await repo.update(ctx.ownerId, projectId, expectedRevision, {
          storedProject: stored,
          ...(title === undefined ? {} : { title }),
        });
        return { status: 200, body: { ...toRecordDto(record), unchanged: false } };
      },
    },
    {
      name: "projects.rename",
      method: "PATCH",
      pattern: /^\/v1\/projects\/([^/]+)$/,
      handler: async (ctx) => {
        const projectId = projectIdParam(ctx);
        const body = readBody(ctx.request, maxBodyBytes, ["expectedRevision", "title"]);
        const expectedRevision = requireRevision(body.expectedRevision);
        const title = requireString(body, "title");
        const current = await repo.get(ctx.ownerId, projectId);
        if (normalizeTitle(title) === current.title) {
          return { status: 200, body: { ...toRecordDto(current), unchanged: true } };
        }
        const record = await repo.update(ctx.ownerId, projectId, expectedRevision, { title });
        return { status: 200, body: { ...toRecordDto(record), unchanged: false } };
      },
    },
    {
      name: "projects.duplicate",
      method: "POST",
      pattern: /^\/v1\/projects\/([^/]+)\/duplicate$/,
      handler: async (ctx) =>
        withIdempotency(ctx, async () => {
          const projectId = projectIdParam(ctx);
          const body = readBody(ctx.request, maxBodyBytes, ["title"], true);
          const title = body.title === undefined ? undefined : requireString(body, "title");
          const record = await repo.duplicate(ctx.ownerId, projectId, title);
          return { status: 201, body: toRecordDto(record) };
        }),
    },
    {
      name: "projects.delete",
      method: "DELETE",
      pattern: /^\/v1\/projects\/([^/]+)$/,
      handler: async (ctx) => {
        const raw = ctx.query.get("expectedRevision");
        const expected = raw === null ? undefined : requireRevision(Number(raw));
        await repo.delete(ctx.ownerId, projectIdParam(ctx), expected);
        return { status: 204, body: null };
      },
    },
  ];

  function requireLink(): LinkApiService {
    if (options.link === undefined) throw new ApiError(404, "NOT_FOUND", "Not found");
    return options.link;
  }

  function requireGroup(): GroupApiService {
    if (options.group === undefined) throw new ApiError(404, "NOT_FOUND", "Not found");
    return options.group;
  }

  function groupIdParam(ctx: Context): string {
    const id = ctx.params[0] ?? "";
    if (!/^grp_[A-Za-z0-9_-]{1,64}$/.test(id)) throw new ApiError(404, "NOT_FOUND", "Not found");
    return id;
  }

  function slotIdParam(ctx: Context): string {
    const id = ctx.params[1] ?? "";
    if (!/^slt_[A-Za-z0-9_-]{1,64}$/.test(id)) throw new ApiError(404, "NOT_FOUND", "Not found");
    return id;
  }

  function linkIdParam(ctx: Context): string {
    const id = ctx.params[0] ?? "";
    if (!/^[0-9a-f]{32}$/.test(id)) throw new ApiError(404, "NOT_FOUND", "Not found");
    return id;
  }

  async function withIdempotency(
    ctx: Context,
    run: () => Promise<{ status: number; body: unknown }>,
  ): Promise<{ status: number; body: unknown }> {
    if (ctx.idempotency === undefined) {
      return run();
    }
    const cacheKey = `${ctx.ownerId}\n${ctx.request.method}\n${ctx.request.url}\n${ctx.idempotency}`;
    const fingerprint = sha256(ctx.request.body ?? "");
    const hit = idempotencyCache.get(cacheKey);
    if (hit !== undefined) {
      if (hit.fingerprint !== fingerprint) {
        throw new ApiError(
          422,
          "VALIDATION",
          "Idempotency key was already used with a different request",
          false,
          "IDEMPOTENCY_KEY_REUSED",
        );
      }
      return { status: hit.status, body: hit.body };
    }
    const result = await run();
    if (idempotencyCache.size >= MAX_IDEMPOTENCY_ENTRIES) {
      const oldest = idempotencyCache.keys().next();
      if (!oldest.done) {
        idempotencyCache.delete(oldest.value);
      }
    }
    idempotencyCache.set(cacheKey, { fingerprint, ...result });
    return result;
  }

  async function handle(request: ApiRequest): Promise<ApiResponse> {
    let routeName = "unmatched";
    let extraHeaders: Record<string, string> = {};
    let authedOwner: string | undefined;
    try {
      const url = new URL(request.url, "http://project-api.invalid");
      const method = request.method.toUpperCase();
      const candidates = routes.filter((r) => r.pattern.test(url.pathname));
      if (candidates.length === 0) {
        throw new ApiError(404, "NOT_FOUND", "Not found");
      }
      const route = candidates.find((r) => r.method === method);
      if (route === undefined) {
        throw new ApiError(404, "NOT_FOUND", "Not found");
      }
      routeName = route.name;

      if (method !== "GET") {
        assertCsrf(request, allowedOrigins);
      }

      if (url.pathname === "/v1/auth/register" && method === "POST") {
        const body = readBody(request, maxBodyBytes, ["username", "password", "email"]);
        // Validate the email before creating anything, so a bad address never leaves a half account.
        const wantsEmail = options.link !== undefined;
        let email: string | undefined;
        if (wantsEmail && body["email"] !== undefined) {
          email = requireString(body, "email");
          normalizeEmail(email);
          requireAllowedAdultEmail(email);
        } else if (wantsEmail && options.requireEmail !== false) {
          throw new ApiError(400, "VALIDATION", "Email is required", false, "EMAIL_REQUIRED");
        }
        const registered = await options.auth.register({
          username: requireString(body, "username"),
          password: requireString(body, "password"),
        });
        if (email !== undefined && options.link !== undefined) {
          try {
            await options.link.addEmail(registered.account.accountId, email);
          } catch {
            // The account exists; the adult can add the email after signing in.
          }
        }
        options.log?.({ route: routeName, status: 201 });
        return respond(
          201,
          { account: { alias: registered.account.alias.original } },
          extraHeaders,
        );
      }

      if (url.pathname === "/v1/auth/sign-in" && method === "POST") {
        const body = readBody(request, maxBodyBytes, ["username", "password"]);
        const signed = await options.auth.signIn({
          username: requireString(body, "username"),
          password: requireString(body, "password"),
        });
        extraHeaders = {
          "set-cookie": sessionCookie(
            signed.sessionToken,
            signed.session.expiresAt,
            options.secureCookies === true,
          ),
        };
        options.log?.({ route: routeName, status: 200 });
        return respond(
          200,
          {
            contractVersion: PROJECT_API_CONTRACT_VERSION,
            account: { alias: signed.account.alias.original },
            session: { expiresAt: signed.session.expiresAt },
          },
          extraHeaders,
        );
      }

      if (url.pathname === "/v1/account/email/verify" && method === "POST") {
        const body = readBody(request, SMALL_BODY_BYTES, ["token"]);
        await requireLink().verifyEmail(requireString(body, "token"));
        options.log?.({ route: routeName, status: 204 });
        return respond(204, null, extraHeaders);
      }

      if (url.pathname === "/v1/link/redeem" && method === "POST") {
        const body = readBody(request, SMALL_BODY_BYTES, ["code"]);
        const redeemed = await requireLink().redeemLinkCode(
          requireString(body, "code"),
          sourceKeyFor(request),
        );
        options.log?.({ route: routeName, status: 201 });
        return respond(
          201,
          { deviceToken: redeemed.deviceToken, expiresAt: redeemed.expiresAt },
          extraHeaders,
        );
      }

      if (url.pathname === "/v1/group/join" && method === "POST") {
        const body = readBody(request, SMALL_BODY_BYTES, ["code"]);
        const joined = await requireGroup().redeemJoinCode(
          requireString(body, "code"),
          sourceKeyFor(request),
        );
        options.log?.({ route: routeName, status: 201 });
        return respond(201, { deviceToken: joined.deviceToken }, extraHeaders);
      }

      if (url.pathname === "/v1/group/device" && method === "GET") {
        const token = readBearer(request);
        if (token === undefined)
          throw new ApiError(401, "UNAUTHENTICATED", "Authentication required");
        try {
          const view = await requireGroup().deviceView(token);
          options.log?.({ route: routeName, status: 200 });
          return respond(200, view, extraHeaders);
        } catch (error) {
          if (error instanceof GroupError && error.code === "INVALID_OR_EXPIRED") {
            throw new ApiError(401, "UNAUTHENTICATED", "Authentication required");
          }
          throw error;
        }
      }

      if (url.pathname === "/v1/link/summary" && method === "PUT") {
        const device = await resolveDeviceOrFail(requireLink(), request);
        const body = readBody(request, SMALL_BODY_BYTES, [
          "version",
          "completedMissions",
          "practicedConcepts",
          "decisions",
          "minutesByDay",
          "ageBand",
          "dailyLimitMinutes",
        ]);
        const stored = await requireLink().putSummary(device.linkId, body);
        options.log?.({ route: routeName, status: 200 });
        return respond(200, { deviceToken: device.deviceToken, stored }, extraHeaders);
      }

      if (url.pathname === "/v1/link/self" && method === "DELETE") {
        const token = readBearer(request);
        if (token === undefined)
          throw new ApiError(401, "UNAUTHENTICATED", "Authentication required");
        try {
          await requireLink().unlinkDevice(token);
        } catch (error) {
          if (error instanceof LinkError && error.code === "INVALID_OR_EXPIRED") {
            throw new ApiError(401, "UNAUTHENTICATED", "Authentication required");
          }
          throw error;
        }
        options.log?.({ route: routeName, status: 204 });
        return respond(204, null, extraHeaders);
      }

      const token = readSessionCookie(request.headers["cookie"]);
      if (token === undefined) {
        throw new ApiError(401, "UNAUTHENTICATED", "Authentication required");
      }
      const resolved = await resolveSession(options.auth, token);
      if (resolved.rotated) {
        extraHeaders = {
          "set-cookie": sessionCookie(
            resolved.sessionToken,
            resolved.session.expiresAt,
            options.secureCookies === true,
          ),
        };
      }

      authedOwner = resolved.account.accountId;
      const match = route.pattern.exec(url.pathname);
      if (url.pathname === "/v1/auth/sign-out" && method === "POST") {
        await options.auth.signOut(resolved.sessionToken);
        options.log?.({ route: routeName, status: 204 });
        return respond(204, null, {
          "set-cookie": sessionCookie(
            "",
            new Date(0).toISOString(),
            options.secureCookies === true,
          ),
        });
      }
      if (url.pathname === "/v1/account" && method === "DELETE") {
        const body = readBody(request, SMALL_BODY_BYTES, ["password"]);
        const ownerId = resolved.account.accountId;
        try {
          const password = requireString(body, "password");
          if (options.deleteAccount) {
            await options.deleteAccount(ownerId, password);
          } else {
            await options.auth.deleteAccount(ownerId, password, async () => {
              await options.link?.deleteAccountData(ownerId);
              await repo.deleteByOwner(ownerId);
            });
          }
        } catch (error) {
          if (error instanceof AuthPublicError && error.code === "INVALID_CREDENTIALS") {
            throw new ApiError(400, "VALIDATION", "Wrong password", false, "WRONG_PASSWORD");
          }
          throw error;
        }
        options.log?.({ route: routeName, status: 204 });
        return respond(204, null, {
          "set-cookie": sessionCookie(
            "",
            new Date(0).toISOString(),
            options.secureCookies === true,
          ),
        });
      }
      const idemRaw = request.headers[IDEMPOTENCY_HEADER_NAME];
      if (idemRaw !== undefined && !IDEMPOTENCY_KEY_PATTERN.test(idemRaw)) {
        throw new ApiError(
          400,
          "VALIDATION",
          "Invalid idempotency key",
          false,
          "INVALID_IDEMPOTENCY_KEY",
        );
      }
      const result = await route.handler({
        // Owner is derived from the server-resolved session, never from the request.
        ownerId: resolved.account.accountId,
        alias: resolved.account.alias.original,
        sessionExpiresAt: resolved.session.expiresAt,
        request,
        params: (match ?? []).slice(1).map(safeDecode),
        query: url.searchParams,
        ...(idemRaw === undefined ? {} : { idempotency: idemRaw }),
      });
      options.log?.({ route: routeName, status: result.status });
      return respond(result.status, result.body, extraHeaders);
    } catch (error) {
      const apiError = await toApiError(error, repo, authedOwner, routeName);
      options.log?.({ route: routeName, status: apiError.status, errorCode: apiError.code });
      return respond(apiError.status, errorBody(apiError), extraHeaders);
    }
  }

  return { handle };
}

export function sessionCookie(token: string, expiresAt: string, secure: boolean): string {
  const maxAge = Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000));
  return [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAge}`,
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

function respond(
  status: number,
  body: unknown,
  extra: Readonly<Record<string, string>>,
): ApiResponse {
  return {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
      ...extra,
    },
    body,
  };
}

function errorBody(error: ApiError): ProjectApiErrorBody {
  return {
    error: {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      ...(error.reason === undefined ? {} : { reason: error.reason }),
      ...(error.recovery === undefined ? {} : { recovery: error.recovery }),
    },
  };
}

function assertCsrf(request: ApiRequest, allowedOrigins: ReadonlySet<string>): void {
  const origin = request.headers["origin"];
  const marker = request.headers[CSRF_HEADER_NAME];
  if (marker !== "1" || (origin !== undefined && !allowedOrigins.has(origin))) {
    throw new ApiError(403, "CSRF_REJECTED", "Request rejected");
  }
}

function readBearer(request: ApiRequest): string | undefined {
  const header = request.headers["authorization"];
  if (header === undefined) return undefined;
  const space = header.indexOf(" ");
  if (space < 0 || header.slice(0, space).toLowerCase() !== DEVICE_AUTH_SCHEME.toLowerCase()) {
    return undefined;
  }
  const value = header.slice(space + 1).trim();
  return value === "" || value.length > 256 ? undefined : value;
}

async function resolveDeviceOrFail(link: LinkApiService, request: ApiRequest) {
  const token = readBearer(request);
  if (token === undefined) throw new ApiError(401, "UNAUTHENTICATED", "Authentication required");
  try {
    return await link.resolveDevice(token);
  } catch (error) {
    if (error instanceof LinkError && error.code === "INVALID_OR_EXPIRED") {
      throw new ApiError(401, "UNAUTHENTICATED", "Authentication required");
    }
    throw error;
  }
}

function parseAuthority(value: unknown): {
  authority: { kind: "household" } | { kind: "classroom"; authorizationRef: string };
} {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ApiError(400, "VALIDATION", "Invalid request", false, "INVALID_BODY");
  }
  const input = value as Record<string, unknown>;
  if (input["kind"] === "household" && Object.keys(input).length === 1) {
    return { authority: { kind: "household" } };
  }
  if (
    input["kind"] === "classroom" &&
    typeof input["authorizationRef"] === "string" &&
    Object.keys(input).length === 2
  ) {
    return { authority: { kind: "classroom", authorizationRef: input["authorizationRef"] } };
  }
  throw new ApiError(400, "VALIDATION", "Invalid request", false, "INVALID_BODY");
}

/** Opaque, hashed caller identity for rate limits. The address itself is never kept. */
function sourceKeyFor(request: ApiRequest): string {
  const address = request.headers[CLIENT_ADDRESS_HEADER]?.trim().slice(0, 64) || "unknown";
  return sha256(`link-source:${address}`);
}

function readSessionCookie(header: string | undefined): string | undefined {
  if (header === undefined) {
    return undefined;
  }
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index > 0 && part.slice(0, index).trim() === SESSION_COOKIE_NAME) {
      const value = part.slice(index + 1).trim();
      return value === "" ? undefined : value;
    }
  }
  return undefined;
}

async function resolveSession(auth: ProjectApiOptions["auth"], token: string) {
  try {
    return await auth.resolveSession(token);
  } catch (error) {
    if (error instanceof AuthPublicError && error.code === "SESSION_EXPIRED") {
      throw new ApiError(401, "SESSION_EXPIRED", "Session expired; sign in again");
    }
    throw new ApiError(503, "TRANSIENT", "Temporarily unavailable", true);
  }
}

async function toApiError(
  error: unknown,
  repo: ProjectRepository,
  ownerId: string | undefined,
  routeName: string,
): Promise<ApiError> {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof AuthPublicError) {
    switch (error.code) {
      case "INVALID_CREDENTIALS":
        return new ApiError(401, "UNAUTHENTICATED", "Invalid username or password");
      case "SESSION_EXPIRED":
        return new ApiError(401, "SESSION_EXPIRED", "Session expired; sign in again");
      case "RATE_LIMITED":
        return new ApiError(429, "RATE_LIMITED", "Too many attempts", true);
      case "PASSWORD_POLICY_VIOLATION":
      case "USERNAME_TAKEN":
        return new ApiError(400, "VALIDATION", error.message, false, error.code);
      default:
        return new ApiError(503, "TRANSIENT", "Temporarily unavailable", true);
    }
  }
  if (error instanceof LinkError) {
    switch (error.code) {
      case "INVALID_EMAIL":
        return new ApiError(400, "VALIDATION", "Invalid email", false, "INVALID_EMAIL");
      case "EMAIL_NOT_VERIFIED":
        return new ApiError(
          403,
          "VALIDATION",
          "Verify your email first",
          false,
          "EMAIL_NOT_VERIFIED",
        );
      case "INVALID_OR_EXPIRED":
        return new ApiError(400, "VALIDATION", "Invalid or expired", false, "INVALID_OR_EXPIRED");
      case "INVALID_SUMMARY":
        return new ApiError(400, "VALIDATION", "Invalid summary", false, "INVALID_SUMMARY");
      case "RATE_LIMITED":
        return new ApiError(429, "RATE_LIMITED", "Too many attempts", true);
      case "NOT_FOUND":
        return notFound();
    }
  }
  if (error instanceof GroupError) {
    switch (error.code) {
      case "NOT_ORGANIZER":
        return new ApiError(403, "VALIDATION", "Not allowed", false, "NOT_ORGANIZER");
      case "ALREADY_HAS_GROUP":
      case "GROUP_FULL":
      case "GROUP_LOCKED":
        return new ApiError(409, "VALIDATION", "Not available", false, error.code);
      case "AUTHORITY_REQUIRED":
      case "CONSENT_REQUIRED":
      case "INVALID_INPUT":
      case "INVALID_OR_EXPIRED":
        return new ApiError(400, "VALIDATION", "Invalid request", false, error.code);
      case "RATE_LIMITED":
        return new ApiError(429, "RATE_LIMITED", "Too many attempts", true);
      case "NOT_FOUND":
        return new ApiError(404, "NOT_FOUND", "Not found");
    }
  }
  if (error instanceof PlatformContractError && routeName.startsWith("auth.")) {
    return new ApiError(400, "VALIDATION", "Invalid account alias", false, "INVALID_ALIAS");
  }
  if (error instanceof ProjectRepositoryError) {
    switch (error.code) {
      case "NOT_FOUND":
        return notFound();
      case "CONFLICT":
        return conflictError(error, repo, ownerId);
      case "INVALID_PROJECT":
        // Includes malformed project ids: indistinguishable from not-found by design.
        return error.projectId === undefined ? validation("INVALID_PROJECT") : notFound();
      case "PAYLOAD_TOO_LARGE":
        return new ApiError(413, "VALIDATION", "Project is too large", false, "PAYLOAD_TOO_LARGE");
      case "INVALID_CURSOR":
      case "INVALID_REVISION":
      case "INVALID_STORED_PROJECT":
      case "INVALID_TITLE":
        return validation(error.code);
      default:
        return new ApiError(503, "TRANSIENT", "Temporarily unavailable", true);
    }
  }
  return new ApiError(503, "TRANSIENT", "Temporarily unavailable", true);
}

async function conflictError(
  error: ProjectRepositoryError,
  repo: ProjectRepository,
  ownerId: string | undefined,
): Promise<ApiError> {
  const projectId = error.projectId;
  if (projectId === undefined || ownerId === undefined) {
    return new ApiError(409, "REVISION_CONFLICT", "Project changed since your last load");
  }
  try {
    const current = await repo.get(ownerId, projectId);
    return new ApiError(
      409,
      "REVISION_CONFLICT",
      "Project changed since your last load",
      false,
      undefined,
      {
        currentRevision: current.revision,
        currentUpdatedAt: current.updatedAt,
        currentSemanticHash: current.semanticHash,
      },
    );
  } catch {
    return new ApiError(409, "REVISION_CONFLICT", "Project changed since your last load");
  }
}

function notFound(): ApiError {
  return new ApiError(404, "NOT_FOUND", "Project not found");
}

function validation(reason: string): ApiError {
  return new ApiError(400, "VALIDATION", "Request validation failed", false, reason);
}

function projectIdParam(ctx: Context): string {
  const id = ctx.params[0];
  if (id === undefined || !PROJECT_ID_PATTERN.test(id)) {
    throw notFound();
  }
  return id;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

function readBody(
  request: ApiRequest,
  maxBodyBytes: number,
  allowedKeys: readonly string[],
  optional = false,
): Record<string, unknown> {
  const raw = request.body;
  if (raw === undefined || raw === "") {
    if (optional) {
      return {};
    }
    throw validation("BODY_REQUIRED");
  }
  const contentType = request.headers["content-type"] ?? "";
  if (!/^application\/json(\s*;|$)/i.test(contentType)) {
    throw new ApiError(
      415,
      "VALIDATION",
      "Content-Type must be application/json",
      false,
      "CONTENT_TYPE",
    );
  }
  if (Buffer.byteLength(raw, "utf8") > maxBodyBytes) {
    throw new ApiError(413, "VALIDATION", "Request body is too large", false, "PAYLOAD_TOO_LARGE");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw validation("INVALID_JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw validation("BODY_NOT_OBJECT");
  }
  const body = parsed as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (HISTORY_KEY_PATTERN.test(key)) {
      throw validation("HISTORY_NOT_PERSISTED");
    }
    if (!allowedKeys.includes(key)) {
      // Notably rejects any client-supplied owner id (`ownerId`, `accountId`, ...).
      throw validation("UNKNOWN_FIELD");
    }
  }
  return body;
}

function requireString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string") {
    throw validation(`${key.toUpperCase()}_REQUIRED`);
  }
  return value;
}

function requireRevision(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw validation("INVALID_REVISION");
  }
  return value;
}

const STORED_PROJECT_KEYS = ["schemaVersion", "program", "metadata"];
const METADATA_KEYS = [
  "createdAt",
  "updatedAt",
  "missionProgress",
  "hintLevel",
  "locale",
  "actors",
  "stage",
  "assets",
  "missionSpec",
  "advancedProgress",
];

function requireStoredProject(value: unknown, maxBodyBytes: number): StoredProject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw validation("STORED_PROJECT_REQUIRED");
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (HISTORY_KEY_PATTERN.test(key)) {
      throw validation("HISTORY_NOT_PERSISTED");
    }
    if (!STORED_PROJECT_KEYS.includes(key)) {
      throw validation("UNKNOWN_FIELD");
    }
  }
  const metadata = record["metadata"];
  if (typeof metadata === "object" && metadata !== null) {
    for (const key of Object.keys(metadata)) {
      if (HISTORY_KEY_PATTERN.test(key)) {
        throw validation("HISTORY_NOT_PERSISTED");
      }
      if (!METADATA_KEYS.includes(key)) {
        throw validation("UNKNOWN_FIELD");
      }
    }
  }
  try {
    return validateStoredProject(record as unknown as StoredProject, maxBodyBytes);
  } catch (error) {
    if (error instanceof ProjectRepositoryError && error.code === "PAYLOAD_TOO_LARGE") {
      throw new ApiError(413, "VALIDATION", "Project is too large", false, "PAYLOAD_TOO_LARGE");
    }
    throw validation("INVALID_STORED_PROJECT");
  }
}

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function toSummaryDto(record: ProjectSummary) {
  return {
    projectId: record.projectId,
    title: record.title,
    revision: record.revision,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    semanticHash: record.semanticHash,
  };
}

function toRecordDto(record: ProjectRecord) {
  return { ...toSummaryDto(record), storedProject: record.storedProject };
}
