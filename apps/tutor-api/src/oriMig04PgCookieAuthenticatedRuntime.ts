import { startOriMig04PgSessionProjectRuntime } from "./oriMig04PgSessionProjectRuntime.js";
import { createOriMig04SessionCookieTransport } from "./oriMig04SessionCookieTransport.js";
import { createOriMig04SessionRotationGuard } from "./oriMig04SessionRotationGuard.js";

/**
 * Explicit cookie-backed composition; never enables rollout by environment.
 * The host supplies AuthService and the server-owned active-project store.
 */
export function startOriMig04PgCookieAuthenticatedRuntime(
  options: Omit<Parameters<typeof startOriMig04PgSessionProjectRuntime>[0], "ori"> & {
    readonly projectLifecycle: Parameters<typeof createOriMig04SessionRotationGuard>[0];
    readonly ori: Omit<
      Parameters<typeof startOriMig04PgSessionProjectRuntime>[0]["ori"],
      "sessionToken" | "onRotatedToken" | "onRotatedSession"
    >;
  },
) {
  const transport = createOriMig04SessionCookieTransport();
  const rotation = createOriMig04SessionRotationGuard(options.projectLifecycle);
  return startOriMig04PgSessionProjectRuntime({
    ...options,
    ori: { ...options.ori, ...transport, onRotatedSession: rotation.onResolved },
  });
}
