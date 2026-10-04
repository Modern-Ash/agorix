/**
 * DEVELOPMENT AND TEST ONLY. A `fetch` stand-in that talks to the in-process dev backend and keeps
 * a minimal cookie jar, so the real HTTP client code runs in unit tests without a network.
 */
import type { FetchLike } from "../accounts/httpClient.js";
import type { DevBackend } from "./devBackend.js";

export interface InProcessFetch {
  readonly fetch: FetchLike;
  /** Simulates the network being down (fetch rejects). */
  setOffline(offline: boolean): void;
  /** Overwrites the session cookie, e.g. with a value the server does not know. */
  setSessionCookie(value: string | undefined): void;
  sessionCookie(): string | undefined;
}

export function createInProcessFetch(backend: DevBackend): InProcessFetch {
  const jar = new Map<string, string>();
  let offline = false;
  const fetch: FetchLike = async (input, init) => {
    if (offline) throw new TypeError("network down");
    const headers: Record<string, string | undefined> = { host: "app.test" };
    for (const [name, value] of Object.entries(init.headers)) headers[name.toLowerCase()] = value;
    if (jar.size > 0) {
      headers["cookie"] = Array.from(jar, ([k, v]) => `${k}=${v}`).join("; ");
    }
    const response = await backend.handle({
      method: init.method,
      url: input,
      headers,
      ...(init.body === undefined ? {} : { body: init.body }),
    });
    const setCookie = response.headers["set-cookie"];
    if (setCookie !== undefined) {
      const [pair = "", ...attrs] = setCookie.split(";").map((part) => part.trim());
      const index = pair.indexOf("=");
      const name = pair.slice(0, index);
      const value = pair.slice(index + 1);
      const gone = attrs.some((a) => a.toLowerCase() === "max-age=0") || value === "";
      if (gone) jar.delete(name);
      else jar.set(name, value);
    }
    const text = response.body === null ? "" : JSON.stringify(response.body);
    return { status: response.status, text: async () => text };
  };
  return {
    fetch,
    setOffline: (value) => {
      offline = value;
    },
    setSessionCookie: (value) => {
      if (value === undefined) jar.delete("agorix_session");
      else jar.set("agorix_session", value);
    },
    sessionCookie: () => jar.get("agorix_session"),
  };
}
