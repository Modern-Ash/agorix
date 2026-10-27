import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOriPersistedEvidenceReferenceVerifier } from "./oriPersistedEvidenceReferenceVerifier.js";

const bytes = Buffer.from("trusted synthetic pedagogical evidence");
const digest = "a".repeat(64);
const record = {
  reviewId: "pilot", evidenceDigest: digest, missionId: "move",
  key: "ori-proposal", reference: "artifact:pilot/move/ori",
  sha256: createHash("sha256").update(bytes).digest("hex"),
};
describe("MIG-03 persisted evidence reference verification", () => {
  it("accepts only scoped records whose content matches the stored SHA-256", async () => {
    const verifier = createOriPersistedEvidenceReferenceVerifier({
      find: async () => record, read: async () => bytes,
    });
    expect(await verifier.verify("pilot", digest, "move", {
      "ori-proposal": record.reference,
    })).toBe(true);
    expect(await verifier.verify("pilot", digest, "forged", {
      "ori-proposal": record.reference,
    })).toBe(false);
  });
  it("rejects tampering, unknown references and network URLs", async () => {
    const verifier = createOriPersistedEvidenceReferenceVerifier({
      find: async () => record, read: async () => Buffer.from("tampered"),
    });
    expect(await verifier.verify("pilot", digest, "move", {
      "ori-proposal": record.reference,
    })).toBe(false);
    expect(await verifier.verify("pilot", digest, "move", {
      "ori-proposal": "https://attacker.example/evidence",
    })).toBe(false);
    const missing = createOriPersistedEvidenceReferenceVerifier({
      find: async () => null, read: async () => bytes,
    });
    expect(await missing.verify("pilot", digest, "move", {
      "ori-proposal": record.reference,
    })).toBe(false);
  });
});
