import type { FetchLike } from "../../accounts/httpClient.js";

export const GROUP_TEAMS = ["equipo-1", "equipo-2", "equipo-3", "equipo-4"] as const;
export type GroupTeam = (typeof GROUP_TEAMS)[number];

export type GroupAuthorityInput =
  | { readonly kind: "household" }
  | { readonly kind: "classroom"; readonly authorizationRef: string };

export interface GroupSummary {
  readonly groupId: string;
  readonly expiresAt: string;
  readonly locked: boolean;
  readonly authorityKind: "household" | "classroom";
}

/** The organizer sees an alias and a state per child. No text from a child exists. */
export interface GroupSlot {
  readonly slotId: string;
  readonly alias: string;
  readonly status: "pending" | "approved";
  readonly team?: GroupTeam;
  readonly reconnects: number;
}

export interface OrganizerView {
  readonly group: GroupSummary | null;
  readonly slots: readonly GroupSlot[];
}

export interface DeviceGroupView {
  readonly status: "pending" | "approved";
  readonly alias: string;
  readonly team?: GroupTeam;
  readonly expiresAt: string;
}

export interface GroupCode {
  readonly code: string;
  readonly expiresAt: string;
}

export type GroupApiErrorKind =
  | "unavailable"
  | "offline"
  | "unauthenticated"
  | "not-organizer"
  | "already-has-group"
  | "authority-required"
  | "consent-required"
  | "invalid-code"
  | "rate-limited"
  | "group-full"
  | "group-locked"
  | "not-found"
  | "invalid-input"
  | "transient";

/** Fixed message: server and user content are never echoed. */
export class GroupApiError extends Error {
  constructor(readonly kind: GroupApiErrorKind) {
    super(`group api error: ${kind}`);
    this.name = "GroupApiError";
  }
}

export function isGroupApiError(error: unknown, kind?: GroupApiErrorKind): error is GroupApiError {
  return error instanceof GroupApiError && (kind === undefined || error.kind === kind);
}

export interface GroupApi {
  /** Is the optional group service deployed here? Never throws. */
  available(): Promise<boolean>;

  // Organizer (adult session cookie)
  enableOrganizer(): Promise<void>;
  current(): Promise<OrganizerView>;
  create(authority: GroupAuthorityInput): Promise<GroupSummary>;
  setLocked(groupId: string, locked: boolean): Promise<void>;
  close(groupId: string): Promise<void>;
  createCode(groupId: string): Promise<GroupCode>;
  approve(groupId: string, slotId: string, consentAttested: boolean): Promise<void>;
  assignTeam(groupId: string, slotId: string, team: GroupTeam): Promise<void>;
  remove(groupId: string, slotId: string): Promise<void>;
  reconnectCode(groupId: string, slotId: string): Promise<GroupCode>;

  // Child device (bearer key, no cookie)
  join(code: string): Promise<{ deviceToken: string }>;
  deviceView(token: string): Promise<DeviceGroupView>;
}

interface Parsed {
  readonly status: number;
  readonly json: unknown;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

export function createGroupApi(options: { readonly fetch?: FetchLike } = {}): GroupApi {
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
      throw new GroupApiError("offline");
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

  const group = (groupId: string) => `/v1/group/${encodeURIComponent(groupId)}`;
  const slot = (groupId: string, slotId: string) =>
    `${group(groupId)}/slots/${encodeURIComponent(slotId)}`;

  return {
    async available() {
      try {
        await raw("GET", "/v1/group", undefined, {});
        return true;
      } catch (error) {
        // 401 and 403 mean the route exists; 404 or unavailable means the service is not there.
        return isGroupApiError(error, "unauthenticated") || isGroupApiError(error, "not-organizer");
      }
    },

    async enableOrganizer() {
      await adult("POST", "/v1/group/organizer", {});
    },

    async current() {
      const { json } = await adult("GET", "/v1/group");
      const body = record(json);
      const slots = Array.isArray(body["slots"]) ? body["slots"].map(toSlot) : [];
      return {
        group:
          body["group"] === null || body["group"] === undefined ? null : toGroup(body["group"]),
        slots,
      };
    },

    async create(authority) {
      const { json } = await adult("POST", "/v1/group", { authority });
      return toGroup(json);
    },

    async setLocked(groupId, locked) {
      await adult("PATCH", group(groupId), { locked });
    },

    async close(groupId) {
      await adult("DELETE", group(groupId));
    },

    async createCode(groupId) {
      const { json } = await adult("POST", `${group(groupId)}/codes`, {});
      return toCode(json);
    },

    async approve(groupId, slotId, consentAttested) {
      await adult("POST", `${slot(groupId, slotId)}/approve`, { consentAttested });
    },

    async assignTeam(groupId, slotId, team) {
      await adult("PATCH", slot(groupId, slotId), { team });
    },

    async remove(groupId, slotId) {
      await adult("DELETE", slot(groupId, slotId));
    },

    async reconnectCode(groupId, slotId) {
      const { json } = await adult("POST", `${slot(groupId, slotId)}/reconnect`, {});
      return toCode(json);
    },

    async join(code) {
      const { json } = await raw("POST", "/v1/group/join", { code }, {});
      const body = record(json);
      if (typeof body["deviceToken"] !== "string") throw new GroupApiError("unavailable");
      return { deviceToken: body["deviceToken"] };
    },

    async deviceView(token) {
      const { json } = await raw("GET", "/v1/group/device", undefined, {
        authorization: `Bearer ${token}`,
      });
      const body = record(json);
      if (typeof body["alias"] !== "string") throw new GroupApiError("unavailable");
      return {
        status: body["status"] === "approved" ? "approved" : "pending",
        alias: body["alias"],
        ...(isTeam(body["team"]) ? { team: body["team"] } : {}),
        expiresAt: String(body["expiresAt"] ?? ""),
      };
    },
  };
}

function isTeam(value: unknown): value is GroupTeam {
  return (GROUP_TEAMS as readonly unknown[]).includes(value);
}

function toError(status: number, json: unknown): GroupApiError {
  const error = record(record(json)["error"]);
  const reason = typeof error["reason"] === "string" ? error["reason"] : undefined;
  switch (error["code"]) {
    case "UNAUTHENTICATED":
    case "SESSION_EXPIRED":
      return new GroupApiError("unauthenticated");
    case "NOT_FOUND":
      return new GroupApiError("not-found");
    case "RATE_LIMITED":
      return new GroupApiError("rate-limited");
    case "TRANSIENT":
      return new GroupApiError("transient");
    case "VALIDATION":
      switch (reason) {
        case "NOT_ORGANIZER":
          return new GroupApiError("not-organizer");
        case "ALREADY_HAS_GROUP":
          return new GroupApiError("already-has-group");
        case "GROUP_FULL":
          return new GroupApiError("group-full");
        case "GROUP_LOCKED":
          return new GroupApiError("group-locked");
        case "AUTHORITY_REQUIRED":
          return new GroupApiError("authority-required");
        case "CONSENT_REQUIRED":
          return new GroupApiError("consent-required");
        case "INVALID_OR_EXPIRED":
          return new GroupApiError("invalid-code");
        case "INVALID_INPUT":
        case "INVALID_BODY":
          return new GroupApiError("invalid-input");
        default:
          return new GroupApiError("unavailable");
      }
    default:
      // A static host or proxy page: the service is not there.
      return new GroupApiError(status >= 500 ? "transient" : "unavailable");
  }
}

function toGroup(value: unknown): GroupSummary {
  const v = record(value);
  if (typeof v["groupId"] !== "string") throw new GroupApiError("unavailable");
  return {
    groupId: v["groupId"],
    expiresAt: String(v["expiresAt"] ?? ""),
    locked: v["locked"] === true,
    authorityKind: v["authorityKind"] === "classroom" ? "classroom" : "household",
  };
}

function toSlot(value: unknown): GroupSlot {
  const v = record(value);
  if (typeof v["slotId"] !== "string" || typeof v["alias"] !== "string") {
    throw new GroupApiError("unavailable");
  }
  return {
    slotId: v["slotId"],
    alias: v["alias"],
    status: v["status"] === "approved" ? "approved" : "pending",
    ...(isTeam(v["team"]) ? { team: v["team"] } : {}),
    reconnects: Number(v["reconnects"] ?? 0),
  };
}

function toCode(value: unknown): GroupCode {
  const v = record(value);
  if (typeof v["code"] !== "string" || typeof v["expiresAt"] !== "string") {
    throw new GroupApiError("unavailable");
  }
  return { code: v["code"], expiresAt: v["expiresAt"] };
}
