import { describe, expect, it } from "vitest";
import { createOriExternalShadowDispatcher } from "./oriExternalShadow.js";
import { createOriShadowTransport } from "./oriExternalShadowTransport.js";
import { createOriShadowMetrics } from "./oriShadowMetrics.js";

const input = { missionIndex: 1, hintLevel: 2 as const, scriptCount: 1 };
const endpoint = "http://127.0.0.1:11485/v1/plan";

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
describe("Ori shadow isolation and resilience", () => {
  it.each([1, 2, 4, 8])("enforces max in-flight %i and drops excess", async (limit) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started = 0;
    const shadow = async () => {
      started++;
      await gate;
    };
    const dispatcher = createOriExternalShadowDispatcher(limit);
    for (let i = 0; i < limit + 10; i++) dispatcher.dispatch(true, shadow, input);
    await Promise.resolve();
    expect(started).toBe(limit);
    expect(dispatcher.inFlight).toBe(limit);
    release();
    await flush();
    expect(dispatcher.inFlight).toBe(0);
  });
  it("disabled requests never invoke transport", async () => {
    let called = 0;
    const dispatcher = createOriExternalShadowDispatcher();
    dispatcher.dispatch(
      false,
      async () => {
        called++;
      },
      input,
    );
    await flush();
    expect(called).toBe(0);
    expect(dispatcher.inFlight).toBe(0);
  });
  it("releases concurrency budget after synchronous throw", async () => {
    const dispatcher = createOriExternalShadowDispatcher(1);
    dispatcher.dispatch(
      true,
      () => {
        throw new Error("synthetic failure");
      },
      input,
    );
    await flush();
    expect(dispatcher.inFlight).toBe(0);
  });
  it("releases concurrency budget after asynchronous rejection", async () => {
    const dispatcher = createOriExternalShadowDispatcher(1);
    dispatcher.dispatch(
      true,
      async () => {
        throw new Error("synthetic rejection");
      },
      input,
    );
    await flush();
    expect(dispatcher.inFlight).toBe(0);
  });
  it("tracks transport failures but does not alter caller response", async () => {
    const metrics = createOriShadowMetrics();
    const tutorResponse = Object.freeze({
      message: "Respuesta determinista",
      appliedChanges: false,
    });
    const dispatcher = createOriExternalShadowDispatcher(1);
    const transport = createOriShadowTransport(
      endpoint,
      (async () => {
        throw new Error("offline");
      }) as typeof fetch,
      metrics,
    );
    dispatcher.dispatch(true, transport, input);
    await flush();
    expect(tutorResponse).toEqual({ message: "Respuesta determinista", appliedChanges: false });
    expect(metrics.snapshot()["network-error"]).toBe(1);
  });
  it("classifies an aborted request as timeout", async () => {
    const metrics = createOriShadowMetrics();
    const fetchMock = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      });
    }) as typeof fetch;
    const transport = createOriShadowTransport(endpoint, fetchMock, metrics);
    await expect(transport(input)).rejects.toThrow();
    expect(metrics.snapshot().timeout).toBe(1);
  }, 3000);
});
