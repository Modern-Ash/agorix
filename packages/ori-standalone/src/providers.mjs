/**
 * Provider port: explicit dependency injection, no SDK and no network access.
 * External provider adapters are separate, opt-in implementations.
 */
export class ProviderError extends Error {
  constructor(message) { super(message); this.name = "ProviderError"; }
}
export function createProviderRouter({ providers = {}, preferred = [], timeoutMs = 1500, totalBudgetMs = Math.min(30000, timeoutMs * Math.max(1, preferred.length)) } = {}) {
  if (!Array.isArray(preferred) || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000 ||
      !Number.isSafeInteger(totalBudgetMs) || totalBudgetMs < 1 || totalBudgetMs > 30000) {
    throw new ProviderError("Invalid provider policy");
  }
  if (preferred.some(id => typeof id !== "string" || id.length > 60)) throw new ProviderError("Invalid provider id");
  const counters = { requests: 0, modelResponses: 0, fallbacks: 0, providers: {} };
  return Object.freeze({
    metrics() {
      return {
        requests: counters.requests, modelResponses: counters.modelResponses, fallbacks: counters.fallbacks,
        providers: Object.fromEntries(Object.entries(counters.providers).map(([id, counts]) => [id, { ...counts }]))
      };
    },
    async complete(request) {
      counters.requests++;
      const deadline = performance.now() + totalBudgetMs;
      for (const id of preferred) {
        const adapter = providers[id];
        if (!adapter || typeof adapter.complete !== "function") continue;
        const remaining = Math.floor(deadline - performance.now());
        if (remaining < 1) break;
        const counts = counters.providers[id] ??= { attempts: 0, successes: 0, failures: 0, timeouts: 0, totalLatencyMs: 0 };
        counts.attempts++;
        const started = performance.now();
        const controller = new AbortController();
        let timer;
        let timedOut = false;
        try {
          const result = await Promise.race([
            Promise.resolve().then(() => adapter.complete(request, { signal: controller.signal })),
            new Promise((_, reject) => { timer = setTimeout(() => { timedOut = true; reject(new ProviderError("Provider timeout")); }, Math.min(timeoutMs, remaining)); })
          ]);
          if (!result || typeof result !== "object" || typeof result.message !== "string" || result.message.length > 300) {
            throw new ProviderError("Invalid provider response");
          }
          counts.successes++;
          counts.totalLatencyMs += Math.round(performance.now() - started);
          counters.modelResponses++;
          return { source: id, message: result.message, fallback: false };
        } catch {
          controller.abort();
          counts.failures++;
          if (timedOut) counts.timeouts++;
          // Never log child messages or provider output.
        } finally { clearTimeout(timer); }
      }
      counters.fallbacks++;
      return { source: "deterministic", message: null, fallback: true };
    }
  });
}
