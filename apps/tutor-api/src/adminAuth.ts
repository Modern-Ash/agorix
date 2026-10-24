import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

const COOKIE = "agorix_ai_admin";
const SESSION_MS = 2 * 60 * 60 * 1000;

export interface AdminSession {
  readonly author: string;
  readonly csrf: string;
}

/** Format: scrypt$16384$8$1$<base64 salt>$<base64 32-byte hash>. */
export function hashAdminPassword(password: string, salt = randomBytes(16)): string {
  if (password.length < 16 || password.length > 256) throw new Error("admin password length");
  const hash = scryptSync(password, salt, 32, { N: 16_384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString("base64")}$${hash.toString("base64")}`;
}

function verifyPassword(password: string, encoded: string): boolean {
  const parts = encoded.split("$");
  if (
    parts.length !== 6 ||
    parts[0] !== "scrypt" ||
    parts[1] !== "16384" ||
    parts[2] !== "8" ||
    parts[3] !== "1" ||
    password.length > 256
  )
    return false;
  const salt = Buffer.from(parts[4]!, "base64");
  const expected = Buffer.from(parts[5]!, "base64");
  if (salt.length !== 16 || expected.length !== 32) return false;
  const actual = scryptSync(password, salt, 32, { N: 16_384, r: 8, p: 1 });
  return timingSafeEqual(actual, expected);
}

function tokenHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export class AdminAuth {
  private readonly sessions = new Map<string, { expires: number; csrf: string }>();
  private readonly attempts = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly passwordHash: string | undefined,
    readonly author = "operator",
    private readonly now: () => number = Date.now,
  ) {
    if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(author)) throw new Error("invalid admin author");
  }

  get configured(): boolean {
    return Boolean(this.passwordHash);
  }

  signIn(
    password: string,
    request: IncomingMessage,
    response: ServerResponse,
  ): AdminSession | null {
    if (!this.passwordHash) return null;
    const key = request.socket.remoteAddress ?? "unknown";
    const stamp = this.now();
    const prior = this.attempts.get(key);
    const next =
      !prior || stamp - prior.start > 60_000
        ? { start: stamp, count: 1 }
        : { start: prior.start, count: prior.count + 1 };
    this.attempts.set(key, next);
    if (next.count > 5 || !verifyPassword(password, this.passwordHash)) return null;
    this.attempts.delete(key);
    const token = randomBytes(32).toString("base64url");
    const csrf = randomBytes(24).toString("base64url");
    this.sessions.set(tokenHash(token), { expires: stamp + SESSION_MS, csrf });
    response.setHeader(
      "set-cookie",
      `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/api/tutor/admin; Max-Age=7200${request.headers["x-forwarded-proto"] === "https" ? "; Secure" : ""}`,
    );
    return { author: this.author, csrf };
  }

  read(request: IncomingMessage): AdminSession | null {
    const cookie = request.headers.cookie
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${COOKIE}=`));
    const token = cookie?.slice(COOKIE.length + 1);
    if (!token || !/^[A-Za-z0-9_-]{40,50}$/.test(token)) return null;
    const key = tokenHash(token);
    const session = this.sessions.get(key);
    if (!session) return null;
    if (session.expires <= this.now()) {
      this.sessions.delete(key);
      return null;
    }
    return { author: this.author, csrf: session.csrf };
  }

  signOut(request: IncomingMessage, response: ServerResponse): void {
    const cookie = request.headers.cookie
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${COOKIE}=`));
    const token = cookie?.slice(COOKIE.length + 1);
    if (token) this.sessions.delete(tokenHash(token));
    response.setHeader(
      "set-cookie",
      `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/api/tutor/admin; Max-Age=0${request.headers["x-forwarded-proto"] === "https" ? "; Secure" : ""}`,
    );
  }
}
