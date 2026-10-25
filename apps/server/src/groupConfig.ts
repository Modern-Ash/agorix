import { request as httpRequest } from "node:http";

type Env = Readonly<Record<string, string | undefined>>;

/**
 * Reads the optional closed-group settings (issue #566). Empty values count as unset so a compose
 * file can pass them through. The feature needs the adult link (verified email) and is off by
 * default; a half configuration fails at startup instead of silently serving nothing.
 */
export function readGroupConfig(env: Env, linkEnabled: boolean): { readonly secret?: string } {
  const secret = env["AGORIX_GROUP_SECRET"] || undefined;
  if (secret === undefined) return {};
  if (secret.length < 32) throw new Error("AGORIX_GROUP_SECRET must be at least 32 characters");
  if (!linkEnabled) {
    throw new Error(
      "AGORIX_GROUP_SECRET requires AGORIX_LINK_SECRET (organizers need a verified email)",
    );
  }
  return { secret };
}

/** Where the admin registry's public group parameters live. Unset means "use the code defaults". */
export function readGroupConfigSource(env: Env): string | undefined {
  const source = env["AGORIX_GROUP_CONFIG_URL"] || undefined;
  if (source === undefined) return undefined;
  if (source.startsWith("unix:")) {
    if (!source.startsWith("unix:/"))
      throw new Error("AGORIX_GROUP_CONFIG_URL unix path must be absolute");
    return source;
  }
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    throw new Error("AGORIX_GROUP_CONFIG_URL is invalid");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("AGORIX_GROUP_CONFIG_URL must be http, https or unix:");
  }
  return source;
}

export interface GroupLimits {
  readonly maxChildren: number;
  readonly maxSessionMinutes: number;
  readonly joinCodeMinutes: number;
}

/**
 * Reads only the three limits the server enforces, and only when every one is an in-range integer.
 * Anything else (extra fields included) is ignored: the server keeps its last good values.
 */
export function parseGroupLimits(
  body: unknown,
): { revision: number; limits: GroupLimits } | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const root = body as Record<string, unknown>;
  const group = root["group"] as Record<string, unknown> | undefined;
  const limits = group?.["limits"] as Record<string, unknown> | undefined;
  const revision = root["revision"];
  if (
    typeof revision !== "number" ||
    !Number.isInteger(revision) ||
    typeof limits !== "object" ||
    limits === null
  ) {
    return undefined;
  }
  const within = (value: unknown, min: number, max: number): value is number =>
    typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
  const { maxChildren, maxSessionMinutes, joinCodeMinutes } = limits;
  if (
    !within(maxChildren, 1, 4) ||
    !within(maxSessionMinutes, 15, 240) ||
    !within(joinCodeMinutes, 1, 10)
  ) {
    return undefined;
  }
  return { revision, limits: { maxChildren, maxSessionMinutes, joinCodeMinutes } };
}

const MAX_BYTES = 256_000;

/** One bounded GET of the registry's public group section over http(s) or a unix socket. */
export function fetchGroupConfig(source: string, timeoutMs = 3_000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const unix = source.startsWith("unix:");
    const url = unix ? undefined : new URL(source);
    const req = httpRequest(
      unix
        ? {
            socketPath: source.slice("unix:".length),
            path: "/api/tutor/group-config",
            method: "GET",
          }
        : {
            host: url!.hostname,
            port: url!.port || undefined,
            path: url!.pathname + url!.search,
            method: "GET",
            protocol: url!.protocol,
          },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error("status"));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            req.destroy(new Error("too-large"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch {
            reject(new Error("parse"));
          }
        });
      },
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

export interface GroupConfigSync {
  refreshNow(): Promise<boolean>;
  stop(): void;
}

/**
 * Keeps the group service in step with the registry. A failed or invalid response changes nothing,
 * so the last good limits (or the code defaults before the first success) stay in force. The log
 * line carries only the revision or a failure kind, never the payload.
 */
export function startGroupConfigSync(options: {
  readonly source: string;
  readonly apply: (limits: GroupLimits) => void;
  readonly intervalMs?: number;
  readonly log?: (line: string) => void;
  readonly fetcher?: (source: string) => Promise<unknown>;
}): GroupConfigSync {
  const fetcher = options.fetcher ?? ((source: string) => fetchGroupConfig(source));
  let lastRevision: number | undefined;
  const refreshNow = async (): Promise<boolean> => {
    try {
      const parsed = parseGroupLimits(await fetcher(options.source));
      if (parsed === undefined) {
        options.log?.("group config ignored: invalid");
        return false;
      }
      options.apply(parsed.limits);
      if (parsed.revision !== lastRevision) {
        lastRevision = parsed.revision;
        options.log?.(`group config revision ${parsed.revision}`);
      }
      return true;
    } catch (error) {
      options.log?.(
        `group config unavailable: ${error instanceof Error ? error.message : "error"}`,
      );
      return false;
    }
  };
  const timer = setInterval(() => void refreshNow(), options.intervalMs ?? 60_000);
  timer.unref();
  void refreshNow();
  return { refreshNow, stop: () => clearInterval(timer) };
}
