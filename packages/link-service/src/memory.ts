import type {
  CodeRow,
  EmailRow,
  LinkRepository,
  LinkRow,
  SummaryRow,
  TokenRow,
  VerificationRow,
} from "./types.js";

/** Reference implementation: the SQL repository must behave the same. */
export class InMemoryLinkRepository implements LinkRepository {
  private emails = new Map<string, EmailRow>();
  private verifications = new Map<string, VerificationRow>();
  private codes = new Map<string, CodeRow>();
  private links = new Map<string, LinkRow>();
  private tokens = new Map<string, TokenRow>();
  private summaries = new Map<string, SummaryRow>();
  private redeemFailures = new Map<string, { count: number; resetAt: number }>();

  async getRedeemFailureWindows(sourceKey: string, nowMs: number) {
    return ["global", `source:${sourceKey}`].flatMap((scopeKey) => {
      const window = this.redeemFailures.get(scopeKey);
      return window !== undefined && window.resetAt > nowMs ? [{ scopeKey, ...window }] : [];
    });
  }
  async recordRedeemFailure(sourceKey: string, nowMs: number, windowMs: number) {
    for (const scopeKey of ["global", `source:${sourceKey}`]) {
      const old = this.redeemFailures.get(scopeKey);
      this.redeemFailures.set(
        scopeKey,
        old === undefined || old.resetAt <= nowMs
          ? { count: 1, resetAt: nowMs + windowMs }
          : { count: old.count + 1, resetAt: old.resetAt },
      );
    }
  }
  async sweepRedeemFailureWindows(nowMs: number) {
    for (const [key, window] of this.redeemFailures)
      if (window.resetAt <= nowMs) this.redeemFailures.delete(key);
  }

  async getEmail(accountId: string) {
    return this.emails.get(accountId);
  }
  async findEmailOwner(emailNormalized: string) {
    for (const row of this.emails.values()) {
      if (row.emailNormalized === emailNormalized) return row.accountId;
    }
    return undefined;
  }
  async setEmail(row: EmailRow) {
    this.emails.set(row.accountId, row);
  }
  async markEmailVerified(accountId: string, emailNormalized: string, at: string) {
    const row = this.emails.get(accountId);
    if (row === undefined || row.emailNormalized !== emailNormalized) return false;
    this.emails.set(accountId, { ...row, verifiedAt: at });
    return true;
  }
  async putVerification(row: VerificationRow) {
    this.verifications.set(row.tokenHash, row);
  }
  async getVerification(tokenHash: string) {
    return this.verifications.get(tokenHash);
  }
  async useVerification(tokenHash: string, at: string) {
    const row = this.verifications.get(tokenHash);
    if (row === undefined || row.usedAt !== undefined) return false;
    this.verifications.set(tokenHash, { ...row, usedAt: at });
    return true;
  }
  async countVerificationsSince(accountId: string, sinceIso: string) {
    return [...this.verifications.values()].filter(
      (row) => row.accountId === accountId && row.createdAt >= sinceIso,
    ).length;
  }
  async lastVerificationAt(accountId: string) {
    return [...this.verifications.values()]
      .filter((row) => row.accountId === accountId)
      .map((row) => row.createdAt)
      .sort()
      .at(-1);
  }

  async putCode(row: CodeRow) {
    this.codes.set(row.codeHash, row);
  }
  async findLiveCode(codeHash: string, nowIso: string) {
    const row = this.codes.get(codeHash);
    return row !== undefined &&
      row.usedAt === undefined &&
      row.revokedAt === undefined &&
      row.expiresAt > nowIso
      ? row
      : undefined;
  }
  async listLiveCodes(accountId: string, nowIso: string) {
    return [...this.codes.values()]
      .filter(
        (row) =>
          row.accountId === accountId &&
          row.usedAt === undefined &&
          row.revokedAt === undefined &&
          row.expiresAt > nowIso,
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async markCodeUsed(codeHash: string, at: string) {
    const row = this.codes.get(codeHash);
    if (row === undefined || row.usedAt !== undefined || row.revokedAt !== undefined) return false;
    this.codes.set(codeHash, { ...row, usedAt: at });
    return true;
  }
  async revokeCode(codeHash: string, at: string) {
    const row = this.codes.get(codeHash);
    if (row !== undefined) this.codes.set(codeHash, { ...row, revokedAt: at });
  }

  async createLink(row: LinkRow) {
    this.links.set(row.linkId, row);
  }
  async getLink(linkId: string) {
    return this.links.get(linkId);
  }
  async listLinks(accountId: string) {
    return [...this.links.values()]
      .filter((row) => row.accountId === accountId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async updateLink(
    linkId: string,
    change: { lastSeenDay?: string; syncEnabled?: boolean; revokedAt?: string },
  ) {
    const row = this.links.get(linkId);
    if (row === undefined) return;
    this.links.set(linkId, {
      ...row,
      ...(change.lastSeenDay === undefined ? {} : { lastSeenDay: change.lastSeenDay }),
      ...(change.syncEnabled === undefined ? {} : { syncEnabled: change.syncEnabled }),
      ...(change.revokedAt === undefined ? {} : { revokedAt: change.revokedAt }),
    });
  }

  async putToken(row: TokenRow) {
    this.tokens.set(row.tokenHash, row);
  }
  async getToken(tokenHash: string) {
    return this.tokens.get(tokenHash);
  }
  async updateToken(tokenHash: string, change: { replacedAt?: string; revokedAt?: string }) {
    const row = this.tokens.get(tokenHash);
    if (row === undefined) return;
    this.tokens.set(tokenHash, {
      ...row,
      ...(change.replacedAt === undefined ? {} : { replacedAt: change.replacedAt }),
      ...(change.revokedAt === undefined ? {} : { revokedAt: change.revokedAt }),
    });
  }
  async revokeTokensForLink(linkId: string, at: string) {
    for (const [hash, row] of this.tokens) {
      if (row.linkId === linkId && row.revokedAt === undefined) {
        this.tokens.set(hash, { ...row, revokedAt: at });
      }
    }
  }

  async deleteReplacedTokens(linkId: string, replacedBeforeIso: string) {
    for (const [hash, row] of this.tokens) {
      if (
        row.linkId === linkId &&
        row.replacedAt !== undefined &&
        row.replacedAt < replacedBeforeIso
      ) {
        this.tokens.delete(hash);
      }
    }
  }

  async putSummary(row: SummaryRow) {
    this.summaries.set(row.linkId, row);
  }
  async getSummary(linkId: string) {
    return this.summaries.get(linkId);
  }

  async listRevokedLinksBefore(revokedBeforeIso: string) {
    return [...this.links.values()]
      .filter((row) => row.revokedAt !== undefined && row.revokedAt < revokedBeforeIso)
      .map((row) => row.linkId);
  }
  async deleteLinkData(linkId: string) {
    this.summaries.delete(linkId);
    for (const [hash, row] of this.tokens) if (row.linkId === linkId) this.tokens.delete(hash);
    this.links.delete(linkId);
  }
  async deleteAccountData(accountId: string) {
    for (const row of [...this.links.values()]) {
      if (row.accountId === accountId) await this.deleteLinkData(row.linkId);
    }
    this.emails.delete(accountId);
    for (const [hash, row] of this.verifications) {
      if (row.accountId === accountId) this.verifications.delete(hash);
    }
    for (const [hash, row] of this.codes) if (row.accountId === accountId) this.codes.delete(hash);
  }

  /** Test helper: count of rows still stored for an account. */
  rowCountFor(accountId: string): number {
    const linkIds = new Set(
      [...this.links.values()]
        .filter((row) => row.accountId === accountId)
        .map((row) => row.linkId),
    );
    return (
      (this.emails.has(accountId) ? 1 : 0) +
      [...this.verifications.values()].filter((row) => row.accountId === accountId).length +
      [...this.codes.values()].filter((row) => row.accountId === accountId).length +
      linkIds.size +
      [...this.tokens.values()].filter((row) => linkIds.has(row.linkId)).length +
      [...this.summaries.values()].filter((row) => linkIds.has(row.linkId)).length
    );
  }
}
