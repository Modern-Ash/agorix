import { describe, expect, it } from "vitest";
import {
  AUTH_POSTGRESQL_SCHEMA_SQL,
  AUTH_SERVICE_MIGRATIONS,
  AUTH_SQLITE_SCHEMA_SQL,
  AuthPublicError,
  AuthService,
  InMemoryAccountRepository,
  InMemorySessionRepository,
  SqlAccountRepository,
  SqlSessionRepository,
  type AuthSqlExecutor,
  type AuthSqlResult,
  type AuthSqlRow,
  type AuthServicePolicy,
} from "../src/index";

class FixedClock {
  private current: Date;

  constructor(iso: string) {
    this.current = new Date(iso);
  }

  now(): Date {
    return new Date(this.current.getTime());
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

class CounterRandom {
  private next = 1;

  bytes(length: number): Uint8Array {
    const value = this.next;
    this.next += 1;
    return new Uint8Array(Array.from({ length }, (_, index) => (value + index) % 256));
  }
}

class RecordingSqlExecutor implements AuthSqlExecutor {
  readonly calls: { readonly sql: string; readonly params: readonly unknown[] }[] = [];

  async execute<R extends AuthSqlRow = AuthSqlRow>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<AuthSqlResult<R>> {
    this.calls.push({ sql, params });
    return { rows: [], rowCount: 1 };
  }
}

const TEST_POLICY: Partial<AuthServicePolicy> = {
  password: {
    minLength: 8,
    maxLength: 64,
  },
  registerRateLimit: {
    maxAttempts: 2,
    windowMs: 60_000,
  },
  signInRateLimit: {
    maxAttempts: 2,
    windowMs: 60_000,
  },
  session: {
    absoluteTtlMs: 3_600_000,
    idleTtlMs: 60_000,
    rotateOnResolve: true,
    tokenBytes: 16,
  },
};

function createHarness() {
  const clock = new FixedClock("2026-10-03T12:00:00.000Z");
  const accounts = new InMemoryAccountRepository();
  const sessions = new InMemorySessionRepository();
  const service = new AuthService({
    accounts,
    sessions,
    clock,
    random: new CounterRandom(),
    policy: TEST_POLICY,
  });
  return { accounts, clock, service, sessions };
}

describe("AuthService", () => {
  it("exports deployable SQL auth repositories and migrations", async () => {
    expect(AUTH_POSTGRESQL_SCHEMA_SQL).toContain("create table if not exists agorix_accounts");
    expect(AUTH_SQLITE_SCHEMA_SQL).toContain("agorix_sessions");
    expect(AUTH_SERVICE_MIGRATIONS[0].id).toBe("001_create_auth_accounts_and_sessions");

    const executor = new RecordingSqlExecutor();
    const accounts = new SqlAccountRepository({ executor, dialect: "postgresql" });
    const sessions = new SqlSessionRepository({ executor, dialect: "postgresql" });

    await accounts.findByAccountId("acct_01");
    await sessions.revoke("token-hash", "2026-10-03T12:00:00.000Z");

    expect(executor.calls[0]?.sql).toContain("$1");
    expect(executor.calls[1]?.sql).toContain("$2");
  });

  it("registers normalized usernames without persisting plaintext passwords", async () => {
    const { accounts, service } = createHarness();

    const result = await service.register({
      username: "  Ada.Lovelace  ",
      password: "correct horse",
    });

    expect(result.account.alias.normalized).toBe("ada-lovelace");
    const [stored] = accounts.snapshot();
    expect(stored?.credential.normalizedUsername).toBe("ada-lovelace");
    expect(stored?.credential.passwordHash).not.toContain("correct horse");
    expect(stored?.credential.passwordSalt).toBeTypeOf("string");
    expect(stored?.credential.passwordKdf.name).toBe("scrypt");
  });

  it("rejects duplicate usernames using case-insensitive normalized aliases", async () => {
    const { service } = createHarness();
    await service.register({ username: "Ada", password: "correct horse" });

    await expect(
      service.register({ username: " ADA ", password: "another password" }),
    ).rejects.toMatchObject({
      code: "USERNAME_TAKEN",
    });
  });

  it("enforces password bounds without silently trimming password input", async () => {
    const { service } = createHarness();

    await expect(service.register({ username: "Ada", password: "short" })).rejects.toMatchObject({
      code: "PASSWORD_POLICY_VIOLATION",
    });

    await service.register({ username: "Grace", password: " space-bound " });
    await expect(
      service.signIn({ username: "Grace", password: "space-bound" }),
    ).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
      message: "Invalid username or password",
    });
    await expect(service.signIn({ username: "Grace", password: " space-bound " })).resolves.toEqual(
      expect.objectContaining({
        account: expect.objectContaining({
          alias: expect.objectContaining({ normalized: "grace" }),
        }),
      }),
    );
  });

  it("returns generic invalid credentials for missing accounts, bad passwords and inactive accounts", async () => {
    const { accounts, service } = createHarness();
    await service.register({ username: "Ada", password: "correct horse" });

    await expect(
      service.signIn({ username: "Unknown", password: "correct horse" }),
    ).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
      message: "Invalid username or password",
    });
    await expect(
      service.signIn({ username: "Ada", password: "wrong password" }),
    ).rejects.toBeInstanceOf(AuthPublicError);

    const stored = accounts.snapshot()[0];
    if (stored === undefined) {
      throw new Error("expected account to be stored");
    }
    const inactiveAccount = {
      account: { ...stored.account, status: "suspended" as const },
      credential: stored.credential,
    };
    const inactiveAccounts = new InMemoryAccountRepository();
    await inactiveAccounts.create(inactiveAccount);
    const inactiveService = new AuthService({
      accounts: inactiveAccounts,
      sessions: new InMemorySessionRepository(),
      random: new CounterRandom(),
      policy: TEST_POLICY,
    });

    await expect(
      inactiveService.signIn({ username: "Ada", password: "correct horse" }),
    ).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
      message: "Invalid username or password",
    });
  });

  it("rate limits register and sign-in attempts deterministically", async () => {
    const { service } = createHarness();

    await expect(service.register({ username: "Alexa", password: "short" })).rejects.toMatchObject({
      code: "PASSWORD_POLICY_VIOLATION",
    });
    await expect(service.register({ username: "Alexa", password: "short" })).rejects.toMatchObject({
      code: "PASSWORD_POLICY_VIOLATION",
    });
    await expect(service.register({ username: "Alexa", password: "short" })).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });

    await service.register({ username: "Ada", password: "correct horse" });
    await expect(
      service.signIn({ username: "Ada", password: "bad password" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(
      service.signIn({ username: "Ada", password: "bad password" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(
      service.signIn({ username: "Ada", password: "correct horse" }),
    ).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("creates opaque sessions, rotates on resolve and invalidates previous tokens", async () => {
    const { service, sessions } = createHarness();
    await service.register({ username: "Ada", password: "correct horse" });

    const signedIn = await service.signIn({ username: "Ada", password: "correct horse" });
    expect(signedIn.sessionToken).not.toContain(signedIn.account.accountId);
    expect(signedIn.session.accountId).toBe(signedIn.account.accountId);

    const resolved = await service.resolveSession(signedIn.sessionToken);
    expect(resolved.rotated).toBe(true);
    expect(resolved.sessionToken).not.toBe(signedIn.sessionToken);

    await expect(service.resolveSession(signedIn.sessionToken)).rejects.toMatchObject({
      code: "SESSION_EXPIRED",
    });
    expect(sessions.snapshot().filter((session) => session.revokedAt !== undefined)).toHaveLength(
      1,
    );
  });

  it("expires idle sessions and absolute sessions", async () => {
    const { clock, service } = createHarness();
    await service.register({ username: "Ada", password: "correct horse" });
    const signedIn = await service.signIn({ username: "Ada", password: "correct horse" });

    clock.advance(60_001);
    await expect(service.resolveSession(signedIn.sessionToken)).rejects.toMatchObject({
      code: "SESSION_EXPIRED",
    });

    const second = await service.signIn({ username: "Ada", password: "correct horse" });
    clock.advance(3_600_001);
    await expect(service.resolveSession(second.sessionToken)).rejects.toMatchObject({
      code: "SESSION_EXPIRED",
    });
  });

  it("invalidates sessions on sign out", async () => {
    const { service } = createHarness();
    await service.register({ username: "Ada", password: "correct horse" });
    const signedIn = await service.signIn({ username: "Ada", password: "correct horse" });

    await service.signOut(signedIn.sessionToken);

    await expect(service.resolveSession(signedIn.sessionToken)).rejects.toMatchObject({
      code: "SESSION_EXPIRED",
    });
  });
});
