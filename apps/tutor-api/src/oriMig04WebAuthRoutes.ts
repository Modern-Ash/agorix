import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthService } from "@agorix/auth-service";
import type { createOriMig04AuthenticatedSessionActions } from "./oriMig04AuthenticatedSessionActions.js";
import { createOriMig04SessionCookieTransport } from "./oriMig04SessionCookieTransport.js";

type Actions = ReturnType<typeof createOriMig04AuthenticatedSessionActions>;
const MAX_BYTES = 4096;

/** Explicit opt-in web authentication endpoints; never trust client owner/session IDs. */
export function createOriMig04WebAuthRoutes(auth: Pick<AuthService, "register" | "signIn">, actions: Actions) {
  const cookies = createOriMig04SessionCookieTransport();
  async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
    let raw = "";
    for await (const chunk of request) {
      raw += String(chunk);
      if (raw.length > MAX_BYTES) throw Error("body too large");
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw Error("invalid body");
    return parsed as Record<string, unknown>;
  }
  function json(response: ServerResponse, status: number, payload: unknown): void {
    response.writeHead(status, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    });
    response.end(JSON.stringify(payload));
  }
  return async (request: IncomingMessage, response: ServerResponse): Promise<boolean> => {
    const path = new URL(request.url ?? "/", "http://local").pathname;
    if (!path.startsWith("/api/tutor/ori/auth/")) return false;
    const known = new Set([
      "/api/tutor/ori/auth/register",
      "/api/tutor/ori/auth/login",
      "/api/tutor/ori/auth/logout",
      "/api/tutor/ori/auth/project",
    ]);
    if (!known.has(path)) {
      json(response, 404, { error: "not-found" });
      return true;
    }
    if (request.method !== "POST") {
      json(response, 405, { error: "method-not-allowed" });
      return true;
    }
    // These endpoints require same-origin browser requests and must not be exposed
    // behind an untrusted reverse proxy that rewrites Host/Origin.
    let sameOrigin = false;
    try {
      const origin = new URL(request.headers.origin ?? "");
      sameOrigin = origin.protocol === "https:" && origin.host === request.headers.host;
    } catch {
      sameOrigin = false;
    }
    if (!sameOrigin || !/^application\/json(?:\s*;|\s*$)/i.test(request.headers["content-type"] ?? "")) {
      json(response, 403, { error: "origin-denied" });
      return true;
    }
    try {
      const input = path === "/api/tutor/ori/auth/logout" ? {} : await body(request);
      if (path === "/api/tutor/ori/auth/register") {
        if (typeof input.username !== "string" || typeof input.password !== "string")
          throw Error("invalid input");
        await auth.register({ username: input.username, password: input.password });
        json(response, 201, { status: "registered" });
      } else if (path === "/api/tutor/ori/auth/login") {
        if (typeof input.username !== "string" || typeof input.password !== "string")
          throw Error("invalid input");
        const login = await auth.signIn({ username: input.username, password: input.password });
        cookies.onRotatedToken(response, login.sessionToken);
        json(response, 200, { status: "authenticated" });
      } else if (path === "/api/tutor/ori/auth/logout") {
        const token = cookies.sessionToken(request);
        if (!token) {
          json(response, 401, { error: "unauthorized" });
        } else {
          await actions.signOut(token);
          response.setHeader(
            "Set-Cookie",
            "__Host-agorix-session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict",
          );
          json(response, 200, { status: "signed-out" });
        }
      } else if (path === "/api/tutor/ori/auth/project") {
        const token = cookies.sessionToken(request);
        if (!token || typeof input.projectId !== "string") {
          json(response, 401, { error: "unauthorized" });
        } else {
          await actions.selectProject(token, input.projectId, (rotatedToken) => {
            cookies.onRotatedToken(response, rotatedToken);
          });
          json(response, 200, { status: "selected" });
        }
      } else {
        json(response, 404, { error: "not-found" });
      }
    } catch {
      json(response, 403, { error: "request-denied" });
    }
    return true;
  };
}
