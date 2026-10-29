import { describe, expect, it } from "vitest";
import { openOriSqliteEvidenceArtifactRepository } from "./oriSqliteEvidenceArtifactRepository.js";
import { createOriPersistedEvidenceReferenceVerifier } from "./oriPersistedEvidenceReferenceVerifier.js";

const digest = "a".repeat(64);
describe("MIG-03 persisted educator evidence artifacts", () => {
  it("stores immutable content and verifies SHA-256 through trusted repository", async () => {
    const store = openOriSqliteEvidenceArtifactRepository(":memory:");
    const bytes = Buffer.from("Synthetic educator review evidence");
    const record = store.put("pilot", digest, "move", "ori-proposal", bytes);
    expect(record?.reference).toMatch(/^artifact:/);
    const verifier = createOriPersistedEvidenceReferenceVerifier(store);
    expect(
      await verifier.verify("pilot", digest, "move", {
        "ori-proposal": record!.reference,
      }),
    ).toBe(true);
    expect(store.put("pilot", digest, "move", "ori-proposal", Buffer.from("different"))).toBeNull();
    expect(
      await verifier.verify("pilot", digest, "forged", {
        "ori-proposal": record!.reference,
      }),
    ).toBe(false);
    store.close();
  });
  it("rejects invalid keys, empty artifacts and oversized evidence", () => {
    const store = openOriSqliteEvidenceArtifactRepository(":memory:");
    expect(store.put("pilot", digest, "move", "../escape", Buffer.from("x"))).toBeNull();
    expect(store.put("pilot", digest, "move", "ori-proposal", Buffer.alloc(0))).toBeNull();
    expect(store.put("pilot", digest, "move", "ori-proposal", Buffer.alloc(1_048_577))).toBeNull();
    store.close();
  });
  it("rolls back all artifacts if a later entry fails or conflicts", async () => {
    const store = openOriSqliteEvidenceArtifactRepository(":memory:");
    const digest = "a".repeat(64);
    expect(
      store.putBatch("pilot", digest, "move", {
        "ori-proposal": Buffer.from("valid"),
        "kids-baseline": Buffer.alloc(0),
      }),
    ).toBeNull();
    expect(await store.find("pilot", digest, "move", "ori-proposal")).toBeNull();
    expect(
      store.put("pilot", digest, "move", "kids-baseline", Buffer.from("original")),
    ).not.toBeNull();
    expect(
      store.putBatch("pilot", digest, "move", {
        "ori-proposal": Buffer.from("valid"),
        "kids-baseline": Buffer.from("tampered"),
      }),
    ).toBeNull();
    expect(await store.find("pilot", digest, "move", "ori-proposal")).toBeNull();
    store.close();
  });
});
