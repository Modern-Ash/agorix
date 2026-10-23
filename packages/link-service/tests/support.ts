import {
  InMemoryLinkRepository,
  LinkService,
  type MailMessage,
  type Mailer,
} from "../src/index.js";

export const SECRET = "k".repeat(40);

export class FakeClock {
  constructor(private ms = Date.parse("2026-10-23T12:00:00.000Z")) {}
  now(): Date {
    return new Date(this.ms);
  }
  advance(ms: number): void {
    this.ms += ms;
  }
}

export class CaptureMailer implements Mailer {
  readonly sent: MailMessage[] = [];
  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
  }
  lastToken(): string {
    const last = [...this.sent].reverse().find((m) => m.kind === "verify-email");
    if (last === undefined || last.kind !== "verify-email") throw new Error("no verification mail");
    return last.token;
  }
}

/** Deterministic byte stream so codes and tokens are reproducible in tests. */
export function counterRandom(start = 1) {
  let n = start;
  return {
    bytes(length: number): Uint8Array {
      const out = new Uint8Array(length);
      for (let i = 0; i < length; i += 1) {
        n = (n * 1103515245 + 12345) >>> 0;
        out[i] = (n >>> 16) & 0xff;
      }
      return out;
    },
  };
}

export function build(
  options: { policy?: ConstructorParameters<typeof LinkService>[0]["policy"] } = {},
) {
  const clock = new FakeClock();
  const repository = new InMemoryLinkRepository();
  const mailer = new CaptureMailer();
  const service = new LinkService({
    repository,
    secret: SECRET,
    mailer,
    clock,
    random: counterRandom(),
    ...(options.policy === undefined ? {} : { policy: options.policy }),
  });
  return { clock, repository, mailer, service };
}

export async function verifiedAdult(
  ctx: ReturnType<typeof build>,
  accountId = "acct-1",
  email = "ada@example.com",
) {
  await ctx.service.addEmail(accountId, email);
  await ctx.service.verifyEmail(ctx.mailer.lastToken());
  return accountId;
}

export const summary = {
  version: 1,
  completedMissions: 3,
  practicedConcepts: [1, 0, 2],
  decisions: { used: 2, changed: 1, rejected: 0 },
  minutesByDay: [{ day: "2026-10-22", minutes: 12 }],
  ageBand: "6-8",
  dailyLimitMinutes: 30,
} as const;
