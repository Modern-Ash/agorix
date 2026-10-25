import { describe, expect, it } from "vitest";
import type { IncomingMessage } from "node:http";
import type { AdminAuth } from "./adminAuth.js";
import { checkOriReviewHttpRequest } from "./oriReviewHttpGuard.js";

function request(overrides: Record<string, unknown> = {}): IncomingMessage {
  return {
    method: "POST",
    headers: {
      origin: "https://agorix.example",
      host: "agorix.example",
      "content-type": "application/json",
      "x-agorix-admin-csrf": "synthetic-csrf",
    },
    ...overrides,
  } as unknown as IncomingMessage;
}
const auth = {
  read: () => ({ author: "operator", csrf: "synthetic-csrf" }),
} as unknown as AdminAuth;
describe("Ori future adult review HTTP preflight", () => {
  it("allows authenticated same-origin POST with CSRF", () => {
    expect(checkOriReviewHttpRequest(request(), auth, ["agorix.example"])).toEqual({ allowed: true });
  });
  it.each(["GET", "PUT", "DELETE", "PATCH"])("rejects method %s", (method) => {
    expect(checkOriReviewHttpRequest(request({ method }), auth, ["agorix.example"])).toMatchObject({ status: 405 });
  });
  it.each([
    ["missing origin", { origin: undefined }],
    ["cross origin", { origin: "https://attacker.example" }],
    ["insecure origin", { origin: "http://agorix.example" }],
    ["embedded credentials", { origin: "https://user:pass@agorix.example" }],
    ["host spoof", { host: "attacker.example" }],
    ["invalid host", { host: "agorix.example/path" }],
    ["unexpected origin path", { origin: "https://agorix.example/other" }],
  ])("rejects %s", (_label, headers) => {
    expect(
      checkOriReviewHttpRequest(request({ headers: { ...request().headers, ...headers } }), auth, ["agorix.example"]),
    ).toMatchObject({ status: 403 });
  });
  it("rejects missing session", () => {
    const denied = { read: () => null } as unknown as AdminAuth;
    expect(checkOriReviewHttpRequest(request(), denied, ["agorix.example"])).toMatchObject({ status: 401 });
  });
  it("rejects missing or wrong CSRF token", () => {
    for (const token of [undefined, "wrong"]) {
      const headers = { ...request().headers, "x-agorix-admin-csrf": token };
      expect(checkOriReviewHttpRequest(request({ headers }), auth, ["agorix.example"])).toMatchObject({ status: 403 });
    }
  });
  it.each(["text/plain", "application/x-www-form-urlencoded", "application/json; charset=latin1"])(
    "rejects content type %s",
    (type) => {
      expect(
        checkOriReviewHttpRequest(
          request({ headers: { ...request().headers, "content-type": type } }),
          auth,
          ["agorix.example"],
        ),
      ).toMatchObject({ status: 415 });
    },
  );
});

describe("Ori HTTP guard trusted host hardening", () => {
  it("rejects all requests when no trusted hosts are configured", () => {
    expect(checkOriReviewHttpRequest(request(), auth)).toMatchObject({ allowed: false, status: 403 });
  });
  it("rejects an untrusted host even when Origin matches it", () => {
    expect(checkOriReviewHttpRequest(request(), auth, ["another.example"])).toMatchObject({
      allowed: false, status: 403,
    });
  });
  it("rejects an authentication reader exception without throwing", () => {
    const broken = { read: () => { throw new Error("synthetic auth failure"); } } as unknown as AdminAuth;
    expect(checkOriReviewHttpRequest(request(), broken, ["agorix.example"])).toMatchObject({
      allowed: false, status: 401,
    });
  });
});
