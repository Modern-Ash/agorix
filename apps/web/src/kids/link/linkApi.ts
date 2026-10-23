import { DEFAULT_ACCOUNT_PATH, type FetchLike } from "../../accounts/httpClient.js";

/** What the adult sees about each linked device. No address, no agent, no fingerprint. */
export interface LinkedDevice {
  readonly linkId: string;
  readonly createdAt: string;
  readonly lastSeenDay: string;
  readonly syncEnabled: boolean;
  readonly unlinkedAt?: string;
  readonly summaryDeletesAt?: string;
}

export interface DeviceSummary {
  readonly version: 1;
  readonly completedMissions: number;
  readonly practicedConcepts: readonly [number, number, number];
  readonly decisions: {
    readonly used: number;
    readonly changed: number;
    readonly rejected: number;
  };
  readonly minutesByDay: readonly { readonly day: string; readonly minutes: number }[];
  readonly ageBand: "6-8" | "9-12" | "13+";
  readonly dailyLimitMinutes: number;
}

export interface DeviceSummaryView {
  readonly linkId: string;
  readonly updatedAt: string;
  readonly summary: DeviceSummary;
}

export interface CreatedCode {
  readonly code: string;
  readonly expiresAt: string;
}

export type LinkApiErrorKind =
  | "unavailable"
  | "offline"
  | "unauthenticated"
  | "email-not-verified"
  | "invalid-email"
  | "invalid-code"
  | "rate-limited"
  | "not-found"
  | "invalid-credentials"
  | "username-taken"
  | "weak-password"
  | "invalid-summary"
  | "transient";

/** Fixed message: server and user content are never echoed. */
export class LinkApiError extends Error {
  constructor(readonly kind: LinkApiErrorKind) {
    super(`link api error: ${kind}`);
    this.name = "LinkApiError";
  }
}

export function isLinkApiError(error: unknown, kind?: LinkApiErrorKind): error is LinkApiError {
  return error instanceof LinkApiError && (kind === undefined || error.kind === kind);
}

export interface LinkApi {
  /** Is the optional link service deployed here? Never throws. */
  available(): Promise<boolean>;

  // Adult (session cookie)
  signIn(alias: string, password: string): Promise<{ alias: string }>;
  /** Register, sign in and attach the email in one go; the caller then waits for verification. */
  register(alias: string, password: string, email: string): Promise<{ alias: string }>;
  restore(): Promise<{ alias: string } | null>;
  signOut(): Promise<void>;
  emailStatus(): Promise<{ present: boolean; verified: boolean }>;
  setEmail(email: string): Promise<void>;
  resendEmail(): Promise<void>;
  verifyEmail(token: string): Promise<void>;
  createCode(): Promise<CreatedCode>;
  revokeCodes(): Promise<void>;
  listDevices(): Promise<readonly LinkedDevice[]>;
  setSync(linkId: string, enabled: boolean): Promise<void>;
  unlink(linkId: string): Promise<void>;
  summaries(): Promise<readonly DeviceSummaryView[]>;

  // Child device (bearer token, no cookie)
  redeem(code: string): Promise<{ deviceToken: string; expiresAt: string }>;
  putSummary(
    token: string,
    summary: DeviceSummary,
  ): Promise<{ deviceToken: string; stored: boolean }>;
  unlinkSelf(token: string): Promise<void>;
}

interface Parsed {
  readonly status: number;
  readonly json: unknown;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

export function createLinkApi(options: { readonly fetch?: FetchLike } = {}): LinkApi {
  const doFetch: FetchLike =
    options.fetch ?? ((input, init) => globalThis.fetch(input, init) as ReturnType<FetchLike>);
  // The adult session rotates on every request, so adult calls must never overlap.
  let adultTail: Promise<unknown> = Promise.resolve();

  async function raw(
    method: string,
    url: string,
    body: unknown,
    headers: Record<string, string>,
  ): Promise<Parsed> {
    const all: Record<string, string> = { accept: "application/json", ...headers };
    if (method !== "GET") all["x-agorix-request"] = "1";
    if (body !== undefined) all["content-type"] = "application/json";
    let response;
    try {
      response = await doFetch(url, {
        method,
        headers: all,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        credentials: "same-origin",
      });
    } catch {
      throw new LinkApiError("offline");
    }
    const text = await response.text().catch(() => "");
    let json: unknown;
    if (text !== "") {
      try {
        json = JSON.parse(text);
      } catch {
        json = undefined;
      }
    }
    if (response.status >= 400) throw toError(response.status, json);
    return { status: response.status, json };
  }

  function adult(method: string, url: string, body?: unknown): Promise<Parsed> {
    const run = () => raw(method, url, body, {});
    const next = adultTail.then(run, run);
    adultTail = next.catch(() => undefined);
    return next;
  }

  const signInRequest = async (alias: string, password: string): Promise<{ alias: string }> => {
    try {
      await adult("POST", `${DEFAULT_ACCOUNT_PATH}/sign-in`, { username: alias, password });
    } catch (error) {
      if (isLinkApiError(error, "unauthenticated")) throw new LinkApiError("invalid-credentials");
      throw error;
    }
    const { json } = await adult("GET", "/v1/session");
    return toAlias(json);
  };

  return {
    async available() {
      try {
        await raw("GET", "/v1/account/email", undefined, {});
        return true;
      } catch (error) {
        // 401 means the route exists and wants a session; 404/unavailable means no link service.
        return isLinkApiError(error, "unauthenticated");
      }
    },

    signIn: signInRequest,

    async register(alias, password, email) {
      await adult("POST", `${DEFAULT_ACCOUNT_PATH}/register`, { username: alias, password });
      const account = await signInRequest(alias, password);
      await adult("POST", "/v1/account/email", { email });
      return account;
    },

    async restore() {
      try {
        const { json } = await adult("GET", "/v1/session");
        return toAlias(json);
      } catch (error) {
        if (isLinkApiError(error, "unauthenticated")) return null;
        throw error;
      }
    },

    async signOut() {
      await adult("POST", `${DEFAULT_ACCOUNT_PATH}/sign-out`, {});
    },

    async emailStatus() {
      const { json } = await adult("GET", "/v1/account/email");
      const body = record(json);
      return { present: body["present"] === true, verified: body["verified"] === true };
    },

    async setEmail(email) {
      await adult("POST", "/v1/account/email", { email });
    },

    async resendEmail() {
      await adult("POST", "/v1/account/email/resend", {});
    },

    async verifyEmail(token) {
      // Public route: no session needed, so it is not queued behind adult calls.
      await raw("POST", "/v1/account/email/verify", { token }, {});
    },

    async createCode() {
      const { json } = await adult("POST", "/v1/link/codes", {});
      const body = record(json);
      if (typeof body["code"] !== "string" || typeof body["expiresAt"] !== "string") {
        throw new LinkApiError("unavailable");
      }
      return { code: body["code"], expiresAt: body["expiresAt"] };
    },

    async revokeCodes() {
      await adult("DELETE", "/v1/link/codes");
    },

    async listDevices() {
      const { json } = await adult("GET", "/v1/link/devices");
      const items = record(json)["items"];
      return Array.isArray(items) ? items.map(toDevice) : [];
    },

    async setSync(linkId, enabled) {
      await adult("PATCH", `/v1/link/devices/${encodeURIComponent(linkId)}`, {
        syncEnabled: enabled,
      });
    },

    async unlink(linkId) {
      await adult("DELETE", `/v1/link/devices/${encodeURIComponent(linkId)}`);
    },

    async summaries() {
      const { json } = await adult("GET", "/v1/link/summaries");
      const items = record(json)["items"];
      return Array.isArray(items) ? items.map(toSummaryView) : [];
    },

    async redeem(code) {
      const { json } = await raw("POST", "/v1/link/redeem", { code }, {});
      const body = record(json);
      if (typeof body["deviceToken"] !== "string") throw new LinkApiError("unavailable");
      return { deviceToken: body["deviceToken"], expiresAt: String(body["expiresAt"] ?? "") };
    },

    async putSummary(token, summary) {
      const { json } = await raw("PUT", "/v1/link/summary", summary, {
        authorization: `Bearer ${token}`,
      });
      const body = record(json);
      if (typeof body["deviceToken"] !== "string") throw new LinkApiError("unavailable");
      return { deviceToken: body["deviceToken"], stored: body["stored"] === true };
    },

    async unlinkSelf(token) {
      await raw("DELETE", "/v1/link/self", undefined, { authorization: `Bearer ${token}` });
    },
  };
}

function toError(status: number, json: unknown): LinkApiError {
  const error = record(record(json)["error"]);
  const code = error["code"];
  const reason = typeof error["reason"] === "string" ? error["reason"] : undefined;
  switch (code) {
    case "UNAUTHENTICATED":
    case "SESSION_EXPIRED":
      return new LinkApiError("unauthenticated");
    case "NOT_FOUND":
      return new LinkApiError("not-found");
    case "RATE_LIMITED":
      return new LinkApiError("rate-limited");
    case "TRANSIENT":
      return new LinkApiError("transient");
    case "VALIDATION":
      switch (reason) {
        case "INVALID_EMAIL":
          return new LinkApiError("invalid-email");
        case "EMAIL_NOT_VERIFIED":
          return new LinkApiError("email-not-verified");
        case "INVALID_OR_EXPIRED":
          return new LinkApiError("invalid-code");
        case "INVALID_SUMMARY":
          return new LinkApiError("invalid-summary");
        case "USERNAME_TAKEN":
          return new LinkApiError("username-taken");
        case "PASSWORD_POLICY_VIOLATION":
          return new LinkApiError("weak-password");
        default:
          return new LinkApiError("unavailable");
      }
    default:
      // A static host or proxy page: the service is not there.
      return new LinkApiError(status >= 500 ? "transient" : "unavailable");
  }
}

function toAlias(json: unknown): { alias: string } {
  const account = record(record(json)["account"]);
  if (typeof account["alias"] !== "string") throw new LinkApiError("unavailable");
  return { alias: account["alias"] };
}

function toDevice(value: unknown): LinkedDevice {
  const v = record(value);
  if (typeof v["linkId"] !== "string") throw new LinkApiError("unavailable");
  return {
    linkId: v["linkId"],
    createdAt: String(v["createdAt"] ?? ""),
    lastSeenDay: String(v["lastSeenDay"] ?? ""),
    syncEnabled: v["syncEnabled"] === true,
    ...(typeof v["unlinkedAt"] === "string" ? { unlinkedAt: v["unlinkedAt"] } : {}),
    ...(typeof v["summaryDeletesAt"] === "string"
      ? { summaryDeletesAt: v["summaryDeletesAt"] }
      : {}),
  };
}

function toSummaryView(value: unknown): DeviceSummaryView {
  const v = record(value);
  if (
    typeof v["linkId"] !== "string" ||
    typeof v["summary"] !== "object" ||
    v["summary"] === null
  ) {
    throw new LinkApiError("unavailable");
  }
  return {
    linkId: v["linkId"],
    updatedAt: String(v["updatedAt"] ?? ""),
    summary: v["summary"] as DeviceSummary,
  };
}
