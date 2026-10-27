import { describe, expect, it } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createOriEducatorRouteDispatcher } from "./oriEducatorRouteDispatcher.js";
import type { createOriEducatorAdminHttpAdapter } from "./oriEducatorAdminHttpAdapter.js";

function response() {
  let status = 0;
  const value = {
    headersSent: false, writableEnded: false, destroyed: false,
    writeHead(code: number) { status = code; },
    end() {},
  } as unknown as ServerResponse;
  return { value, status: () => status };
}
const request = (url: string, method = "POST") =>
  ({ url, method, headers: {} }) as IncomingMessage;
describe("MIG-03 educator route dispatcher", () => {
  it("does not intercept unrelated tutor routes", async () => {
    const handler = async () => { throw Error("unexpected"); };
    const dispatch = createOriEducatorRouteDispatcher({ handler, enabled: true });
    const output = response();
    expect(await dispatch(request("/api/tutor/health"), output.value)).toBe(false);
    expect(output.status()).toBe(0);
  });
  it("defaults to disabled and rejects invalid route/method", async () => {
    let calls = 0;
    const handler = async () => { calls++; };
    const disabled = createOriEducatorRouteDispatcher({ handler });
    const output = response();
    expect(await disabled(request("/api/tutor/admin/ori-educator/pilot/snapshot"), output.value)).toBe(true);
    expect(output.status()).toBe(404);
    const enabled = createOriEducatorRouteDispatcher({ handler, enabled: true });
    const bad = response();
    await enabled(request("/api/tutor/admin/ori-educator/pilot/unknown"), bad.value);
    expect(bad.status()).toBe(404);
    const wrongMethod = response();
    await enabled(request("/api/tutor/admin/ori-educator/pilot/snapshot", "GET"), wrongMethod.value);
    expect(wrongMethod.status()).toBe(405);
    expect(calls).toBe(0);
  });
  it("delegates only explicit adult review operations", async () => {
    const received: string[] = [];
    const handler: ReturnType<typeof createOriEducatorAdminHttpAdapter> =
      async (operation, id) => { received.push(operation, id); };
    const dispatch = createOriEducatorRouteDispatcher({ handler, enabled: true });
    const output = response();
    expect(await dispatch(request("/api/tutor/admin/ori-educator/pilot/audit"), output.value)).toBe(true);
    expect(received).toEqual(["audit", "pilot"]);
  });
});
