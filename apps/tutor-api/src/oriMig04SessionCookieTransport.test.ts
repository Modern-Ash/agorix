import { describe, expect, it } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createOriMig04SessionCookieTransport } from "./oriMig04SessionCookieTransport.js";

const token = "A".repeat(32);
const request = (cookie?: string) => ({ headers: cookie ? { cookie } : {} }) as IncomingMessage;

describe("MIG-04 trusted cookie transport", () => {
  const transport = createOriMig04SessionCookieTransport();

  it("reads exactly one host-only session cookie", () => {
    expect(transport.sessionToken(request(`x=1; __Host-agorix-session=${token}`))).toBe(token);
  });

  it("rejects missing, duplicate, malformed and oversized cookies", () => {
    expect(transport.sessionToken(request())).toBeNull();
    expect(
      transport.sessionToken(request(`__Host-agorix-session=${token}; __Host-agorix-session=${token}`)),
    ).toBeNull();
    expect(transport.sessionToken(request("__Host-agorix-session=bad value"))).toBeNull();
    expect(transport.sessionToken(request("x".repeat(8193)))).toBeNull();
  });

  it("preserves existing cookies when delivering a rotated token", () => {
    let cookies: string[] = [];
    transport.onRotatedToken(
      {
        headersSent: false,
        getHeader: () => ["theme=dark; Path=/"],
        setHeader: (_name: string, value: string[]) => {
          cookies = value;
        },
      } as never,
      token,
    );
    expect(cookies[0]).toBe("theme=dark; Path=/");
    expect(cookies[1]).toContain("HttpOnly; Secure; SameSite=Strict");
    expect(cookies[1]).toContain("__Host-agorix-session=");
  });

  it("denies overwriting an already issued session cookie", () => {
    expect(() =>
      transport.onRotatedToken(
        {
          headersSent: false,
          getHeader: () => [`__Host-agorix-session=${token}; Path=/`],
        } as never,
        token,
      ),
    ).toThrow("Cannot deliver duplicate Ori session cookie");
  });

  it("rejects duplicate session cookies with leading whitespace", () => {
    expect(() =>
      transport.onRotatedToken(
        {
          headersSent: false,
          getHeader: () => ["  __Host-agorix-session=existing; Path=/"],
        } as never,
        token,
      ),
    ).toThrow("Cannot deliver duplicate Ori session cookie");
  });

  it("fails closed after headers are sent or token is invalid", () => {
    expect(() => transport.onRotatedToken({ headersSent: true } as ServerResponse, token)).toThrow();
    expect(() => transport.onRotatedToken({ headersSent: false } as ServerResponse, "bad")).toThrow();
  });
});
