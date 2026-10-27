/**
 * Serialize requests using a rotating HttpOnly session cookie.
 * The local queue guarantees order within one tab. Web Locks additionally
 * serialize cooperating tabs on the same origin when supported.
 */
let tail: Promise<unknown> = Promise.resolve();
const LOCK_NAME = "agorix-auth-session-rotation";
export function withAgorixSessionQueue<T>(task: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
    if (!locks) return task();
    return locks.request(LOCK_NAME, { mode: "exclusive" }, task);
  };
  const next = tail.then(run, run);
  tail = next.catch(() => undefined);
  return next;
}
