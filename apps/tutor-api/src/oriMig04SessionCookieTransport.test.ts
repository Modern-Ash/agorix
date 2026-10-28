import { describe, expect, it } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createOriMig04SessionCookieTransport } from "./oriMig04SessionCookieTransport.js";

const token = "A".repeat(32);
const request = (cookie?: string) =>
  ({ headers: cookie ? { cookie } : {} }) as IncomingMessage;

describe("MIG-04 trusted cookie transport", () => {
  const transport = createOriMig04SessionCookieTransport();

  it("reads exactly one host-only session cookie", () => {
    expect(transport.sessionToken(request(`x=1; __Host-agorix-session=${token}`))).toBe(token);
  });

  it("rejects missing, duplicate, malformed and oversized cookies", () => {
    expect(transport.sessionToken(request())).toBeNull();
    expect(transport.sessionToken(request(`__Host-agorix-session=${token}; __Host-agorix-session=${token}`))).toBeNull();
    expect(transport.sessionToken(request("__Host-agorix-session=bad value"))).toBeNull();
    expect(transport.sessionToken(request("x".repeat(8193)))).toBeNull();
  });

  it("delivers rotated token with secure cookie attributes", () => {
    let cookie = "";
    transport.onRotatedToken(
      { headersSent: false, setHeader: (_name: string, value: string) => { cookie = value; } } as never,
      token,
    );
    expect(cookie).toContain("HttpOnly; Secure; SameSite=Strict");
    expect(cookie).toContain("__Host-agorix-session=");
  });

  it("fails closed after headers are sent or token is invalid", () => {
    expect(() => transport.onRotatedToken({ headersSent: true } as ServerResponse, token)).toThrow();
    expect(() => transport.onRotatedToken({ headersSent: false } as ServerResponse, "bad")).toThrow();
  });
});
