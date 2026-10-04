import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import {
  createAccountIdentity,
  createSessionIdentity,
  normalizeAccountAlias,
  type AccountIdentity,
  type SessionIdentity,
} from "@agorix/platform-contract";

export const AUTH_SERVICE_PACKAGE_NAME = "@agorix/auth-service";

export type AuthPublicErrorCode =
  | "INVALID_CREDENTIALS"
  | "PASSWORD_POLICY_VIOLATION"
  | "RATE_LIMITED"
  | "SESSION_EXPIRED"
  | "USERNAME_TAKEN";

export class AuthPublicError extends Error {
  readonly code: AuthPublicErrorCode;

  constructor(code: AuthPublicErrorCode, message: string) {
    super(message);
    this.name = "AuthPublicError";
    this.code = code;
  }
}

class AuthInternalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthInternalError";
  }
}

export interface PasswordPolicy {
  readonly minLength: number;
  readonly maxLength: number;
}

export interface RateLimitPolicy {
  readonly maxAttempts: number;
  readonly windowMs: number;
}

export interface SessionPolicy {
  readonly absoluteTtlMs: number;
  readonly idleTtlMs: number;
  readonly rotateOnResolve: boolean;
  readonly tokenBytes: number;
}

export interface AuthServicePolicy {
  readonly password: PasswordPolicy;
  readonly registerRateLimit: RateLimitPolicy;
  readonly signInRateLimit: RateLimitPolicy;
  readonly session: SessionPolicy;
}

export interface PasswordCredentialRecord {
  readonly normalizedUsername: string;
  readonly passwordHash: string;
  readonly passwordSalt: string;
  readonly passwordKdf: PasswordKdfRecord;
  readonly createdAt: string;
}

export interface PasswordKdfRecord {
  readonly name: "scrypt";
  readonly keyLength: number;
  readonly cost: number;
  readonly blockSize: number;
  readonly parallelization: number;
}

export interface AccountRecord {
  readonly account: AccountIdentity;
  readonly credential: PasswordCredentialRecord;
}

export interface SessionRecord {
  readonly tokenHash: string;
  readonly session: SessionIdentity;
  readonly absoluteExpiresAt: string;
  readonly idleExpiresAt: string;
  readonly revokedAt?: string;
}

export interface AccountRepository {
  findByNormalizedUsername(normalizedUsername: string): Promise<AccountRecord | undefined>;
  findByAccountId(accountId: string): Promise<AccountRecord | undefined>;
  create(record: AccountRecord): Promise<void>;
  updateCredential(accountId: string, credential: PasswordCredentialRecord): Promise<void>;
}

export interface SessionRepository {
  findByTokenHash(tokenHash: string): Promise<SessionRecord | undefined>;
  create(record: SessionRecord): Promise<void>;
  replace(previousTokenHash: string, nextRecord: SessionRecord, revokedAt: string): Promise<void>;
  revoke(tokenHash: string, revokedAt: string): Promise<void>;
}

export interface RegisterInput {
  readonly username: string;
  readonly password: string;
}

export interface SignInInput {
  readonly username: string;
  readonly password: string;
}

export interface RegisterResult {
  readonly account: AccountIdentity;
}

export interface SignInResult {
  readonly account: AccountIdentity;
  readonly session: SessionIdentity;
  readonly sessionToken: string;
}

export interface ResolveSessionResult {
  readonly account: AccountIdentity;
  readonly session: SessionIdentity;
  readonly sessionToken: string;
  readonly rotated: boolean;
}

interface Clock {
  now(): Date;
}

interface RandomSource {
  bytes(length: number): Uint8Array;
}

export interface AuthServiceOptions {
  readonly accounts: AccountRepository;
  readonly sessions: SessionRepository;
  readonly policy?: PartialAuthServicePolicy;
  readonly clock?: Clock;
  readonly random?: RandomSource;
}

export type PartialAuthServicePolicy = {
  readonly password?: Partial<PasswordPolicy>;
  readonly registerRateLimit?: Partial<RateLimitPolicy>;
  readonly signInRateLimit?: Partial<RateLimitPolicy>;
  readonly session?: Partial<SessionPolicy>;
};

const DEFAULT_POLICY: AuthServicePolicy = {
  password: {
    minLength: 12,
    maxLength: 256,
  },
  registerRateLimit: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
  },
  signInRateLimit: {
    maxAttempts: 10,
    windowMs: 15 * 60 * 1000,
  },
  session: {
    absoluteTtlMs: 8 * 60 * 60 * 1000,
    idleTtlMs: 30 * 60 * 1000,
    rotateOnResolve: true,
    tokenBytes: 32,
  },
};

const SCRYPT_KDF: PasswordKdfRecord = {
  name: "scrypt",
  keyLength: 64,
  cost: 16_384,
  blockSize: 8,
  parallelization: 1,
};

const GENERIC_INVALID_CREDENTIALS = "Invalid username or password";

export class AuthService {
  private readonly accounts: AccountRepository;
  private readonly sessions: SessionRepository;
  private readonly policy: AuthServicePolicy;
  private readonly clock: Clock;
  private readonly random: RandomSource;
  private readonly rateLimiter: InMemoryRateLimiter;

  constructor(options: AuthServiceOptions) {
    this.accounts = options.accounts;
    this.sessions = options.sessions;
    this.policy = mergePolicy(options.policy);
    this.clock = options.clock ?? { now: () => new Date() };
    this.random = options.random ?? { bytes: (length) => randomBytes(length) };
    this.rateLimiter = new InMemoryRateLimiter(this.clock);
  }

  async register(input: RegisterInput): Promise<RegisterResult> {
    const alias = normalizeAccountAlias(input.username);
    this.rateLimiter.requireAllowed(`register:${alias.normalized}`, this.policy.registerRateLimit);
    validatePassword(input.password, this.policy.password);

    if ((await this.accounts.findByNormalizedUsername(alias.normalized)) !== undefined) {
      throw new AuthPublicError("USERNAME_TAKEN", "Username is already registered");
    }

    const createdAt = this.nowIso();
    const account = createAccountIdentity({
      accountId: this.randomIdentifier(16),
      alias: input.username,
      status: "active",
      createdAt,
    });
    const credential = await this.hashPassword(alias.normalized, input.password, createdAt);
    await this.accounts.create({ account, credential });
    return { account };
  }

  async signIn(input: SignInInput): Promise<SignInResult> {
    const alias = normalizeAccountAlias(input.username);
    this.rateLimiter.requireAllowed(`sign-in:${alias.normalized}`, this.policy.signInRateLimit);

    const record = await this.accounts.findByNormalizedUsername(alias.normalized);
    if (record === undefined || !(await this.verifyPassword(input.password, record.credential))) {
      throw new AuthPublicError("INVALID_CREDENTIALS", GENERIC_INVALID_CREDENTIALS);
    }
    if (record.account.status !== "active") {
      throw new AuthPublicError("INVALID_CREDENTIALS", GENERIC_INVALID_CREDENTIALS);
    }
    if (passwordKdfRequiresRehash(record.credential.passwordKdf)) {
      await this.accounts.updateCredential(
        record.account.accountId,
        await this.hashPassword(
          record.credential.normalizedUsername,
          input.password,
          this.nowIso(),
        ),
      );
    }

    const token = this.randomToken(this.policy.session.tokenBytes);
    const session = this.createSessionIdentityFor(record.account.accountId);
    await this.sessions.create({
      tokenHash: hashToken(token),
      session,
      absoluteExpiresAt: session.expiresAt,
      idleExpiresAt: this.futureIso(this.policy.session.idleTtlMs),
    });

    return {
      account: record.account,
      session,
      sessionToken: token,
    };
  }

  async resolveSession(sessionToken: string): Promise<ResolveSessionResult> {
    const tokenHash = hashToken(sessionToken);
    const record = await this.sessions.findByTokenHash(tokenHash);
    if (record === undefined || record.revokedAt !== undefined || this.isExpired(record)) {
      if (record !== undefined && record.revokedAt === undefined) {
        await this.sessions.revoke(tokenHash, this.nowIso());
      }
      throw new AuthPublicError("SESSION_EXPIRED", "Session is expired or invalid");
    }

    const accountRecord = await this.accounts.findByAccountId(record.session.accountId);
    if (accountRecord === undefined || accountRecord.account.status !== "active") {
      await this.sessions.revoke(tokenHash, this.nowIso());
      throw new AuthPublicError("SESSION_EXPIRED", "Session is expired or invalid");
    }

    if (!this.policy.session.rotateOnResolve) {
      return {
        account: accountRecord.account,
        session: record.session,
        sessionToken,
        rotated: false,
      };
    }

    const nextToken = this.randomToken(this.policy.session.tokenBytes);
    const nextSession = this.createSessionIdentityFor(
      accountRecord.account.accountId,
      record.session,
    );
    await this.sessions.replace(
      tokenHash,
      {
        tokenHash: hashToken(nextToken),
        session: nextSession,
        absoluteExpiresAt: record.absoluteExpiresAt,
        idleExpiresAt: this.futureIso(this.policy.session.idleTtlMs),
      },
      this.nowIso(),
    );

    return {
      account: accountRecord.account,
      session: nextSession,
      sessionToken: nextToken,
      rotated: true,
    };
  }

  async signOut(sessionToken: string): Promise<void> {
    await this.sessions.revoke(hashToken(sessionToken), this.nowIso());
  }

  private createSessionIdentityFor(accountId: string, existing?: SessionIdentity): SessionIdentity {
    const createdAt = this.nowIso();
    const expiresAt = existing?.expiresAt ?? this.futureIso(this.policy.session.absoluteTtlMs);
    return createSessionIdentity({
      sessionId: this.randomIdentifier(16),
      accountId,
      createdAt,
      expiresAt,
    });
  }

  private async hashPassword(
    normalizedUsername: string,
    password: string,
    createdAt: string,
  ): Promise<PasswordCredentialRecord> {
    const salt = this.randomToken(16);
    const derived = await deriveScryptKey(password, salt, SCRYPT_KDF);
    return {
      normalizedUsername,
      passwordHash: derived.toString("base64"),
      passwordSalt: salt,
      passwordKdf: SCRYPT_KDF,
      createdAt,
    };
  }

  private async verifyPassword(
    password: string,
    credential: PasswordCredentialRecord,
  ): Promise<boolean> {
    if (credential.passwordKdf.name !== "scrypt") {
      throw new AuthInternalError("unsupported password KDF");
    }
    const expected = Buffer.from(credential.passwordHash, "base64");
    const actual = await deriveScryptKey(password, credential.passwordSalt, credential.passwordKdf);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private isExpired(record: SessionRecord): boolean {
    const now = this.clock.now().getTime();
    return (
      Date.parse(record.absoluteExpiresAt) <= now ||
      Date.parse(record.idleExpiresAt) <= now ||
      Date.parse(record.session.expiresAt) <= now
    );
  }

  private nowIso(): string {
    return this.clock.now().toISOString();
  }

  private futureIso(offsetMs: number): string {
    return new Date(this.clock.now().getTime() + offsetMs).toISOString();
  }

  private randomToken(byteLength: number): string {
    return Buffer.from(this.random.bytes(byteLength)).toString("base64url");
  }

  /** Opaque ids must start alphanumeric to be valid repository identifiers; base64url may not. */
  private randomIdentifier(byteLength: number): string {
    return Buffer.from(this.random.bytes(byteLength)).toString("hex");
  }
}

export class InMemoryAccountRepository implements AccountRepository {
  private readonly byUsername = new Map<string, AccountRecord>();
  private readonly byAccountId = new Map<string, AccountRecord>();

  async findByNormalizedUsername(normalizedUsername: string): Promise<AccountRecord | undefined> {
    return this.byUsername.get(normalizedUsername);
  }

  async findByAccountId(accountId: string): Promise<AccountRecord | undefined> {
    return this.byAccountId.get(accountId);
  }

  async create(record: AccountRecord): Promise<void> {
    if (this.byUsername.has(record.credential.normalizedUsername)) {
      throw new AuthInternalError("account username already exists");
    }
    if (this.byAccountId.has(record.account.accountId)) {
      throw new AuthInternalError("account id already exists");
    }
    this.byUsername.set(record.credential.normalizedUsername, record);
    this.byAccountId.set(record.account.accountId, record);
  }

  async updateCredential(accountId: string, credential: PasswordCredentialRecord): Promise<void> {
    const current = this.byAccountId.get(accountId);
    if (current === undefined) {
      throw new AuthInternalError("account not found");
    }
    const next = { ...current, credential };
    this.byAccountId.set(accountId, next);
    this.byUsername.set(credential.normalizedUsername, next);
  }

  snapshot(): readonly AccountRecord[] {
    return [...this.byUsername.values()];
  }
}

export interface AuthSqlExecutor {
  execute<R extends AuthSqlRow = AuthSqlRow>(
    sql: string,
    params?: readonly AuthSqlValue[],
  ): Promise<AuthSqlResult<R>>;
}

export interface AuthSqlResult<R extends AuthSqlRow = AuthSqlRow> {
  readonly rows: readonly R[];
  readonly rowCount?: number;
}

export type AuthSqlValue = string | number | null;
export type AuthSqlRow = Record<string, unknown>;
export type AuthSqlDialect = "postgresql" | "sqlite";

export interface SqlAuthRepositoryOptions {
  readonly executor: AuthSqlExecutor;
  readonly dialect: AuthSqlDialect;
}

interface AccountSqlRow extends AuthSqlRow {
  account_id: string;
  normalized_username: string;
  alias_original: string;
  alias_normalized: string;
  status: AccountIdentity["status"];
  account_created_at: string;
  password_hash: string;
  password_salt: string;
  password_kdf_json: string;
  credential_created_at: string;
}

interface SessionSqlRow extends AuthSqlRow {
  token_hash: string;
  session_id: string;
  account_id: string;
  session_created_at: string;
  session_expires_at: string;
  absolute_expires_at: string;
  idle_expires_at: string;
  revoked_at: string | null;
}

export class SqlAccountRepository implements AccountRepository {
  private readonly executor: AuthSqlExecutor;
  private readonly dialect: AuthSqlDialect;

  constructor(options: SqlAuthRepositoryOptions) {
    this.executor = options.executor;
    this.dialect = options.dialect;
  }

  async findByNormalizedUsername(normalizedUsername: string): Promise<AccountRecord | undefined> {
    const result = await this.executor.execute<AccountSqlRow>(
      authSqlFor(
        this.dialect,
        `select account_id, normalized_username, alias_original, alias_normalized, status,
          account_created_at, password_hash, password_salt, password_kdf_json, credential_created_at
         from agorix_accounts
         where normalized_username = ?`,
      ),
      [normalizedUsername],
    );
    return result.rows[0] === undefined ? undefined : accountRowToRecord(result.rows[0]);
  }

  async findByAccountId(accountId: string): Promise<AccountRecord | undefined> {
    const result = await this.executor.execute<AccountSqlRow>(
      authSqlFor(
        this.dialect,
        `select account_id, normalized_username, alias_original, alias_normalized, status,
          account_created_at, password_hash, password_salt, password_kdf_json, credential_created_at
         from agorix_accounts
         where account_id = ?`,
      ),
      [accountId],
    );
    return result.rows[0] === undefined ? undefined : accountRowToRecord(result.rows[0]);
  }

  async create(record: AccountRecord): Promise<void> {
    await this.executor.execute(
      authSqlFor(
        this.dialect,
        `insert into agorix_accounts
          (account_id, normalized_username, alias_original, alias_normalized, status,
           account_created_at, password_hash, password_salt, password_kdf_json, credential_created_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ),
      [
        record.account.accountId,
        record.credential.normalizedUsername,
        record.account.alias.original,
        record.account.alias.normalized,
        record.account.status,
        record.account.createdAt,
        record.credential.passwordHash,
        record.credential.passwordSalt,
        JSON.stringify(record.credential.passwordKdf),
        record.credential.createdAt,
      ],
    );
  }

  async updateCredential(accountId: string, credential: PasswordCredentialRecord): Promise<void> {
    const result = await this.executor.execute(
      authSqlFor(
        this.dialect,
        `update agorix_accounts
         set password_hash = ?, password_salt = ?, password_kdf_json = ?, credential_created_at = ?
         where account_id = ?`,
      ),
      [
        credential.passwordHash,
        credential.passwordSalt,
        JSON.stringify(credential.passwordKdf),
        credential.createdAt,
        accountId,
      ],
    );
    if ((result.rowCount ?? 1) === 0) {
      throw new AuthInternalError("account not found");
    }
  }
}

export class SqlSessionRepository implements SessionRepository {
  private readonly executor: AuthSqlExecutor;
  private readonly dialect: AuthSqlDialect;

  constructor(options: SqlAuthRepositoryOptions) {
    this.executor = options.executor;
    this.dialect = options.dialect;
  }

  async findByTokenHash(tokenHash: string): Promise<SessionRecord | undefined> {
    const result = await this.executor.execute<SessionSqlRow>(
      authSqlFor(
        this.dialect,
        `select token_hash, session_id, account_id, session_created_at, session_expires_at,
          absolute_expires_at, idle_expires_at, revoked_at
         from agorix_sessions
         where token_hash = ?`,
      ),
      [tokenHash],
    );
    return result.rows[0] === undefined ? undefined : sessionRowToRecord(result.rows[0]);
  }

  async create(record: SessionRecord): Promise<void> {
    await this.executor.execute(
      authSqlFor(
        this.dialect,
        `insert into agorix_sessions
          (token_hash, session_id, account_id, session_created_at, session_expires_at,
           absolute_expires_at, idle_expires_at, revoked_at)
         values (?, ?, ?, ?, ?, ?, ?, ?)`,
      ),
      sessionParams(record),
    );
  }

  async replace(
    previousTokenHash: string,
    nextRecord: SessionRecord,
    revokedAt: string,
  ): Promise<void> {
    await this.revoke(previousTokenHash, revokedAt);
    await this.create(nextRecord);
  }

  async revoke(tokenHash: string, revokedAt: string): Promise<void> {
    await this.executor.execute(
      authSqlFor(this.dialect, "update agorix_sessions set revoked_at = ? where token_hash = ?"),
      [revokedAt, tokenHash],
    );
  }
}

export const AUTH_POSTGRESQL_SCHEMA_SQL = `
create table if not exists agorix_accounts (
  account_id text primary key,
  normalized_username text not null unique,
  alias_original text not null,
  alias_normalized text not null,
  status text not null,
  account_created_at text not null,
  password_hash text not null,
  password_salt text not null,
  password_kdf_json text not null,
  credential_created_at text not null
);

create table if not exists agorix_sessions (
  token_hash text primary key,
  session_id text not null,
  account_id text not null references agorix_accounts(account_id),
  session_created_at text not null,
  session_expires_at text not null,
  absolute_expires_at text not null,
  idle_expires_at text not null,
  revoked_at text
);

create index if not exists agorix_sessions_account_idx
  on agorix_sessions (account_id, revoked_at, idle_expires_at);
`;

export const AUTH_SQLITE_SCHEMA_SQL = AUTH_POSTGRESQL_SCHEMA_SQL;

export const AUTH_SERVICE_MIGRATIONS = [
  {
    id: "001_create_auth_accounts_and_sessions",
    postgresql: AUTH_POSTGRESQL_SCHEMA_SQL,
    sqlite: AUTH_SQLITE_SCHEMA_SQL,
  },
] as const;

export class InMemorySessionRepository implements SessionRepository {
  private readonly byTokenHash = new Map<string, SessionRecord>();

  async findByTokenHash(tokenHash: string): Promise<SessionRecord | undefined> {
    return this.byTokenHash.get(tokenHash);
  }

  async create(record: SessionRecord): Promise<void> {
    this.byTokenHash.set(record.tokenHash, record);
  }

  async replace(
    previousTokenHash: string,
    nextRecord: SessionRecord,
    revokedAt: string,
  ): Promise<void> {
    const previous = this.byTokenHash.get(previousTokenHash);
    if (previous !== undefined) {
      this.byTokenHash.set(previousTokenHash, {
        ...previous,
        revokedAt,
      });
    }
    this.byTokenHash.set(nextRecord.tokenHash, nextRecord);
  }

  async revoke(tokenHash: string, revokedAt: string): Promise<void> {
    const previous = this.byTokenHash.get(tokenHash);
    if (previous !== undefined) {
      this.byTokenHash.set(tokenHash, { ...previous, revokedAt });
    }
  }

  snapshot(): readonly SessionRecord[] {
    return [...this.byTokenHash.values()];
  }
}

class InMemoryRateLimiter {
  private readonly buckets = new Map<string, { readonly resetAt: number; attempts: number }>();

  constructor(private readonly clock: Clock) {}

  requireAllowed(key: string, policy: RateLimitPolicy): void {
    const now = this.clock.now().getTime();
    const bucket = this.buckets.get(key);
    if (bucket === undefined || bucket.resetAt <= now) {
      this.buckets.set(key, { attempts: 1, resetAt: now + policy.windowMs });
      return;
    }
    if (bucket.attempts >= policy.maxAttempts) {
      throw new AuthPublicError("RATE_LIMITED", "Too many attempts; try again later");
    }
    bucket.attempts += 1;
  }
}

function validatePassword(password: string, policy: PasswordPolicy): void {
  if (password.length < policy.minLength || password.length > policy.maxLength) {
    throw new AuthPublicError(
      "PASSWORD_POLICY_VIOLATION",
      `Password must be ${policy.minLength}-${policy.maxLength} characters`,
    );
  }
}

function mergePolicy(policy?: PartialAuthServicePolicy): AuthServicePolicy {
  return {
    password: { ...DEFAULT_POLICY.password, ...policy?.password },
    registerRateLimit: { ...DEFAULT_POLICY.registerRateLimit, ...policy?.registerRateLimit },
    signInRateLimit: { ...DEFAULT_POLICY.signInRateLimit, ...policy?.signInRateLimit },
    session: { ...DEFAULT_POLICY.session, ...policy?.session },
  };
}

function passwordKdfRequiresRehash(kdf: PasswordKdfRecord): boolean {
  return (
    kdf.name !== SCRYPT_KDF.name ||
    kdf.keyLength !== SCRYPT_KDF.keyLength ||
    kdf.cost !== SCRYPT_KDF.cost ||
    kdf.blockSize !== SCRYPT_KDF.blockSize ||
    kdf.parallelization !== SCRYPT_KDF.parallelization
  );
}

async function deriveScryptKey(
  password: string,
  salt: string,
  kdf: PasswordKdfRecord,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      kdf.keyLength,
      {
        N: kdf.cost,
        r: kdf.blockSize,
        p: kdf.parallelization,
      },
      (error, derived) => {
        if (error !== null) {
          reject(error);
          return;
        }
        resolve(derived);
      },
    );
  });
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("base64url");
}

function authSqlFor(dialect: AuthSqlDialect, sql: string): string {
  const normalized = sql.replace(/\s+/g, " ").trim();
  if (dialect === "sqlite") {
    return normalized;
  }
  let parameterIndex = 0;
  return normalized.replace(/\?/g, () => `$${++parameterIndex}`);
}

function accountRowToRecord(row: AccountSqlRow): AccountRecord {
  return {
    account: createAccountIdentity({
      accountId: row.account_id,
      alias: row.alias_original,
      status: row.status,
      createdAt: row.account_created_at,
    }),
    credential: {
      normalizedUsername: row.normalized_username,
      passwordHash: row.password_hash,
      passwordSalt: row.password_salt,
      passwordKdf: parsePasswordKdf(row.password_kdf_json),
      createdAt: row.credential_created_at,
    },
  };
}

function sessionRowToRecord(row: SessionSqlRow): SessionRecord {
  return {
    tokenHash: row.token_hash,
    session: createSessionIdentity({
      sessionId: row.session_id,
      accountId: row.account_id,
      createdAt: row.session_created_at,
      expiresAt: row.session_expires_at,
    }),
    absoluteExpiresAt: row.absolute_expires_at,
    idleExpiresAt: row.idle_expires_at,
    ...(row.revoked_at === null ? {} : { revokedAt: row.revoked_at }),
  };
}

function sessionParams(record: SessionRecord): readonly AuthSqlValue[] {
  return [
    record.tokenHash,
    record.session.sessionId,
    record.session.accountId,
    record.session.createdAt,
    record.session.expiresAt,
    record.absoluteExpiresAt,
    record.idleExpiresAt,
    record.revokedAt ?? null,
  ];
}

function parsePasswordKdf(raw: string): PasswordKdfRecord {
  const parsed = JSON.parse(raw) as PasswordKdfRecord;
  if (
    parsed.name !== "scrypt" ||
    !Number.isInteger(parsed.keyLength) ||
    !Number.isInteger(parsed.cost) ||
    !Number.isInteger(parsed.blockSize) ||
    !Number.isInteger(parsed.parallelization)
  ) {
    throw new AuthInternalError("invalid password KDF record");
  }
  return parsed;
}
