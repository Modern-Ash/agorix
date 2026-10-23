export interface Clock {
  now(): Date;
}

export interface RandomSource {
  bytes(length: number): Uint8Array;
}

/** Delivery is injected. The service never logs a message body or a token. */
export type MailMessage =
  | { readonly kind: "verify-email"; readonly to: string; readonly token: string }
  | { readonly kind: "email-in-use"; readonly to: string };

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export class NoopMailer implements Mailer {
  async send(): Promise<void> {
    // Intentionally drops everything: used until a real provider is configured.
  }
}

export type LinkErrorCode =
  | "INVALID_EMAIL"
  | "EMAIL_NOT_VERIFIED"
  | "INVALID_OR_EXPIRED"
  | "RATE_LIMITED"
  | "INVALID_SUMMARY"
  | "NOT_FOUND";

/** Public, generic failures only. The message never says which field or value was wrong. */
export class LinkError extends Error {
  constructor(
    readonly code: LinkErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LinkError";
  }
}

export interface LinkPolicy {
  readonly emailTokenTtlMs: number;
  readonly emailResendCooldownMs: number;
  readonly emailSendsPerHour: number;
  readonly codeTtlMs: number;
  readonly maxLiveCodesPerAccount: number;
  /** Failed redemptions allowed per source and per whole server inside the window. */
  readonly redeemFailuresPerSource: number;
  readonly redeemFailuresGlobal: number;
  readonly redeemWindowMs: number;
  readonly deviceTokenAbsoluteTtlMs: number;
  readonly deviceTokenIdleTtlMs: number;
  /** A rotated token keeps working briefly so a lost response does not strand the device. */
  readonly deviceTokenGraceMs: number;
  readonly retentionAfterUnlinkMs: number;
}

export const DEFAULT_LINK_POLICY: LinkPolicy = {
  emailTokenTtlMs: 24 * 60 * 60 * 1000,
  emailResendCooldownMs: 60 * 1000,
  emailSendsPerHour: 5,
  codeTtlMs: 10 * 60 * 1000,
  maxLiveCodesPerAccount: 3,
  redeemFailuresPerSource: 10,
  redeemFailuresGlobal: 200,
  redeemWindowMs: 10 * 60 * 1000,
  deviceTokenAbsoluteTtlMs: 180 * 24 * 60 * 60 * 1000,
  deviceTokenIdleTtlMs: 60 * 24 * 60 * 60 * 1000,
  deviceTokenGraceMs: 60 * 1000,
  retentionAfterUnlinkMs: 30 * 24 * 60 * 60 * 1000,
};

export interface EmailRow {
  readonly accountId: string;
  readonly emailNormalized: string;
  readonly createdAt: string;
  readonly verifiedAt?: string;
}

export interface VerificationRow {
  readonly tokenHash: string;
  readonly accountId: string;
  readonly emailNormalized: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly usedAt?: string;
}

export interface CodeRow {
  readonly codeHash: string;
  readonly accountId: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly usedAt?: string;
  readonly revokedAt?: string;
}

export interface LinkRow {
  readonly linkId: string;
  readonly accountId: string;
  readonly createdAt: string;
  /** UTC calendar day only (YYYY-MM-DD): no time, IP or device description is kept. */
  readonly lastSeenDay: string;
  readonly syncEnabled: boolean;
  readonly revokedAt?: string;
}

export interface TokenRow {
  readonly tokenHash: string;
  readonly linkId: string;
  readonly createdAt: string;
  readonly absoluteExpiresAt: string;
  readonly idleExpiresAt: string;
  readonly replacedAt?: string;
  readonly revokedAt?: string;
}

export interface SummaryRow {
  readonly linkId: string;
  readonly json: string;
  readonly updatedAt: string;
}

/** Storage boundary. Every method is small so the SQL and in-memory versions stay in step. */
export interface LinkRepository {
  getEmail(accountId: string): Promise<EmailRow | undefined>;
  findEmailOwner(emailNormalized: string): Promise<string | undefined>;
  setEmail(row: EmailRow): Promise<void>;
  markEmailVerified(accountId: string, emailNormalized: string, at: string): Promise<boolean>;
  putVerification(row: VerificationRow): Promise<void>;
  getVerification(tokenHash: string): Promise<VerificationRow | undefined>;
  /** Atomic: false when it was already used. */
  useVerification(tokenHash: string, at: string): Promise<boolean>;
  countVerificationsSince(accountId: string, sinceIso: string): Promise<number>;
  lastVerificationAt(accountId: string): Promise<string | undefined>;

  putCode(row: CodeRow): Promise<void>;
  findLiveCode(codeHash: string, nowIso: string): Promise<CodeRow | undefined>;
  listLiveCodes(accountId: string, nowIso: string): Promise<readonly CodeRow[]>;
  /** Atomic: false when it was already used or revoked. */
  markCodeUsed(codeHash: string, at: string): Promise<boolean>;
  revokeCode(codeHash: string, at: string): Promise<void>;

  createLink(row: LinkRow): Promise<void>;
  getLink(linkId: string): Promise<LinkRow | undefined>;
  listLinks(accountId: string): Promise<readonly LinkRow[]>;
  updateLink(
    linkId: string,
    change: { lastSeenDay?: string; syncEnabled?: boolean; revokedAt?: string },
  ): Promise<void>;

  putToken(row: TokenRow): Promise<void>;
  getToken(tokenHash: string): Promise<TokenRow | undefined>;
  updateToken(
    tokenHash: string,
    change: { replacedAt?: string; revokedAt?: string },
  ): Promise<void>;
  revokeTokensForLink(linkId: string, at: string): Promise<void>;
  /** Housekeeping: tokens replaced before this instant are past their grace and can go. */
  deleteReplacedTokens(linkId: string, replacedBeforeIso: string): Promise<void>;

  putSummary(row: SummaryRow): Promise<void>;
  getSummary(linkId: string): Promise<SummaryRow | undefined>;

  listRevokedLinksBefore(revokedBeforeIso: string): Promise<readonly string[]>;
  deleteLinkData(linkId: string): Promise<void>;
  deleteAccountData(accountId: string): Promise<void>;
}
