import { startOriMig04PgSessionProjectRuntime } from "./oriMig04PgSessionProjectRuntime.js";
import { createOriMig04SessionCookieTransport } from "./oriMig04SessionCookieTransport.js";

/**
 * Explicit cookie-backed composition; never enables rollout by environment.
 * The host supplies AuthService and the server-owned active-project store.
 */
export function startOriMig04PgCookieAuthenticatedRuntime(
  options: Omit<Parameters<typeof startOriMig04PgSessionProjectRuntime>[0], "ori"> & {
    readonly ori: Omit<
      Parameters<typeof startOriMig04PgSessionProjectRuntime>[0]["ori"],
      "sessionToken" | "onRotatedToken"
    >;
  },
) {
  const transport = createOriMig04SessionCookieTransport();
  return startOriMig04PgSessionProjectRuntime({
    ...options,
    ori: { ...options.ori, ...transport },
  });
}
