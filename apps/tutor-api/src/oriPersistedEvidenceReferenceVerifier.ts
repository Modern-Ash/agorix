import { createHash, timingSafeEqual } from "node:crypto";
import type { OriVerifiedEvidenceResolver } from "./oriVerifiedReviewRecorder.js";

export interface OriEvidenceReferenceRecord {
  readonly reviewId: string;
  readonly evidenceDigest: string;
  readonly missionId: string;
  readonly key: string;
  readonly reference: string;
  readonly sha256: string;
}
export interface OriEvidenceReferenceRepository {
  find(
    reviewId: string,
    digest: string,
    missionId: string,
    key: string,
  ): Promise<OriEvidenceReferenceRecord | null>;
  read(reference: string): Promise<Uint8Array | null>;
}
const HEX = /^[a-f0-9]{64}$/;

/**
 * Server-side evidence reference verification. The trusted repository resolves
 * only scoped, previously stored artifacts; no client-supplied URL is fetched.
 */
export function createOriPersistedEvidenceReferenceVerifier(
  repository: OriEvidenceReferenceRepository,
): OriVerifiedEvidenceResolver {
  return Object.freeze({
    async verify(
      reviewId: string,
      digest: string,
      missionId: string,
      refs: Readonly<Record<string, string>>,
    ): Promise<boolean> {
      if (
        !reviewId ||
        !missionId ||
        !HEX.test(digest) ||
        !refs ||
        typeof refs !== "object" ||
        Array.isArray(refs)
      )
        return false;
      const entries = Object.entries(refs);
      if (entries.length === 0 || entries.length > 16) return false;
      try {
        for (const [key, reference] of entries) {
          if (
            !/^[a-z][a-z0-9-]{0,63}$/.test(key) ||
            typeof reference !== "string" ||
            reference.length > 512 ||
            !/^artifact:[a-zA-Z0-9/_-]{1,160}$/.test(reference)
          )
            return false;
          const record = await repository.find(reviewId, digest, missionId, key);
          if (
            !record ||
            record.reviewId !== reviewId ||
            record.evidenceDigest !== digest ||
            record.missionId !== missionId ||
            record.key !== key ||
            record.reference !== reference ||
            !HEX.test(record.sha256)
          )
            return false;
          const bytes = await repository.read(record.reference);
          if (!bytes || bytes.byteLength === 0 || bytes.byteLength > 1_048_576) return false;
          const actual = createHash("sha256").update(bytes).digest();
          if (!timingSafeEqual(actual, Buffer.from(record.sha256, "hex"))) return false;
        }
        return true;
      } catch {
        return false;
      }
    },
  });
}
