/**
 * The adult session cookie rotates on every request, so two adult calls in flight at once can
 * invalidate each other. Every client that talks as the signed-in adult (link, groups) queues here,
 * so they run one at a time even when they belong to different panels.
 */
let tail: Promise<unknown> = Promise.resolve();

export function enqueueAdult<T>(run: () => Promise<T>): Promise<T> {
  const next = tail.then(run, run);
  tail = next.catch(() => undefined);
  return next;
}
