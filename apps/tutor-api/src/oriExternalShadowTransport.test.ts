import { describe, expect, it } from "vitest";
import { createOriShadowTransport } from "./oriExternalShadowTransport.js";

describe("Ori loopback shadow transport", () => {
  it("rejects non-loopback and credentialed URLs", () => {
    for (const url of [
      "https://example.com/v0/shadow",
      "http://10.0.0.1:8000/v0/shadow",
      "http://user:pass@localhost:8000/v0/shadow",
      "http://localhost:8000/other",
    ])
      expect(() => createOriShadowTransport(url)).toThrow();
  });
  it("sends only minimized metadata and ignores response content", async () => {
    let body = "";
    const fetchMock = (async (_url: string | URL | Request, options?: RequestInit) => {
      body = String(options?.body);
      return { ok: true } as Response;
    }) as typeof fetch;
    const send = createOriShadowTransport("http://127.0.0.1:1234/v0/shadow", fetchMock);
    await send({ missionIndex: 1, hintLevel: 2, scriptCount: 3 });
    expect(JSON.parse(body)).toEqual({ missionIndex: 1, hintLevel: 2, scriptCount: 3 });
    expect(body).not.toMatch(/program|message|identity|session/i);
  });
});
