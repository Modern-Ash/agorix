import { describe, expect, it } from "vitest";
import {
  ACCOUNT_IDENTITY_CONTRACT_VERSION,
  PACKAGE_NAME,
  PROJECT_OWNERSHIP_CONTRACT_VERSION,
  PlatformContractError,
  SESSION_IDENTITY_CONTRACT_VERSION,
  createAccountIdentity,
  createOwnedProjectDescriptor,
  createOwnedProjectEnvelope,
  createSessionIdentity,
  normalizeAccountAlias,
} from "./index.js";

const createdAt = "2026-01-01T00:00:00.000Z";
const updatedAt = "2026-01-02T00:00:00.000Z";

describe("platform-contract package", () => {
  it("exports a package identity", () => {
    expect(PACKAGE_NAME).toBe("@agorix/platform-contract");
  });
});

describe("account identity contract", () => {
  it("normalizes aliases deterministically for case-insensitive uniqueness", () => {
    expect(normalizeAccountAlias("  Ada.Lovelace  ")).toEqual({
      original: "Ada.Lovelace",
      normalized: "ada-lovelace",
    });
    expect(normalizeAccountAlias("ADA lovelace").normalized).toBe("ada-lovelace");
    expect(normalizeAccountAlias("Ada_Lovelace").normalized).toBe("ada_lovelace");
  });

  it("rejects aliases that are reserved, contact-like or outside the username policy", () => {
    expect(() => normalizeAccountAlias("admin")).toThrow(PlatformContractError);
    expect(() => normalizeAccountAlias("learner@example.com")).toThrow(/email/);
    expect(() => normalizeAccountAlias("ab")).toThrow(/3-32/);
    expect(() => normalizeAccountAlias("learner!")).toThrow(/lowercase letters/);
  });

  it("creates provider-neutral accounts without mandatory email or provider credentials", () => {
    const account = createAccountIdentity({
      accountId: "acct_01HZYX",
      alias: "Project Builder",
      createdAt,
    });

    expect(account).toEqual({
      contractVersion: ACCOUNT_IDENTITY_CONTRACT_VERSION,
      accountId: "acct_01HZYX",
      alias: { original: "Project Builder", normalized: "project-builder" },
      status: "active",
      createdAt,
    });
    expect(JSON.stringify(account)).not.toMatch(/password|cookie|http|email/i);
  });

  it("allows recovery contact only behind an explicit deployment policy", () => {
    const recoveryContact = {
      kind: "email",
      value: "guardian@example.com",
      purpose: "account-recovery",
      retention: "until-account-deletion-or-policy-retention",
    } as const;

    expect(() =>
      createAccountIdentity({
        accountId: "acct_recovery",
        alias: "Builder One",
        createdAt,
        recoveryContact,
      }),
    ).toThrow(/deployment-enabled/);

    expect(
      createAccountIdentity({
        accountId: "acct_recovery",
        alias: "Builder One",
        createdAt,
        recoveryContact,
        recoveryContactPolicy: "deployment-enabled",
      }).recoveryContact,
    ).toEqual(recoveryContact);
  });
});

describe("session identity contract", () => {
  it("creates opaque session identities with an account binding and expiry", () => {
    expect(
      createSessionIdentity({
        sessionId: "sess_01",
        accountId: "acct_01",
        createdAt,
        expiresAt: updatedAt,
      }),
    ).toEqual({
      contractVersion: SESSION_IDENTITY_CONTRACT_VERSION,
      sessionId: "sess_01",
      accountId: "acct_01",
      createdAt,
      expiresAt: updatedAt,
    });
  });

  it("rejects expired or provider-specific session shapes", () => {
    expect(() =>
      createSessionIdentity({
        sessionId: "sess 01",
        accountId: "acct_01",
        createdAt,
        expiresAt: updatedAt,
      }),
    ).toThrow(/sessionId/);
    expect(() =>
      createSessionIdentity({
        sessionId: "sess_01",
        accountId: "acct_01",
        createdAt: updatedAt,
        expiresAt: createdAt,
      }),
    ).toThrow(/expiresAt/);
  });
});

describe("project ownership contract", () => {
  it("describes project ownership outside the canonical project payload", () => {
    const project = {
      schemaVersion: "agorix/program/v1",
      program: { schema: "agorix/program/v1", scripts: [] },
      metadata: { missionProgress: 0, hintLevel: 0, createdAt, updatedAt },
    };
    const descriptor = createOwnedProjectDescriptor({
      projectId: "proj_01",
      ownerAccountId: "acct_01",
      title: "My Maze",
      revision: "rev_01",
      createdAt,
      updatedAt,
    });

    const envelope = createOwnedProjectEnvelope(project, descriptor);

    expect(envelope.descriptor.contractVersion).toBe(PROJECT_OWNERSHIP_CONTRACT_VERSION);
    expect(envelope.project).toBe(project);
    expect(JSON.stringify(envelope.project.program)).not.toMatch(
      /accountId|ownerAccountId|projectId|revision|sessionId/,
    );
  });
});
