/** Boundary for capabilities that differ across web, mobile and VS Code: filesystem access, persistence backend, sharing/export, native integrations. */
export const PACKAGE_NAME = "@agorix/platform-contract";

export const ACCOUNT_IDENTITY_CONTRACT_VERSION = "agorix/account-identity/v1";
export const SESSION_IDENTITY_CONTRACT_VERSION = "agorix/session-identity/v1";
export const PROJECT_OWNERSHIP_CONTRACT_VERSION = "agorix/project-ownership/v1";

export type AccountStatus = "active" | "suspended" | "deleted";
export type RecoveryContactPolicy = "disabled" | "deployment-enabled";

export interface AccountAlias {
  readonly original: string;
  readonly normalized: string;
}

export interface AccountRecoveryContact {
  readonly kind: "email";
  readonly value: string;
  readonly purpose: "account-recovery";
  readonly retention: "until-account-deletion-or-policy-retention";
}

export interface AccountIdentity {
  readonly contractVersion: typeof ACCOUNT_IDENTITY_CONTRACT_VERSION;
  readonly accountId: string;
  readonly alias: AccountAlias;
  readonly status: AccountStatus;
  readonly createdAt: string;
  readonly recoveryContact?: AccountRecoveryContact;
}

export interface SessionIdentity {
  readonly contractVersion: typeof SESSION_IDENTITY_CONTRACT_VERSION;
  readonly sessionId: string;
  readonly accountId: string;
  readonly createdAt: string;
  readonly expiresAt: string;
}

export interface OwnedProjectDescriptor {
  readonly contractVersion: typeof PROJECT_OWNERSHIP_CONTRACT_VERSION;
  readonly projectId: string;
  readonly ownerAccountId: string;
  readonly title: string;
  readonly revision: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface OwnedProjectEnvelope<TProject> {
  readonly descriptor: OwnedProjectDescriptor;
  readonly project: TProject;
}

export interface CreateAccountIdentityInput {
  readonly accountId: string;
  readonly alias: string;
  readonly status?: AccountStatus;
  readonly createdAt: string;
  readonly recoveryContact?: AccountRecoveryContact;
  readonly recoveryContactPolicy?: RecoveryContactPolicy;
}

export interface CreateSessionIdentityInput {
  readonly sessionId: string;
  readonly accountId: string;
  readonly createdAt: string;
  readonly expiresAt: string;
}

export interface CreateOwnedProjectDescriptorInput {
  readonly projectId: string;
  readonly ownerAccountId: string;
  readonly title: string;
  readonly revision: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export class PlatformContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlatformContractError";
  }
}

const ACCOUNT_ALIAS_MIN_LENGTH = 3;
const ACCOUNT_ALIAS_MAX_LENGTH = 32;
const PROJECT_TITLE_MAX_LENGTH = 120;
const OPAQUE_ID_MAX_LENGTH = 128;

export const RESERVED_ACCOUNT_ALIASES = [
  "admin",
  "administrator",
  "agorix",
  "anonymous",
  "deleted",
  "moderator",
  "null",
  "root",
  "staff",
  "support",
  "system",
  "undefined",
] as const;

export function normalizeAccountAlias(input: string): AccountAlias {
  const original = input.normalize("NFKC").trim();
  if (original.includes("@")) {
    throw new PlatformContractError("account alias must not be an email address");
  }

  const normalized = original
    .toLocaleLowerCase("en-US")
    .replace(/[\s.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");

  if (
    normalized.length < ACCOUNT_ALIAS_MIN_LENGTH ||
    normalized.length > ACCOUNT_ALIAS_MAX_LENGTH
  ) {
    throw new PlatformContractError(
      `account alias must be ${ACCOUNT_ALIAS_MIN_LENGTH}-${ACCOUNT_ALIAS_MAX_LENGTH} characters`,
    );
  }
  if (!/^[a-z0-9][a-z0-9_-]*[a-z0-9]$/.test(normalized)) {
    throw new PlatformContractError(
      "account alias may contain lowercase letters, numbers, dashes and underscores",
    );
  }
  if ((RESERVED_ACCOUNT_ALIASES as readonly string[]).includes(normalized)) {
    throw new PlatformContractError(`account alias "${normalized}" is reserved`);
  }

  return { original, normalized };
}

export function createAccountIdentity(input: CreateAccountIdentityInput): AccountIdentity {
  const accountId = requireOpaqueId(input.accountId, "accountId");
  const createdAt = requireIsoInstant(input.createdAt, "createdAt");
  if (input.recoveryContact !== undefined && input.recoveryContactPolicy !== "deployment-enabled") {
    throw new PlatformContractError(
      "recovery contact requires an explicit deployment-enabled recovery contact policy",
    );
  }

  const identity: AccountIdentity = {
    contractVersion: ACCOUNT_IDENTITY_CONTRACT_VERSION,
    accountId,
    alias: normalizeAccountAlias(input.alias),
    status: input.status ?? "active",
    createdAt,
  };

  return input.recoveryContact === undefined
    ? identity
    : { ...identity, recoveryContact: validateRecoveryContact(input.recoveryContact) };
}

export function createSessionIdentity(input: CreateSessionIdentityInput): SessionIdentity {
  const createdAt = requireIsoInstant(input.createdAt, "createdAt");
  const expiresAt = requireIsoInstant(input.expiresAt, "expiresAt");
  if (Date.parse(expiresAt) <= Date.parse(createdAt)) {
    throw new PlatformContractError("expiresAt must be after createdAt");
  }

  return {
    contractVersion: SESSION_IDENTITY_CONTRACT_VERSION,
    sessionId: requireOpaqueId(input.sessionId, "sessionId"),
    accountId: requireOpaqueId(input.accountId, "accountId"),
    createdAt,
    expiresAt,
  };
}

export function createOwnedProjectDescriptor(
  input: CreateOwnedProjectDescriptorInput,
): OwnedProjectDescriptor {
  const title = input.title.normalize("NFKC").trim();
  if (title.length === 0 || title.length > PROJECT_TITLE_MAX_LENGTH) {
    throw new PlatformContractError(
      `project title must be 1-${PROJECT_TITLE_MAX_LENGTH} characters`,
    );
  }
  const createdAt = requireIsoInstant(input.createdAt, "createdAt");
  const updatedAt = requireIsoInstant(input.updatedAt, "updatedAt");
  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    throw new PlatformContractError("updatedAt must not be before createdAt");
  }

  return {
    contractVersion: PROJECT_OWNERSHIP_CONTRACT_VERSION,
    projectId: requireOpaqueId(input.projectId, "projectId"),
    ownerAccountId: requireOpaqueId(input.ownerAccountId, "ownerAccountId"),
    title,
    revision: requireOpaqueId(input.revision, "revision"),
    createdAt,
    updatedAt,
  };
}

export function createOwnedProjectEnvelope<TProject>(
  project: TProject,
  descriptor: OwnedProjectDescriptor,
): OwnedProjectEnvelope<TProject> {
  return {
    descriptor: validateOwnedProjectDescriptor(descriptor),
    project,
  };
}

export function validateOwnedProjectDescriptor(
  descriptor: OwnedProjectDescriptor,
): OwnedProjectDescriptor {
  return createOwnedProjectDescriptor(descriptor);
}

function validateRecoveryContact(contact: AccountRecoveryContact): AccountRecoveryContact {
  if (contact.kind !== "email" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.value)) {
    throw new PlatformContractError("recovery contact must be a valid email contact");
  }
  if (contact.purpose !== "account-recovery") {
    throw new PlatformContractError("recovery contact purpose must be account-recovery");
  }
  if (contact.retention !== "until-account-deletion-or-policy-retention") {
    throw new PlatformContractError("recovery contact retention policy is required");
  }
  return contact;
}

function requireOpaqueId(value: string, field: string): string {
  const normalized = value.normalize("NFKC").trim();
  if (normalized.length === 0 || normalized.length > OPAQUE_ID_MAX_LENGTH) {
    throw new PlatformContractError(`${field} must be a non-empty opaque identifier`);
  }
  if (/[\s]/.test(normalized)) {
    throw new PlatformContractError(`${field} must not contain whitespace`);
  }
  return normalized;
}

function requireIsoInstant(value: string, field: string): string {
  const normalized = value.trim();
  const timestamp = Date.parse(normalized);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== normalized) {
    throw new PlatformContractError(`${field} must be an ISO-8601 UTC instant`);
  }
  return normalized;
}
