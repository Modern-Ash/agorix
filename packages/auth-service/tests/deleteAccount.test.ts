import { describe, expect, it } from "vitest";
import {
  AuthPublicError,
  AuthService,
  InMemoryAccountRepository,
  InMemorySessionRepository,
} from "../src/index";

// Issue #517: permanent account deletion after the password is checked again.
const PASSWORD = "correct horse battery";

async function setup() {
  const accounts = new InMemoryAccountRepository();
  const sessions = new InMemorySessionRepository();
  const auth = new AuthService({ accounts, sessions });
  const { account } = await auth.register({ username: "ada-lovelace", password: PASSWORD });
  const other = await auth.register({ username: "bob-builder", password: PASSWORD });
  const signed = await auth.signIn({ username: "ada-lovelace", password: PASSWORD });
  const otherSigned = await auth.signIn({ username: "bob-builder", password: PASSWORD });
  return { accounts, sessions, auth, account, other: other.account, signed, otherSigned };
}

describe("AuthService.deleteAccount", () => {
  it("removes the account, its credential and every session", async () => {
    const s = await setup();
    await s.auth.signIn({ username: "ada-lovelace", password: PASSWORD });
    await s.auth.deleteAccount(s.account.accountId, PASSWORD);
    expect(await s.accounts.findByAccountId(s.account.accountId)).toBeUndefined();
    expect(await s.accounts.findByNormalizedUsername("ada-lovelace")).toBeUndefined();
    expect(
      s.sessions.snapshot().filter((r) => r.session.accountId === s.account.accountId),
    ).toEqual([]);
    await expect(s.auth.resolveSession(s.signed.sessionToken)).rejects.toMatchObject({
      code: "SESSION_EXPIRED",
    });
    await expect(
      s.auth.signIn({ username: "ada-lovelace", password: PASSWORD }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("leaves every other account and session untouched", async () => {
    const s = await setup();
    await s.auth.deleteAccount(s.account.accountId, PASSWORD);
    expect(await s.accounts.findByAccountId(s.other.accountId)).toBeDefined();
    await expect(s.auth.resolveSession(s.otherSigned.sessionToken)).resolves.toBeDefined();
  });

  it("a wrong password or an unknown account fails the same way and deletes nothing", async () => {
    const s = await setup();
    const failures: unknown[] = [];
    for (const [id, password] of [
      [s.account.accountId, "wrong password here"],
      ["no-such-account", PASSWORD],
      [s.account.accountId, ""],
    ] as const) {
      try {
        await s.auth.deleteAccount(id, password);
      } catch (error) {
        failures.push(error);
      }
    }
    expect(failures).toHaveLength(3);
    for (const failure of failures) {
      expect(failure).toBeInstanceOf(AuthPublicError);
      expect((failure as AuthPublicError).code).toBe("INVALID_CREDENTIALS");
      expect((failure as AuthPublicError).message).toBe("Invalid username or password");
    }
    expect(await s.accounts.findByAccountId(s.account.accountId)).toBeDefined();
    await expect(s.auth.resolveSession(s.signed.sessionToken)).resolves.toBeDefined();
  });

  it("rate limits password guesses on deletion", async () => {
    const s = await setup();
    for (let i = 0; i < 10; i += 1) {
      await expect(
        s.auth.deleteAccount(s.account.accountId, "wrong password here"),
      ).rejects.toMatchObject({
        code: "INVALID_CREDENTIALS",
      });
    }
    await expect(s.auth.deleteAccount(s.account.accountId, PASSWORD)).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
    expect(await s.accounts.findByAccountId(s.account.accountId)).toBeDefined();
  });

  it("the username becomes available again after deletion", async () => {
    const s = await setup();
    await s.auth.deleteAccount(s.account.accountId, PASSWORD);
    await expect(
      s.auth.register({ username: "ada-lovelace", password: PASSWORD }),
    ).resolves.toBeDefined();
  });
});
