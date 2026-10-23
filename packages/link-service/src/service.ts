import { createHash, createHmac, randomBytes } from "node:crypto";
import { normalizeEmail } from "./email.js";
import { parseLinkSummary, type LinkSummary } from "./summary.js";
import {
  DEFAULT_LINK_POLICY,
  LinkError,
  NoopMailer,
  type Clock,
  type LinkPolicy,
  type LinkRepository,
  type Mailer,
  type RandomSource,
} from "./types.js";

export interface LinkServiceOptions {
  readonly repository: LinkRepository;
  /** HMAC key for link codes; at least 32 characters, from the environment, never logged. */
  readonly secret: string;
  readonly mailer?: Mailer;
  readonly policy?: Partial<LinkPolicy>;
  readonly clock?: Clock;
  readonly random?: RandomSource;
}

export interface CreatedLinkCode {
  readonly code: string;
  readonly expiresAt: string;
}

export interface RedeemedLink {
  readonly linkId: string;
  readonly deviceToken: string;
  readonly expiresAt: string;
}

export interface ResolvedDevice {
  readonly linkId: string;
  readonly accountId: string;
  readonly syncEnabled: boolean;
  /** Always a fresh token: the device must store it and drop the one it sent. */
  readonly deviceToken: string;
}

export interface LinkedDeviceView {
  readonly linkId: string;
  readonly createdAt: string;
  readonly lastSeenDay: string;
  readonly syncEnabled: boolean;
  readonly unlinkedAt?: string;
  /** Present once unlinked: when the stored summary is deleted. */
  readonly summaryDeletesAt?: string;
}

export interface DeviceSummaryView {
  readonly linkId: string;
  readonly updatedAt: string;
  readonly summary: LinkSummary;
}

interface Window {
  count: number;
  resetAt: number;
}

export class LinkService {
  private readonly repo: LinkRepository;
  private readonly secret: string;
  private readonly mailer: Mailer;
  private readonly policy: LinkPolicy;
  private readonly clock: Clock;
  private readonly random: RandomSource;
  private readonly sourceFailures = new Map<string, Window>();
  private globalFailures: Window = { count: 0, resetAt: 0 };

  constructor(options: LinkServiceOptions) {
    if (options.secret.length < 32) throw new Error("link secret must be at least 32 characters");
    this.repo = options.repository;
    this.secret = options.secret;
    this.mailer = options.mailer ?? new NoopMailer();
    this.policy = { ...DEFAULT_LINK_POLICY, ...options.policy };
    this.clock = options.clock ?? { now: () => new Date() };
    this.random = options.random ?? { bytes: (length) => randomBytes(length) };
  }

  // ---- adult email -------------------------------------------------------------------------

  /**
   * Attach (or change) the adult's email and send a verification message. The answer is the same
   * whether or not the address belongs to someone else, so nothing here confirms an address exists.
   */
  async addEmail(accountId: string, rawEmail: string): Promise<void> {
    const email = normalizeEmail(rawEmail);
    await this.requireEmailBudget(accountId);
    const owner = await this.repo.findEmailOwner(email);
    if (owner !== undefined && owner !== accountId) {
      await this.mailer.send({ kind: "email-in-use", to: email });
      return;
    }
    const existing = await this.repo.getEmail(accountId);
    if (existing === undefined || existing.emailNormalized !== email) {
      await this.repo.setEmail({ accountId, emailNormalized: email, createdAt: this.nowIso() });
    }
    await this.issueVerification(accountId, email);
  }

  /** Re-send for the current address, limited by cooldown and an hourly budget. */
  async resendVerification(accountId: string): Promise<void> {
    const row = await this.repo.getEmail(accountId);
    if (row === undefined || row.verifiedAt !== undefined) return;
    await this.requireEmailBudget(accountId);
    await this.issueVerification(accountId, row.emailNormalized);
  }

  async verifyEmail(token: string): Promise<void> {
    const hash = this.sha256(token);
    const row = await this.repo.getVerification(hash);
    if (row === undefined || row.usedAt !== undefined || row.expiresAt <= this.nowIso()) {
      throw invalid();
    }
    if (!(await this.repo.useVerification(hash, this.nowIso()))) throw invalid();
    const current = await this.repo.getEmail(row.accountId);
    if (current === undefined || current.emailNormalized !== row.emailNormalized) throw invalid();
    await this.repo.markEmailVerified(row.accountId, row.emailNormalized, this.nowIso());
  }

  async emailStatus(accountId: string): Promise<{ present: boolean; verified: boolean }> {
    const row = await this.repo.getEmail(accountId);
    return { present: row !== undefined, verified: row?.verifiedAt !== undefined };
  }

  // ---- link codes --------------------------------------------------------------------------

  /** Needs a verified email. At most N live codes per account; the oldest is revoked first. */
  async createLinkCode(accountId: string): Promise<CreatedLinkCode> {
    const email = await this.repo.getEmail(accountId);
    if (email?.verifiedAt === undefined) {
      throw new LinkError("EMAIL_NOT_VERIFIED", "Verify your email first");
    }
    const now = this.nowIso();
    const live = await this.repo.listLiveCodes(accountId, now);
    const excess = live.length - (this.policy.maxLiveCodesPerAccount - 1);
    for (const old of live.slice(0, Math.max(0, excess))) {
      await this.repo.revokeCode(old.codeHash, now);
    }
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const code = this.randomDigits(6);
      const codeHash = this.codeHash(code);
      // The code is the only thing the child types, so no two live codes may share a hash.
      if ((await this.repo.findLiveCode(codeHash, now)) !== undefined) continue;
      const expiresAt = this.futureIso(this.policy.codeTtlMs);
      await this.repo.putCode({ codeHash, accountId, createdAt: now, expiresAt });
      return { code, expiresAt };
    }
    throw new LinkError("RATE_LIMITED", "Try again in a moment");
  }

  async revokeLinkCodes(accountId: string): Promise<void> {
    const now = this.nowIso();
    for (const row of await this.repo.listLiveCodes(accountId, now)) {
      await this.repo.revokeCode(row.codeHash, now);
    }
  }

  /**
   * `sourceKey` is an opaque, already-hashed identifier of the caller (never an IP address).
   * Only failures count, so a family linking a tablet is never throttled by its own success.
   */
  async redeemLinkCode(code: string, sourceKey: string): Promise<RedeemedLink> {
    this.requireRedeemBudget(sourceKey);
    if (typeof code !== "string" || !/^\d{6}$/.test(code)) {
      this.recordRedeemFailure(sourceKey);
      throw invalid();
    }
    const now = this.nowIso();
    const row = await this.repo.findLiveCode(this.codeHash(code), now);
    if (row === undefined || !(await this.repo.markCodeUsed(row.codeHash, now))) {
      this.recordRedeemFailure(sourceKey);
      throw invalid();
    }
    const email = await this.repo.getEmail(row.accountId);
    if (email?.verifiedAt === undefined) throw invalid();

    const linkId = this.randomHex(16);
    await this.repo.createLink({
      linkId,
      accountId: row.accountId,
      createdAt: now,
      lastSeenDay: now.slice(0, 10),
      syncEnabled: true,
    });
    const absoluteExpiresAt = this.futureIso(this.policy.deviceTokenAbsoluteTtlMs);
    const deviceToken = await this.issueToken(linkId, absoluteExpiresAt);
    return { linkId, deviceToken, expiresAt: absoluteExpiresAt };
  }

  // ---- device tokens -----------------------------------------------------------------------

  /** Validates the token and rotates it. Revoked, expired and unknown tokens fail identically. */
  async resolveDevice(token: string): Promise<ResolvedDevice> {
    const hash = this.sha256(token);
    const row = await this.repo.getToken(hash);
    const now = this.nowIso();
    if (row === undefined || row.revokedAt !== undefined) throw invalid();
    if (row.absoluteExpiresAt <= now || row.idleExpiresAt <= now) throw invalid();
    if (
      row.replacedAt !== undefined &&
      Date.parse(row.replacedAt) + this.policy.deviceTokenGraceMs <= this.clock.now().getTime()
    ) {
      throw invalid();
    }
    const link = await this.repo.getLink(row.linkId);
    if (link === undefined || link.revokedAt !== undefined) throw invalid();

    if (row.replacedAt === undefined) await this.repo.updateToken(hash, { replacedAt: now });
    const deviceToken = await this.issueToken(row.linkId, row.absoluteExpiresAt);
    await this.repo.deleteReplacedTokens(
      row.linkId,
      new Date(this.clock.now().getTime() - this.policy.deviceTokenGraceMs).toISOString(),
    );
    await this.repo.updateLink(row.linkId, { lastSeenDay: now.slice(0, 10) });
    return {
      linkId: row.linkId,
      accountId: link.accountId,
      syncEnabled: link.syncEnabled,
      deviceToken,
    };
  }

  /** The device unlinks itself. Summaries stay for the retention period. */
  async unlinkDevice(token: string): Promise<void> {
    const hash = this.sha256(token);
    const row = await this.repo.getToken(hash);
    if (row === undefined || row.revokedAt !== undefined) throw invalid();
    const link = await this.repo.getLink(row.linkId);
    if (link === undefined || link.revokedAt !== undefined) throw invalid();
    await this.revokeLinkInternal(row.linkId);
  }

  /** The adult unlinks one of their own devices. */
  async unlinkLink(accountId: string, linkId: string): Promise<void> {
    const link = await this.repo.getLink(linkId);
    if (link === undefined || link.accountId !== accountId) {
      throw new LinkError("NOT_FOUND", "Not found");
    }
    await this.revokeLinkInternal(linkId);
  }

  async setSyncEnabled(accountId: string, linkId: string, enabled: boolean): Promise<void> {
    const link = await this.repo.getLink(linkId);
    if (link === undefined || link.accountId !== accountId || link.revokedAt !== undefined) {
      throw new LinkError("NOT_FOUND", "Not found");
    }
    await this.repo.updateLink(linkId, { syncEnabled: enabled });
  }

  async listDevices(accountId: string): Promise<readonly LinkedDeviceView[]> {
    const links = await this.repo.listLinks(accountId);
    return links.map((link) => ({
      linkId: link.linkId,
      createdAt: link.createdAt,
      lastSeenDay: link.lastSeenDay,
      syncEnabled: link.syncEnabled,
      ...(link.revokedAt === undefined
        ? {}
        : {
            unlinkedAt: link.revokedAt,
            summaryDeletesAt: new Date(
              Date.parse(link.revokedAt) + this.policy.retentionAfterUnlinkMs,
            ).toISOString(),
          }),
    }));
  }

  // ---- summaries ---------------------------------------------------------------------------

  /** Returns false (and stores nothing) when the adult switched sync off for this device. */
  async putSummary(linkId: string, input: unknown): Promise<boolean> {
    const link = await this.repo.getLink(linkId);
    if (link === undefined || link.revokedAt !== undefined) throw invalid();
    const summary = parseLinkSummary(input);
    if (!link.syncEnabled) return false;
    await this.repo.putSummary({
      linkId,
      json: JSON.stringify(summary),
      updatedAt: this.nowIso(),
    });
    return true;
  }

  async getSummaries(accountId: string): Promise<readonly DeviceSummaryView[]> {
    const views: DeviceSummaryView[] = [];
    for (const link of await this.repo.listLinks(accountId)) {
      const row = await this.repo.getSummary(link.linkId);
      if (row !== undefined) {
        views.push({
          linkId: link.linkId,
          updatedAt: row.updatedAt,
          summary: parseLinkSummary(JSON.parse(row.json)),
        });
      }
    }
    return views;
  }

  // ---- retention and deletion --------------------------------------------------------------

  /** Deletes unlinked devices (and their summaries) older than the retention period. Idempotent. */
  async purgeExpired(): Promise<{ purgedLinks: number }> {
    const cutoff = new Date(this.clock.now().getTime() - this.policy.retentionAfterUnlinkMs);
    const ids = await this.repo.listRevokedLinksBefore(cutoff.toISOString());
    for (const id of ids) await this.repo.deleteLinkData(id);
    return { purgedLinks: ids.length };
  }

  /** Account deletion: everything this service holds for the adult goes at once. */
  async deleteAccountData(accountId: string): Promise<void> {
    await this.repo.deleteAccountData(accountId);
  }

  // ---- internals ---------------------------------------------------------------------------

  private async revokeLinkInternal(linkId: string): Promise<void> {
    const now = this.nowIso();
    await this.repo.updateLink(linkId, { revokedAt: now });
    await this.repo.revokeTokensForLink(linkId, now);
  }

  private async issueToken(linkId: string, absoluteExpiresAt: string): Promise<string> {
    const token = Buffer.from(this.random.bytes(32)).toString("base64url");
    await this.repo.putToken({
      tokenHash: this.sha256(token),
      linkId,
      createdAt: this.nowIso(),
      absoluteExpiresAt,
      idleExpiresAt: this.futureIso(this.policy.deviceTokenIdleTtlMs),
    });
    return token;
  }

  private async issueVerification(accountId: string, email: string): Promise<void> {
    const token = Buffer.from(this.random.bytes(32)).toString("base64url");
    await this.repo.putVerification({
      tokenHash: this.sha256(token),
      accountId,
      emailNormalized: email,
      createdAt: this.nowIso(),
      expiresAt: this.futureIso(this.policy.emailTokenTtlMs),
    });
    await this.mailer.send({ kind: "verify-email", to: email, token });
  }

  private async requireEmailBudget(accountId: string): Promise<void> {
    const last = await this.repo.lastVerificationAt(accountId);
    if (
      last !== undefined &&
      Date.parse(last) + this.policy.emailResendCooldownMs > this.clock.now().getTime()
    ) {
      throw new LinkError("RATE_LIMITED", "Try again in a moment");
    }
    const hourAgo = new Date(this.clock.now().getTime() - 60 * 60 * 1000).toISOString();
    if (
      (await this.repo.countVerificationsSince(accountId, hourAgo)) >= this.policy.emailSendsPerHour
    ) {
      throw new LinkError("RATE_LIMITED", "Try again in a moment");
    }
  }

  private requireRedeemBudget(sourceKey: string): void {
    const now = this.clock.now().getTime();
    const source = this.sourceFailures.get(sourceKey);
    if (
      source !== undefined &&
      source.resetAt > now &&
      source.count >= this.policy.redeemFailuresPerSource
    ) {
      throw new LinkError("RATE_LIMITED", "Try again later");
    }
    if (
      this.globalFailures.resetAt > now &&
      this.globalFailures.count >= this.policy.redeemFailuresGlobal
    ) {
      throw new LinkError("RATE_LIMITED", "Try again later");
    }
  }

  private recordRedeemFailure(sourceKey: string): void {
    const now = this.clock.now().getTime();
    const bump = (window: Window | undefined): Window =>
      window === undefined || window.resetAt <= now
        ? { count: 1, resetAt: now + this.policy.redeemWindowMs }
        : { count: window.count + 1, resetAt: window.resetAt };
    this.sourceFailures.set(sourceKey, bump(this.sourceFailures.get(sourceKey)));
    this.globalFailures = bump(this.globalFailures);
    if (this.sourceFailures.size > 10_000) {
      for (const [key, window] of this.sourceFailures) {
        if (window.resetAt <= now) this.sourceFailures.delete(key);
      }
    }
  }

  /** Uniform in 0..999999 without modulo bias. */
  private randomDigits(length: number): string {
    const max = 10 ** length;
    const limit = Math.floor(2 ** 32 / max) * max;
    for (;;) {
      const bytes = this.random.bytes(4);
      const value =
        ((bytes[0] ?? 0) * 2 ** 24 +
          (bytes[1] ?? 0) * 2 ** 16 +
          (bytes[2] ?? 0) * 2 ** 8 +
          (bytes[3] ?? 0)) >>>
        0;
      if (value < limit) return String(value % max).padStart(length, "0");
    }
  }

  private codeHash(code: string): string {
    return createHmac("sha256", this.secret)
      .update(`link-code:${code}`, "utf8")
      .digest("base64url");
  }

  private sha256(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("base64url");
  }

  private randomHex(length: number): string {
    return Buffer.from(this.random.bytes(length)).toString("hex");
  }

  private nowIso(): string {
    return this.clock.now().toISOString();
  }

  private futureIso(offsetMs: number): string {
    return new Date(this.clock.now().getTime() + offsetMs).toISOString();
  }
}

function invalid(): LinkError {
  return new LinkError("INVALID_OR_EXPIRED", "Invalid or expired");
}
