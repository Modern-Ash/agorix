import type { StoredProject } from "@agorix/persistence";
import {
  ClientError,
  type AccountBackend,
  type AccountSummary,
  type ConflictRecovery,
  type ProjectDto,
  type ProjectSummaryDto,
} from "./clients.js";

export type FetchLike = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    credentials: "same-origin";
  },
) => Promise<{ status: number; text(): Promise<string> }>;

export interface HttpBackendOptions {
  readonly fetch?: FetchLike;
  /** Path of account routes. A real server decides these; the dev server uses `/__dev/auth`. */
  readonly accountPath?: string;
}

export const DEFAULT_ACCOUNT_PATH = "/__dev/auth";

interface Parsed {
  readonly status: number;
  readonly json: unknown;
}

/** Cookie-session HTTP client for `agorix/project-api/v1`. Requests are serialized because sessions rotate. */
export function createHttpBackend(options: HttpBackendOptions = {}): AccountBackend {
  const doFetch: FetchLike =
    options.fetch ?? ((input, init) => globalThis.fetch(input, init) as ReturnType<FetchLike>);
  const accountPath = options.accountPath ?? DEFAULT_ACCOUNT_PATH;
  let tail: Promise<unknown> = Promise.resolve();

  function send(
    method: string,
    url: string,
    body?: unknown,
    extraHeaders: Record<string, string> = {},
  ): Promise<Parsed> {
    const run = async (): Promise<Parsed> => {
      const headers: Record<string, string> = { accept: "application/json", ...extraHeaders };
      if (method !== "GET") headers["x-agorix-request"] = "1";
      if (body !== undefined) headers["content-type"] = "application/json";
      let response;
      try {
        response = await doFetch(url, {
          method,
          headers,
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          credentials: "same-origin",
        });
      } catch {
        throw new ClientError("transient");
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
    };
    const next = tail.then(run, run);
    tail = next.catch(() => undefined);
    return next;
  }

  const account = {
    async restore(): Promise<AccountSummary> {
      const { json } = await send("GET", "/v1/session");
      return toAccount(json);
    },
    async register(alias: string, password: string): Promise<void> {
      await send("POST", `${accountPath}/register`, { username: alias, password });
    },
    async signIn(alias: string, password: string): Promise<AccountSummary> {
      await send("POST", `${accountPath}/login`, { username: alias, password });
      const { json } = await send("GET", "/v1/session");
      return toAccount(json);
    },
    async signOut(): Promise<void> {
      await send("POST", `${accountPath}/logout`, {});
    },
  };

  const projects = {
    async list(): Promise<readonly ProjectSummaryDto[]> {
      const items: ProjectSummaryDto[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < 100; page += 1) {
        const query = cursor === undefined ? "" : `?cursor=${encodeURIComponent(cursor)}`;
        const { json } = await send("GET", `/v1/projects${query}`);
        const body = asRecord(json);
        const batch = Array.isArray(body["items"]) ? body["items"] : [];
        items.push(...batch.map(toSummary));
        cursor = typeof body["nextCursor"] === "string" ? body["nextCursor"] : undefined;
        if (cursor === undefined) break;
      }
      return items;
    },
    async create(title: string, storedProject: StoredProject): Promise<ProjectDto> {
      const { json } = await send(
        "POST",
        "/v1/projects",
        { title, storedProject },
        { "idempotency-key": idempotencyKey() },
      );
      return toProject(json);
    },
    async get(projectId: string): Promise<ProjectDto> {
      const { json } = await send("GET", `/v1/projects/${encodeURIComponent(projectId)}`);
      return toProject(json);
    },
    async update(
      projectId: string,
      expectedRevision: number,
      storedProject: StoredProject,
    ): Promise<ProjectDto> {
      const { json } = await send("PUT", `/v1/projects/${encodeURIComponent(projectId)}`, {
        expectedRevision,
        storedProject,
      });
      return toProject(json);
    },
    async rename(projectId: string, expectedRevision: number, title: string): Promise<ProjectDto> {
      const { json } = await send("PATCH", `/v1/projects/${encodeURIComponent(projectId)}`, {
        expectedRevision,
        title,
      });
      return toProject(json);
    },
    async duplicate(projectId: string, title?: string): Promise<ProjectDto> {
      const { json } = await send(
        "POST",
        `/v1/projects/${encodeURIComponent(projectId)}/duplicate`,
        title === undefined ? {} : { title },
        { "idempotency-key": idempotencyKey() },
      );
      return toProject(json);
    },
    async delete(projectId: string, expectedRevision: number): Promise<void> {
      await send(
        "DELETE",
        `/v1/projects/${encodeURIComponent(projectId)}?expectedRevision=${expectedRevision}`,
      );
    },
  };

  return { account, projects };
}

function idempotencyKey(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function toError(status: number, json: unknown): ClientError {
  const error = asRecord(asRecord(json)["error"]);
  const code = error["code"];
  const reason = typeof error["reason"] === "string" ? error["reason"] : undefined;
  switch (code) {
    case "UNAUTHENTICATED":
      return new ClientError("unauthenticated");
    case "SESSION_EXPIRED":
      return new ClientError("session-expired");
    case "NOT_FOUND":
      return new ClientError("not-found");
    case "VALIDATION":
    case "CSRF_REJECTED":
    case "PASSWORD_POLICY_VIOLATION":
    case "INVALID_ALIAS":
      return new ClientError("validation", reason ?? String(code));
    case "REVISION_CONFLICT": {
      const recovery = asRecord(error["recovery"]);
      const conflict: ConflictRecovery | undefined =
        typeof recovery["currentRevision"] === "number"
          ? {
              currentRevision: recovery["currentRevision"],
              currentUpdatedAt: String(recovery["currentUpdatedAt"] ?? ""),
              currentSemanticHash: String(recovery["currentSemanticHash"] ?? ""),
            }
          : undefined;
      return new ClientError("revision-conflict", undefined, conflict);
    }
    case "TRANSIENT":
      return new ClientError("transient");
    case "INVALID_CREDENTIALS":
      return new ClientError("invalid-credentials");
    case "USERNAME_TAKEN":
      return new ClientError("username-taken");
    case "RATE_LIMITED":
      return new ClientError("rate-limited");
    default:
      // Not an Agorix API answer (static host, proxy error page): accounts are not available.
      return new ClientError(status >= 500 ? "transient" : "unavailable");
  }
}

function toAccount(json: unknown): AccountSummary {
  const body = asRecord(json);
  const account = asRecord(body["account"]);
  const session = asRecord(body["session"]);
  if (typeof account["alias"] !== "string") throw new ClientError("unavailable");
  return { alias: account["alias"], expiresAt: String(session["expiresAt"] ?? "") };
}

function toSummary(value: unknown): ProjectSummaryDto {
  const v = asRecord(value);
  if (typeof v["projectId"] !== "string" || typeof v["revision"] !== "number") {
    throw new ClientError("unavailable");
  }
  return {
    projectId: v["projectId"],
    title: String(v["title"] ?? ""),
    revision: v["revision"],
    createdAt: String(v["createdAt"] ?? ""),
    updatedAt: String(v["updatedAt"] ?? ""),
    semanticHash: String(v["semanticHash"] ?? ""),
  };
}

function toProject(value: unknown): ProjectDto {
  const stored = asRecord(value)["storedProject"];
  if (typeof stored !== "object" || stored === null) throw new ClientError("unavailable");
  return { ...toSummary(value), storedProject: stored as StoredProject };
}
