import { createHash, timingSafeEqual } from "node:crypto";

const HEX = /^[a-f0-9]{64}$/;
const sha = (value: string) => createHash("sha256").update(value).digest();

export interface OriMig03ReviewDeliveryFiles {
  readonly manifestJson: string;
  readonly auditJson: string;
  readonly checklistJson: string;
}
/**
 * Independent offline package verification. Content hashes are integrity
 * checks, not signatures or proof of pedagogical approval.
 */
export function verifyOriMig03ReviewDeliveryPackage(files: OriMig03ReviewDeliveryFiles) {
  const blockers: string[] = [];
  try {
    const manifest: unknown = JSON.parse(files.manifestJson);
    const audit: unknown = JSON.parse(files.auditJson);
    const checklist: unknown = JSON.parse(files.checklistJson);
    if (!manifest || typeof manifest !== "object" ||
        !audit || typeof audit !== "object" ||
        !checklist || typeof checklist !== "object") throw Error("invalid-objects");
    const m = manifest as Record<string, unknown>;
    const a = audit as Record<string, unknown>;
    const c = checklist as Record<string, unknown>;
    if (m["schema"] !== "agorix/ori-mig03-review-delivery/v1" ||
        a["schema"] !== "agorix/ori-mig03-educator-audit/v1" ||
        c["schema"] !== "agorix/ori-mig03-human-acceptance/v1")
      blockers.push("schema-mismatch");
    if (m["reviewId"] !== a["reviewId"] || m["reviewId"] !== c["reviewId"] ||
        m["missionId"] !== a["missionId"] || m["missionId"] !== c["missionId"] ||
        a["auditHash"] !== c["auditHash"]) blockers.push("identity-mismatch");
    if (m["rolloutAuthorized"] !== false || a["rolloutAuthorized"] !== false ||
        c["rolloutAuthorized"] !== false || a["humanApproval"] !== false ||
        c["humanDecisionRequired"] !== true || m["humanDecisionRequired"] !== true)
      blockers.push("approval-claim-invalid");
    for (const [key, data] of [
      ["auditSha256", files.auditJson], ["checklistSha256", files.checklistJson],
    ] as const) {
      const expected = m[key];
      if (typeof expected !== "string" || !HEX.test(expected) ||
          !timingSafeEqual(Buffer.from(expected, "hex"), sha(data)))
        blockers.push("content-hash-mismatch");
    }
  } catch { blockers.push("invalid-package"); }
  return Object.freeze({
    valid: blockers.length === 0,
    blockers: Object.freeze([...new Set(blockers)].sort()),
    rolloutAuthorized: false as const,
  });
}
