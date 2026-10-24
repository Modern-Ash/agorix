import { describe, expect, it } from "vitest";
import { InMemoryLinkRepository, LinkService, SmtpMailer, parseSmtpUrl } from "../src/index.js";
import { counterRandom, FakeClock, SECRET } from "./support.js";
import { createSmtpInbox } from "./smtpInbox.js";

const ORIGIN = "https://agorix.example";
const FROM = "no-reply@agorix.example";

function decodedBody(message: string): string {
  const base64 = message.split("\r\n\r\n")[1]?.replace(/\r\n/g, "") ?? "";
  return Buffer.from(base64, "base64").toString("utf8");
}

function verificationLink(message: string): URL {
  const text = decodedBody(message);
  const raw = text.match(/https:\/\/[^\s]+\/kids\?verify=[A-Za-z0-9_-]+/)?.[0];
  if (!raw) throw new Error("verification link missing from captured email");
  return new URL(raw);
}

describe("adult email journey through a local SMTP inbox (#546)", () => {
  it("captures bilingual mail, follows its same-origin link and verifies once", async () => {
    const inbox = await createSmtpInbox();
    try {
      const mailer = new SmtpMailer({
        config: parseSmtpUrl(`smtp://127.0.0.1:${inbox.port}?plaintext=1`, FROM),
        publicOrigin: ORIGIN,
        timeoutMs: 2000,
      });
      const errors: unknown[] = [];
      const service = new LinkService({
        repository: new InMemoryLinkRepository(),
        secret: SECRET,
        mailer,
        clock: new FakeClock(),
        random: counterRandom(),
        onMailError: (error) => errors.push(error),
      });
      await expect(service.addEmail("adult-1", "Ada@Example.com")).resolves.toBeUndefined();
      await service.idle();
      expect(inbox.received).toHaveLength(1);
      const captured = inbox.received[0]!;
      expect(captured).toContain("To: <ada@example.com>");
      expect(captured).toContain("Subject: =?UTF-8?B?");
      const body = decodedBody(captured);
      expect(body).toContain("Hola");
      expect(body).toContain("Hello");
      const link = verificationLink(captured);
      expect(link.origin).toBe(ORIGIN);
      expect(link.pathname).toBe("/kids");
      const token = link.searchParams.get("verify")!;
      expect(await service.emailStatus("adult-1")).toEqual({ present: true, verified: false });
      await service.verifyEmail(token);
      expect(await service.emailStatus("adult-1")).toEqual({ present: true, verified: true });
      await expect(service.verifyEmail(token)).rejects.toMatchObject({
        code: "INVALID_OR_EXPIRED",
      });
      expect(errors).toEqual([]);
    } finally {
      inbox.server.close();
    }
  });

  it("keeps answers generic for occupied addresses and expired links", async () => {
    const inbox = await createSmtpInbox();
    try {
      const clock = new FakeClock();
      const service = new LinkService({
        repository: new InMemoryLinkRepository(),
        secret: SECRET,
        mailer: new SmtpMailer({
          config: parseSmtpUrl(`smtp://127.0.0.1:${inbox.port}?plaintext=1`, FROM),
          publicOrigin: ORIGIN,
          timeoutMs: 2000,
        }),
        clock,
        random: counterRandom(),
      });
      await service.addEmail("adult-1", "ada@example.com");
      await service.idle();
      const ownerToken = verificationLink(inbox.received[0]!).searchParams.get("verify")!;
      await service.verifyEmail(ownerToken);
      clock.advance(61_000);
      const occupied = await service.addEmail("adult-2", "ada@example.com");
      const available = await service.addEmail("adult-3", "bea@example.com");
      expect(occupied).toBe(available);
      await service.idle();
      expect(inbox.received).toHaveLength(3);
      expect(decodedBody(inbox.received[1]!)).not.toMatch(/verify=|token|https?:/i);
      const expiringToken = verificationLink(inbox.received[2]!).searchParams.get("verify")!;
      clock.advance(24 * 60 * 60 * 1000);
      await expect(service.verifyEmail(expiringToken)).rejects.toMatchObject({
        code: "INVALID_OR_EXPIRED",
      });
      expect(await service.emailStatus("adult-3")).toEqual({ present: true, verified: false });
    } finally {
      inbox.server.close();
    }
  });

  it("does not expose addresses or tokens when the SMTP delivery fails", async () => {
    const inbox = await createSmtpInbox();
    const port = inbox.port;
    await new Promise<void>((resolve) => inbox.server.close(() => resolve()));
    const errors: string[] = [];
    const service = new LinkService({
      repository: new InMemoryLinkRepository(),
      secret: SECRET,
      mailer: new SmtpMailer({
        config: parseSmtpUrl(`smtp://127.0.0.1:${port}?plaintext=1`, FROM),
        publicOrigin: ORIGIN,
        timeoutMs: 500,
      }),
      clock: new FakeClock(),
      random: counterRandom(),
      onMailError: (error) => errors.push(String(error)),
    });
    await expect(service.addEmail("adult-1", "ada@example.com")).resolves.toBeUndefined();
    await service.idle();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("connect");
    expect(errors[0]).not.toMatch(/ada@example|verify=|smtp:\/\//);
    expect(await service.emailStatus("adult-1")).toEqual({ present: true, verified: false });
  });
});
