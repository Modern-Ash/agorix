import { GroupService, InMemoryGroupRepository, type AdultDirectory } from "../src/index.js";

export const SECRET = "g".repeat(40);

export class FakeClock {
  constructor(private ms = Date.parse("2026-10-25T12:00:00.000Z")) {}
  now(): Date {
    return new Date(this.ms);
  }
  advance(ms: number): void {
    this.ms += ms;
  }
}

/** Deterministic byte stream so codes, aliases and tokens are reproducible. */
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

export class FakeAdults implements AdultDirectory {
  readonly verified = new Set<string>(["org-1", "org-2"]);
  async hasVerifiedEmail(accountId: string): Promise<boolean> {
    return this.verified.has(accountId);
  }
}

export function build(policy: ConstructorParameters<typeof GroupService>[0]["policy"] = {}) {
  const clock = new FakeClock();
  const repository = new InMemoryGroupRepository();
  const adults = new FakeAdults();
  const service = new GroupService({
    repository,
    adults,
    secret: SECRET,
    clock,
    random: counterRandom(),
    policy,
  });
  return { clock, repository, adults, service };
}

export async function organizerWithGroup(ctx: ReturnType<typeof build>, accountId = "org-1") {
  await ctx.service.grantOrganizer(accountId);
  const group = await ctx.service.createGroup(accountId, {
    authority: { kind: "household" },
  });
  return { accountId, group };
}

/** Child device redeems a code and the organizer approves: returns the device token. */
export async function admit(
  ctx: ReturnType<typeof build>,
  accountId: string,
  groupId: string,
  source = "src-a",
) {
  const { code } = await ctx.service.issueJoinCode(accountId, groupId);
  const pending = await ctx.service.redeemJoinCode(code, source);
  const slot = await ctx.service.approve(accountId, groupId, pending.slotId, {
    consentAttested: true,
  });
  return { slot, deviceToken: pending.deviceToken };
}
