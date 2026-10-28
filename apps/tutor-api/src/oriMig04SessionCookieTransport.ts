import type { IncomingMessage, ServerResponse } from "node:http";

const COOKIE_NAME = "__Host-agorix-session";
const MAX_COOKIE_HEADER = 8192;

/**
 * Host-only, secure session cookie transport. No bearer/header identity
 * fallback. The deployment must terminate HTTPS and forward trusted cookies.
 */
export function createOriMig04SessionCookieTransport() {
  return Object.freeze({
    sessionToken(request: IncomingMessage): string | null {
      const raw = request.headers.cookie;
      if (!raw || raw.length > MAX_COOKIE_HEADER) return null;
      const matches = raw
        .split(";")
        .map((part) => part.trim())
        .filter((part) => part.startsWith(`${COOKIE_NAME}=`));
      if (matches.length !== 1) return null;
      const token = matches[0]?.slice(COOKIE_NAME.length + 1);
      return token && /^[A-Za-z0-9_-]{16,512}$/.test(token) ? token : null;
    },
    onRotatedToken(response: ServerResponse, token: string): void {
      if (!/^[A-Za-z0-9_-]{16,512}$/.test(token) || response.headersSent) {
        throw new Error("Cannot deliver rotated Ori session");
      }
      response.setHeader(
        "Set-Cookie",
        `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict`,
      );
    },
  });
}
