import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const guide = readFileSync("docs/deployment/SELF_HOSTING.md", "utf8");
const evidence = readFileSync("docs/evidence/SELF_HOSTING_VALIDATION.md", "utf8");

function expectInOrder(...needles) {
  let previous = -1;
  for (const needle of needles) {
    const current = guide.indexOf(needle);
    expect(current, `${needle} should exist`).toBeGreaterThanOrEqual(0);
    expect(current, `${needle} should appear after the prior section`).toBeGreaterThan(previous);
    previous = current;
  }
}

describe("self-hosting documentation", () => {
  it("documents the required deployment ladder in order", () => {
    expectInOrder(
      "## Mode 1: public static demo, zero AI infrastructure",
      "## Mode 2: local intelligent path with Laya/System-1",
      "## Mode 3: local generative path with zero service cost",
      "## Mode 4: optional remote provider",
    );
    expect(guide).toContain("deterministic System-0 before Laya/System-1");
    expect(guide).toContain("local inference before remote inference");
  });

  it("keeps the public static mode keyless and backend-free", () => {
    expect(guide).toContain("Do not set any `AGORIX_TUTOR_*` provider variables");
    expect(guide).toContain("Do not run `apps/tutor-api`");
    expect(guide).toContain("pnpm --filter @agorix/web build");
    expect(guide).toMatch(/No Learning Companion provider\s+request leaves the machine/);
  });

  it("records the Laya compact-state privacy boundary", () => {
    expect(guide).toContain("LayaBatchTransport");
    expect(guide).toContain("Raw learner free text must not be sent to Laya");
    expect(guide).toContain("hasLearnerIntent");
    expect(guide).toContain("runtimeFactCount");
  });

  it("makes local generative inference explicit and remote fallback closed", () => {
    expect(guide).toContain("createOllamaProviderRuntime");
    expect(guide).toContain("AGORIX_TUTOR_BASE_URL=http://127.0.0.1:8080/v1");
    expect(guide).toContain("Do not configure a remote base URL as a fallback");
    expect(guide).toContain("Capability negotiation must fail closed");
  });

  it("keeps remote mode optional, server-side, and privacy-scoped", () => {
    expect(guide).toContain("Remote inference is a deployment choice, never a requirement");
    expect(guide).toContain("AGORIX_TUTOR_AUTH_TOKEN=<server-side-token>");
    expect(guide).toContain("The browser must never receive `AGORIX_TUTOR_AUTH_TOKEN`");
    expect(guide).toContain("AGORIX_TUTOR_INCLUDE_LEARNER_QUESTION=1");
  });

  it("distinguishes source, adapter, model, and service licensing", () => {
    expect(guide).toContain(
      "Adapter source, gateway software, model weights, and hosted service terms",
    );
    expect(guide).toContain("model weights");
    expect(guide).toContain("hosted inference services");
  });

  it("keeps examples free of concrete secrets", () => {
    expect(guide).not.toMatch(/sk-[A-Za-z0-9_-]{16,}/);
    expect(guide).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
    expect(guide).not.toMatch(/AGORIX_TUTOR_AUTH_TOKEN=(?!<server-side-token>)/);
  });

  it("records acceptance evidence for issue 98", () => {
    expect(evidence).toContain("Issue: #98");
    expect(evidence).toContain("Public/static demo uses zero API keys");
    expect(evidence).toContain("Local generative mode has zero service cost path");
    expect(evidence).toContain("scripts/self-hosting-docs.test.mjs");
  });
});
