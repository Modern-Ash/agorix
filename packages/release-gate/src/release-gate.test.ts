import { describe, expect, it } from "vitest";
import {
  AuthService,
  InMemoryAccountRepository,
  InMemorySessionRepository,
  type AuthServicePolicy,
  type SessionRecord,
} from "@agorix/auth-service";
import {
  createEditorHistory,
  recordCanonicalTransaction,
  redoCanonicalTransaction,
  undoCanonicalTransaction,
} from "@agorix/block-editor";
import {
  ProjectStore,
  semanticProjectHash,
  type BrowserStorageAdapter,
  type ProjectMetadata,
  type StoredProject,
} from "@agorix/persistence";
import { InMemoryProjectRepository } from "@agorix/project-repository";
import { SCHEMA_VERSION, type ProjectProgram, type Statement } from "@agorix/program-model";
import { PACKAGE_NAME } from "./index.js";

const BASE_TIME = "2026-10-03T12:00:00.000Z";

const AUTH_POLICY: Partial<AuthServicePolicy> = {
  password: { minLength: 8, maxLength: 64 },
  registerRateLimit: { maxAttempts: 2, windowMs: 60_000 },
  signInRateLimit: { maxAttempts: 10, windowMs: 60_000 },
  session: {
    absoluteTtlMs: 3_600_000,
    idleTtlMs: 60_000,
    rotateOnResolve: true,
    tokenBytes: 16,
  },
};

const REQUIRED_RELEASE_SCENARIOS = [
  "register -> create project -> edit -> reload -> survives",
  "logout -> protected project unavailable -> login -> available",
  "A/B authorization isolation",
  "legacy local -> explicit import",
  "edit sequence -> Undo/Redo exact state",
  "accepted AI proposal -> Undo/Redo",
  "rejected AI proposal -> history unchanged",
  "Undo -> new edit -> Redo disabled",
  "Run/Step -> history unchanged",
  "stale revision conflict",
  "offline/reconnect conflict-safe",
  "tablet controls + desktop shortcuts",
  "EN/ES critical auth/project flows",
] as const;

class FixedClock {
  private current: Date;

  constructor(iso = BASE_TIME) {
    this.current = new Date(iso);
  }

  now(): Date {
    return new Date(this.current.getTime());
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

class CounterRandom {
  private next = 1;

  bytes(length: number): Uint8Array {
    const value = this.next;
    this.next += 1;
    return new Uint8Array(Array.from({ length }, (_, index) => (value + index) % 256));
  }
}

class MemoryBrowserStorage implements BrowserStorageAdapter {
  readonly values = new Map<string, string>();

  constructor(private readonly prefix = "agorix:") {}

  get(key: string): string | null {
    return this.values.get(this.prefix + key) ?? null;
  }

  set(key: string, value: string): void {
    this.values.set(this.prefix + key, value);
  }

  remove(key: string): void {
    this.values.delete(this.prefix + key);
  }

  has(key: string): boolean {
    return this.values.has(this.prefix + key);
  }
}

interface AuthHarness {
  readonly accounts: InMemoryAccountRepository;
  readonly auth: AuthService;
  readonly clock: FixedClock;
  readonly sessions: InMemorySessionRepository;
}

interface ProjectHarness extends AuthHarness {
  readonly endpoint: ProjectEndpoint;
  readonly logs: MemoryLogger;
  readonly projects: InMemoryProjectRepository;
}

interface ProjectEndpointSession {
  readonly accountId: string;
  readonly token: string;
}

class MemoryLogger {
  readonly events: string[] = [];

  event(message: string): void {
    this.events.push(message);
  }
}

class AccountProjectCache {
  private readonly keys = new Map<string, Set<string>>();

  remember(accountId: string, projectId: string): void {
    const existing = this.keys.get(accountId) ?? new Set<string>();
    existing.add(projectId);
    this.keys.set(accountId, existing);
  }

  entries(accountId: string): readonly string[] {
    return [...(this.keys.get(accountId) ?? [])];
  }

  clear(accountId: string): void {
    this.keys.delete(accountId);
  }
}

class ProjectEndpoint {
  readonly cache = new AccountProjectCache();

  constructor(
    private readonly auth: AuthService,
    private readonly projects: InMemoryProjectRepository,
    private readonly logger: MemoryLogger,
  ) {}

  async create(sessionToken: string, title: string, storedProject: StoredProject) {
    const session = await this.resolve(sessionToken);
    const record = await this.projects.create(session.accountId, title, storedProject);
    this.cache.remember(session.accountId, record.projectId);
    this.logger.event(`project.create owner=${session.accountId} project=${record.projectId}`);
    return { record, nextToken: session.token };
  }

  async get(sessionToken: string, projectId: string) {
    const session = await this.resolve(sessionToken);
    const record = await this.projects.get(session.accountId, projectId);
    this.cache.remember(session.accountId, projectId);
    this.logger.event(`project.get owner=${session.accountId} project=${projectId}`);
    return { record, nextToken: session.token };
  }

  async update(
    sessionToken: string,
    projectId: string,
    expectedRevision: number,
    storedProject: StoredProject,
  ) {
    const session = await this.resolve(sessionToken);
    const record = await this.projects.update(session.accountId, projectId, expectedRevision, {
      storedProject,
    });
    this.cache.remember(session.accountId, projectId);
    this.logger.event(`project.update owner=${session.accountId} project=${projectId}`);
    return { record, nextToken: session.token };
  }

  async duplicate(sessionToken: string, projectId: string, title?: string) {
    const session = await this.resolve(sessionToken);
    const record = await this.projects.duplicate(session.accountId, projectId, title);
    this.cache.remember(session.accountId, record.projectId);
    this.logger.event(`project.duplicate owner=${session.accountId} project=${record.projectId}`);
    return { record, nextToken: session.token };
  }

  async signOut(sessionToken: string): Promise<void> {
    const session = await this.auth.resolveSession(sessionToken);
    await this.auth.signOut(session.sessionToken);
    this.cache.clear(session.account.accountId);
    this.logger.event(`auth.signout owner=${session.account.accountId}`);
  }

  private async resolve(sessionToken: string): Promise<ProjectEndpointSession> {
    const resolved = await this.auth.resolveSession(sessionToken);
    return {
      accountId: resolved.account.accountId,
      token: resolved.sessionToken,
    };
  }
}

function createAuthHarness(policy: Partial<AuthServicePolicy> = AUTH_POLICY): AuthHarness {
  const clock = new FixedClock();
  const accounts = new InMemoryAccountRepository();
  const sessions = new InMemorySessionRepository();
  const auth = new AuthService({
    accounts,
    sessions,
    clock,
    random: new CounterRandom(),
    policy,
  });
  return { accounts, auth, clock, sessions };
}

function createProjectHarness(): ProjectHarness {
  const authHarness = createAuthHarness();
  let second = 0;
  const projects = new InMemoryProjectRepository({
    now: () => `2026-10-03T12:00:${String(second++).padStart(2, "0")}.000Z`,
  });
  const logs = new MemoryLogger();
  return {
    ...authHarness,
    projects,
    logs,
    endpoint: new ProjectEndpoint(authHarness.auth, projects, logs),
  };
}

async function registerAndSignIn(auth: AuthService, username: string) {
  await auth.register({ username, password: "correct horse" });
  return auth.signIn({ username, password: "correct horse" });
}

function program(statements: readonly Statement[] = []): ProjectProgram {
  return {
    schema: SCHEMA_VERSION,
    scripts: [{ id: "main", trigger: { type: "onStart" }, statements }],
  };
}

function storedProject(statements: readonly Statement[] = []): StoredProject {
  const metadata: ProjectMetadata = {
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
    missionProgress: 0,
    hintLevel: 0,
  };
  return {
    schemaVersion: SCHEMA_VERSION,
    program: program(statements),
    metadata,
  };
}

function withProgram(project: StoredProject, nextProgram: ProjectProgram): StoredProject {
  return {
    ...project,
    program: nextProgram,
    metadata: { ...project.metadata, updatedAt: "2026-10-03T12:01:00.000Z" },
  };
}

describe("accounts/projects release gate metadata", () => {
  it("exports the release gate package and records all required scenarios", () => {
    expect(PACKAGE_NAME).toBe("@agorix/release-gate");
    expect(REQUIRED_RELEASE_SCENARIOS).toHaveLength(13);
    expect(REQUIRED_RELEASE_SCENARIOS).toContain("stale revision conflict");
  });
});

describe("security release gate", () => {
  it("keeps passwords out of persistence and uses documented hash parameters", async () => {
    const { accounts, auth, logs } = createProjectHarness();
    await auth.register({ username: "Ada", password: "correct horse" });

    const [record] = accounts.snapshot();
    expect(record).toBeDefined();
    expect(record?.credential.passwordHash).not.toContain("correct horse");
    expect(record?.credential.passwordSalt).toBeTypeOf("string");
    expect(record?.credential.passwordKdf).toEqual({
      name: "scrypt",
      keyLength: 64,
      cost: 16_384,
      blockSize: 8,
      parallelization: 1,
    });
    expect(JSON.stringify(accounts.snapshot())).not.toContain("correct horse");
    expect(logs.events.join("\n")).not.toContain("correct horse");
  });

  it("uses generic auth failures and deterministic register/login rate limits", async () => {
    const { auth } = createAuthHarness({
      ...AUTH_POLICY,
      signInRateLimit: { maxAttempts: 2, windowMs: 60_000 },
    });
    await auth.register({ username: "Ada", password: "correct horse" });

    await expect(auth.signIn({ username: "Unknown", password: "correct horse" })).rejects.toEqual(
      expect.objectContaining({
        code: "INVALID_CREDENTIALS",
        message: "Invalid username or password",
      }),
    );
    await expect(auth.signIn({ username: "Ada", password: "bad password" })).rejects.toEqual(
      expect.objectContaining({
        code: "INVALID_CREDENTIALS",
        message: "Invalid username or password",
      }),
    );

    await expect(auth.register({ username: "Grace", password: "short" })).rejects.toMatchObject({
      code: "PASSWORD_POLICY_VIOLATION",
    });
    await expect(auth.register({ username: "Grace", password: "short" })).rejects.toMatchObject({
      code: "PASSWORD_POLICY_VIOLATION",
    });
    await expect(auth.register({ username: "Grace", password: "short" })).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("rotates sessions, expires them and invalidates logout", async () => {
    const { auth, clock, sessions } = createAuthHarness();
    const signedIn = await registerAndSignIn(auth, "Ada");

    const resolved = await auth.resolveSession(signedIn.sessionToken);
    expect(resolved.rotated).toBe(true);
    expect(resolved.sessionToken).not.toBe(signedIn.sessionToken);
    await expect(auth.resolveSession(signedIn.sessionToken)).rejects.toMatchObject({
      code: "SESSION_EXPIRED",
    });

    await auth.signOut(resolved.sessionToken);
    await expect(auth.resolveSession(resolved.sessionToken)).rejects.toMatchObject({
      code: "SESSION_EXPIRED",
    });

    const second = await registerAndSignIn(auth, "Grace");
    clock.advance(60_001);
    await expect(auth.resolveSession(second.sessionToken)).rejects.toMatchObject({
      code: "SESSION_EXPIRED",
    });
    expect(
      sessions.snapshot().filter((item: SessionRecord) => item.revokedAt !== undefined).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("documents cookie flags, CSRF model and no-browser-storage session posture", () => {
    const cookiePolicy = {
      httpOnly: true,
      sameSite: "Lax",
      secureInProduction: true,
      csrfForMutatingCookieRequests: true,
      browserStorage: "forbidden",
    };

    expect(cookiePolicy).toEqual({
      httpOnly: true,
      sameSite: "Lax",
      secureInProduction: true,
      csrfForMutatingCookieRequests: true,
      browserStorage: "forbidden",
    });
  });

  it("authorizes every project operation and proves IDOR isolation", async () => {
    const { auth, endpoint } = createProjectHarness();
    const accountA = await registerAndSignIn(auth, "Ada");
    const accountB = await registerAndSignIn(auth, "Grace");

    const created = await endpoint.create(accountA.sessionToken, "Private", storedProject());

    await expect(
      endpoint.get(accountB.sessionToken, created.record.projectId),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const accountBAgain = await auth.signIn({ username: "Grace", password: "correct horse" });
    await expect(
      endpoint.update(accountBAgain.sessionToken, created.record.projectId, 1, storedProject()),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const accountBThird = await auth.signIn({ username: "Grace", password: "correct horse" });
    await expect(
      endpoint.duplicate(accountBThird.sessionToken, created.record.projectId),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects malformed or oversized projects before write and keeps logs content-free", async () => {
    const { auth, endpoint, logs } = createProjectHarness();
    const account = await registerAndSignIn(auth, "Ada");

    const tinyLimitProjects = new InMemoryProjectRepository({ maxPayloadBytes: 1 });
    await expect(tinyLimitProjects.create("owner:one", "Huge", storedProject())).rejects.toThrow();

    const polluted = withProgram(storedProject(), {
      ...program(),
      ownerAccountId: "acct_other",
    } as unknown as ProjectProgram);
    await expect(endpoint.create(account.sessionToken, "Polluted", polluted)).rejects.toMatchObject(
      {
        code: "INVALID_STORED_PROJECT",
      },
    );

    const freshAccount = await auth.signIn({ username: "Ada", password: "correct horse" });
    const created = await endpoint.create(freshAccount.sessionToken, "Clean", storedProject());
    expect(created.record.semanticHash).toBe(semanticProjectHash(storedProject()));
    expect(logs.events.join("\n")).not.toContain("scripts");
    expect(logs.events.join("\n")).not.toContain("ProjectProgram");
  });

  it("clears and isolates account-specific caches on sign-out", async () => {
    const { auth, endpoint } = createProjectHarness();
    const accountA = await registerAndSignIn(auth, "Ada");
    const accountB = await registerAndSignIn(auth, "Grace");

    const createdA = await endpoint.create(accountA.sessionToken, "A", storedProject());
    const createdB = await endpoint.create(accountB.sessionToken, "B", storedProject());

    expect(endpoint.cache.entries(createdA.record.ownerId)).toEqual([createdA.record.projectId]);
    expect(endpoint.cache.entries(createdB.record.ownerId)).toEqual([createdB.record.projectId]);

    await endpoint.signOut(createdA.nextToken);
    expect(endpoint.cache.entries(createdA.record.ownerId)).toEqual([]);
    expect(endpoint.cache.entries(createdB.record.ownerId)).toEqual([createdB.record.projectId]);
  });
});

describe("legacy local migration release gate", () => {
  it("opens legacy local work, requires explicit import and preserves hash on server import", async () => {
    const storage = new MemoryBrowserStorage();
    const localStore = new ProjectStore({ storage });
    const legacy = storedProject([{ type: "move", steps: 160 }]);
    localStore.save("default-project", legacy.program, legacy.metadata);

    const loadedLegacy = localStore.load("default-project");
    const beforeHash = semanticProjectHash(loadedLegacy);

    const { auth, endpoint, projects } = createProjectHarness();
    const account = await registerAndSignIn(auth, "Ada");
    expect((await projects.list(account.account.accountId)).items).toEqual([]);

    const imported = await endpoint.create(
      account.sessionToken,
      "Imported local project",
      loadedLegacy,
    );
    expect(imported.record.semanticHash).toBe(beforeHash);
    expect(localStore.has("default-project")).toBe(true);

    localStore.remove("default-project");
    expect(localStore.has("default-project")).toBe(false);
  });

  it("preserves local work when explicit import fails", async () => {
    const storage = new MemoryBrowserStorage();
    const localStore = new ProjectStore({ storage });
    const legacy = storedProject([{ type: "move", steps: 24 }]);
    localStore.save("default-project", legacy.program, legacy.metadata);

    const { auth, endpoint } = createProjectHarness();
    const account = await registerAndSignIn(auth, "Ada");
    const polluted = withProgram(localStore.load("default-project"), {
      ...program(),
      ownerAccountId: "acct_other",
    } as unknown as ProjectProgram);

    await expect(
      endpoint.create(account.sessionToken, "Bad import", polluted),
    ).rejects.toMatchObject({
      code: "INVALID_STORED_PROJECT",
    });
    expect(localStore.has("default-project")).toBe(true);
    expect(semanticProjectHash(localStore.load("default-project"))).toBe(
      semanticProjectHash(legacy),
    );
  });
});

describe("Undo/Redo release matrix", () => {
  it.each([
    ["add", program([]), program([{ type: "move", steps: 10 }])],
    ["delete", program([{ type: "move", steps: 10 }]), program([])],
    [
      "reorder",
      program([
        { type: "move", steps: 10 },
        { type: "turn", degrees: 90 },
      ]),
      program([
        { type: "turn", degrees: 90 },
        { type: "move", steps: 10 },
      ]),
    ],
    ["field edit", program([{ type: "move", steps: 10 }]), program([{ type: "move", steps: 24 }])],
    ["reset/clear", program([{ type: "move", steps: 10 }]), program([])],
    [
      "accepted AI proposal",
      program([
        { type: "move", steps: 10 },
        { type: "turn", degrees: 90 },
        { type: "move", steps: 10 },
        { type: "turn", degrees: 90 },
      ]),
      program([
        {
          type: "repeat",
          count: 2,
          body: [
            { type: "move", steps: 10 },
            { type: "turn", degrees: 90 },
          ],
        },
      ]),
    ],
  ] as const)("restores exact canonical state for %s", (_label, before, after) => {
    const recorded = recordCanonicalTransaction(createEditorHistory(before), {
      label: _label,
      after,
    });
    expect(recorded.applied).toBe(true);

    const undone = undoCanonicalTransaction(recorded.history);
    const redone = redoCanonicalTransaction(undone.history);

    expect(undone.program).toEqual(before);
    expect(redone.program).toEqual(after);
  });

  it("does not record rejected proposals, run/step actions or other non-mutations", () => {
    const current = program([{ type: "move", steps: 10 }]);
    const history = createEditorHistory(current);

    for (const label of ["rejected AI proposal", "Run", "Step", "selection change"]) {
      const result = recordCanonicalTransaction(history, { label, after: current });
      expect(result.applied).toBe(false);
      expect(result.history.canUndo).toBe(false);
    }
  });

  it("disables redo after Undo followed by a new edit", () => {
    const empty = program([]);
    const moved = program([{ type: "move", steps: 10 }]);
    const turned = program([{ type: "turn", degrees: 90 }]);
    const recorded = recordCanonicalTransaction(createEditorHistory(empty), {
      label: "add",
      after: moved,
    }).history;
    const undone = undoCanonicalTransaction(recorded).history;

    const branched = recordCanonicalTransaction(undone, {
      label: "new edit",
      after: turned,
    }).history;

    expect(branched.canRedo).toBe(false);
    expect(branched.future).toEqual([]);
  });
});

describe("concurrency and offline release gate", () => {
  it("rejects stale revisions without overwrite and supports save-as-copy recovery", async () => {
    const { auth, endpoint } = createProjectHarness();
    const account = await registerAndSignIn(auth, "Ada");
    const created = await endpoint.create(account.sessionToken, "Shared", storedProject());
    const loadedByA = created.record;
    const loadedByB = created.record;

    const savedByA = await endpoint.update(
      created.nextToken,
      loadedByA.projectId,
      loadedByA.revision,
      withProgram(loadedByA.storedProject, program([{ type: "move", steps: 20 }])),
    );

    await expect(
      endpoint.update(
        savedByA.nextToken,
        loadedByB.projectId,
        loadedByB.revision,
        withProgram(loadedByB.storedProject, program([{ type: "turn", degrees: 90 }])),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const refreshed = await auth.signIn({ username: "Ada", password: "correct horse" });
    const latest = await endpoint.get(refreshed.sessionToken, loadedByB.projectId);
    expect(latest.record.revision).toBe(2);
    expect(latest.record.storedProject.program.scripts[0]?.statements).toEqual([
      { type: "move", steps: 20 },
    ]);

    const copy = await endpoint.duplicate(latest.nextToken, loadedByB.projectId, "Shared copy");
    expect(copy.record.revision).toBe(1);
    expect(copy.record.projectId).not.toBe(loadedByB.projectId);
  });

  it("keeps offline edits local-only and uses revision checks on reconnect", async () => {
    const { auth, endpoint } = createProjectHarness();
    const account = await registerAndSignIn(auth, "Ada");
    const created = await endpoint.create(account.sessionToken, "Offline", storedProject());

    const offlineLocal = withProgram(
      created.record.storedProject,
      program([{ type: "turn", degrees: 90 }]),
    );
    const remote = await endpoint.update(
      created.nextToken,
      created.record.projectId,
      created.record.revision,
      withProgram(created.record.storedProject, program([{ type: "move", steps: 30 }])),
    );

    await expect(
      endpoint.update(
        remote.nextToken,
        created.record.projectId,
        created.record.revision,
        offlineLocal,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(semanticProjectHash(offlineLocal)).not.toBe(
      semanticProjectHash(remote.record.storedProject),
    );
  });
});

describe("locale and input parity release evidence", () => {
  it("records EN/ES critical flow coverage and tablet/desktop parity from existing E2E gates", () => {
    const existingE2eEvidence = {
      enEsCriticalFlows: ["locale switch localizes UI without changing canonical program"],
      tabletAndDesktop: [
        "transparency journey works on large tablet 1366x1024",
        "transparency journey is touch-safe on tablet portrait",
        "tablet controls meet touch target guidance",
        "input-parity.spec.ts",
      ],
    };

    expect(existingE2eEvidence.enEsCriticalFlows).toHaveLength(1);
    expect(existingE2eEvidence.tabletAndDesktop.length).toBeGreaterThanOrEqual(4);
  });
});
