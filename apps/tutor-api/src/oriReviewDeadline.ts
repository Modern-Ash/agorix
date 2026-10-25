import type { IncomingMessage } from "node:http";
import { readOriReviewBody } from "./oriReviewBody.js";
import type { OriExternalShadowInput } from "./oriExternalShadow.js";

/**
 * Deadline for an IncomingMessage body. On timeout/abort, destroy the socket
 * stream so a pending async iterator can stop waiting for another chunk.
 * This is an internal primitive; no HTTP route is registered.
 */
export async function readOriReviewBodyWithDeadline(
  request: IncomingMessage,
  timeoutMs = 1000,
  maxBytes = 512,
  signal?: AbortSignal,
): Promise<OriExternalShadowInput | null> {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000)
    throw new RangeError("Invalid Ori review deadline");
  if (signal?.aborted || request.destroyed) return null;
  const controller = new AbortController();
  const stop = () => {
    controller.abort();
    request.destroy();
  };
  const onExternalAbort = () => stop();
  signal?.addEventListener("abort", onExternalAbort, { once: true });
  const timer = setTimeout(stop, timeoutMs);
  try {
    // Abort/destroy interrupts stalled HTTP body iteration.
    const result = await readOriReviewBody(request, maxBytes, controller.signal);
    return controller.signal.aborted || signal?.aborted ? null : result;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onExternalAbort);
  }
}
