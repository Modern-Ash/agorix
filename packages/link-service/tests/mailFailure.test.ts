import { describe, expect, it } from "vitest";
import {
  InMemoryLinkRepository,
  LinkService,
  MailDeliveryError,
  type Mailer,
} from "../src/index.js";
import { SECRET, counterRandom, FakeClock } from "./support.js";

// Issue #518: a failing mail server must not change what the API says or log secrets.
function build(mailer: Mailer, onMailError: (error: unknown) => void) {
  return new LinkService({
    repository: new InMemoryLinkRepository(),
    secret: SECRET,
    mailer,
    clock: new FakeClock(),
    random: counterRandom(),
    onMailError,
  });
}

describe("background delivery", () => {
  it("returns normally when delivery fails and reports the failure without address or token", async () => {
    const errors: unknown[] = [];
    const service = build(
      { send: async () => Promise.reject(new MailDeliveryError("connect")) },
      (e) => errors.push(e),
    );
    await expect(service.addEmail("acct-1", "ada@example.com")).resolves.toBeUndefined();
    await service.idle();
    expect(errors).toHaveLength(1);
    expect(String((errors[0] as Error).message)).toBe("mail delivery failed: connect");
    expect(await service.emailStatus("acct-1")).toEqual({ present: true, verified: false });
  });

  it("answers the same for a taken address and a fresh one even when the mail server is down", async () => {
    let calls = 0;
    const service = build(
      {
        send: async (message) => {
          calls += 1;
          if (message.kind === "email-in-use") throw new Error("boom ada@example.com");
        },
      },
      () => undefined,
    );
    await service.addEmail("acct-1", "ada@example.com");
    // the first message was a real verify mail; verify so the address is owned
    await service.idle();
    const outcomes = await Promise.allSettled([
      service.addEmail("acct-2", "ada@example.com"), // taken: in-use notice fails
      service.addEmail("acct-3", "new@example.com"), // fresh
    ]);
    await service.idle();
    expect(outcomes.map((o) => o.status)).toEqual(["fulfilled", "fulfilled"]);
    expect(calls).toBe(3);
  });

  it("does not wait for a slow mail server", async () => {
    let release: () => void = () => undefined;
    const service = build(
      { send: () => new Promise<void>((resolve) => (release = resolve)) },
      () => undefined,
    );
    const started = Date.now();
    await service.addEmail("acct-1", "ada@example.com");
    expect(Date.now() - started).toBeLessThan(500);
    release();
    await service.idle();
  });

  it("survives an error hook that throws", async () => {
    const service = build(
      { send: async () => Promise.reject(new MailDeliveryError("timeout")) },
      () => {
        throw new Error("hook broke");
      },
    );
    await expect(service.addEmail("acct-1", "ada@example.com")).resolves.toBeUndefined();
    await expect(service.idle()).resolves.toBeUndefined();
  });
});
