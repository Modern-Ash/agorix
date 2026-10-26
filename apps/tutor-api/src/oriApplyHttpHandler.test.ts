import { describe, expect, it } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createOriApplyHttpHandler } from "./oriApplyHttpHandler.js";

describe("Ori apply HTTP response adapter", () => {
  it("serializes successful responses with defensive headers", async () => {
    let status = 0;
    let headers: Record<string, string> = {};
    let body = "";
    const response = {
      headersSent: false,
      writableEnded: false,
      destroyed: false,
      writeHead(code: number, values: Record<string, string>) {
        status = code;
        headers = values;
      },
      end(value: string) {
        body = value;
      },
    } as unknown as ServerResponse;
    const handler = createOriApplyHttpHandler(async () => ({
      status: 200,
      body: { status: "applied" },
    }));
    await handler({} as IncomingMessage, response);
    expect(status).toBe(200);
    expect(headers["cache-control"]).toBe("no-store");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(body).toBe('{"status":"applied"}');
  });
  it("fails closed on pipeline errors", async () => {
    let status = 0;
    const response = {
      headersSent: false,
      writableEnded: false,
      destroyed: false,
      writeHead(code: number) { status = code; },
      end() {},
    } as unknown as ServerResponse;
    const handler = createOriApplyHttpHandler(async () => { throw Error("failure"); });
    await handler({} as IncomingMessage, response);
    expect(status).toBe(503);
  });
});
