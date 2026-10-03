import { describe, expect, it } from "vitest";
import { semanticProjectHash, type StoredProject } from "@agorix/persistence";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import {
  InMemoryProjectRepository,
  PACKAGE_NAME,
  POSTGRESQL_SCHEMA_SQL,
  PROJECT_REPOSITORY_MIGRATIONS,
  ProjectRepositoryError,
  SQLITE_SCHEMA_SQL,
  validateStoredProject,
} from "./index.js";

const BASE_TIME = "2026-01-01T00:00:00.000Z";

function makeProgram(scriptId = "main"): ProjectProgram {
  return {
    schema: SCHEMA_VERSION,
    scripts: [{ id: scriptId, trigger: { type: "onStart" }, statements: [] }],
  };
}

function makeStoredProject(program = makeProgram()): StoredProject {
  return {
    schemaVersion: SCHEMA_VERSION,
    program,
    metadata: {
      createdAt: BASE_TIME,
      updatedAt: BASE_TIME,
      missionProgress: 0,
      hintLevel: 0,
    },
  };
}

function makeRepository(pageSize = 20): InMemoryProjectRepository {
  let second = 0;
  return new InMemoryProjectRepository({
    pageSize,
    now: () => `2026-01-01T00:00:${String(second++).padStart(2, "0")}.000Z`,
  });
}

describe("project repository package", () => {
  it("exports a package identity and deployable schemas", () => {
    expect(PACKAGE_NAME).toBe("@agorix/project-repository");
    expect(POSTGRESQL_SCHEMA_SQL).toContain("create table if not exists agorix_projects");
    expect(SQLITE_SCHEMA_SQL).toContain("primary key (owner_id, project_id)");
    expect(PROJECT_REPOSITORY_MIGRATIONS[0].id).toBe("001_create_agorix_projects");
  });
});

describe("InMemoryProjectRepository", () => {
  it("creates and lists multiple projects for one owner", async () => {
    const repository = makeRepository();
    const first = await repository.create(
      "owner:one",
      "First",
      makeStoredProject(makeProgram("first")),
    );
    const second = await repository.create(
      "owner:one",
      "Second",
      makeStoredProject(makeProgram("second")),
    );

    expect(first.projectId).not.toBe(second.projectId);
    expect(first.revision).toBe(1);
    expect(second.revision).toBe(1);

    const page = await repository.list("owner:one");
    expect(page.items.map((item) => item.title)).toEqual(["Second", "First"]);
    expect(page.items.every((item) => item.ownerId === "owner:one")).toBe(true);
  });

  it("isolates projects by owner", async () => {
    const repository = makeRepository();
    const created = await repository.create("owner:one", "Private", makeStoredProject());
    await repository.create("owner:two", "Other", makeStoredProject(makeProgram("other")));

    await expect(repository.get("owner:two", created.projectId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(repository.list("owner:one")).resolves.toMatchObject({
      items: [expect.objectContaining({ title: "Private" })],
    });
  });

  it("supports CRUD, rename, duplicate and delete", async () => {
    const repository = makeRepository();
    const created = await repository.create("owner:one", "Original", makeStoredProject());
    const renamed = await repository.update("owner:one", created.projectId, created.revision, {
      title: "Renamed",
    });
    const duplicated = await repository.duplicate("owner:one", created.projectId, "Fork");

    expect(renamed.title).toBe("Renamed");
    expect(renamed.revision).toBe(2);
    expect(duplicated.projectId).not.toBe(created.projectId);
    expect(duplicated.title).toBe("Fork");
    expect(duplicated.revision).toBe(1);

    await repository.delete("owner:one", created.projectId, renamed.revision);
    await expect(repository.get("owner:one", created.projectId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(repository.get("owner:one", duplicated.projectId)).resolves.toMatchObject({
      title: "Fork",
    });
  });

  it("increments revisions monotonically and rejects stale writes without overwriting", async () => {
    const repository = makeRepository();
    const created = await repository.create("owner:one", "Original", makeStoredProject());
    const next = await repository.update("owner:one", created.projectId, 1, {
      storedProject: makeStoredProject(makeProgram("next")),
    });

    await expect(
      repository.update("owner:one", created.projectId, 1, { title: "Stale" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const current = await repository.get("owner:one", created.projectId);
    expect(next.revision).toBe(2);
    expect(current.title).toBe("Original");
    expect(current.storedProject.program.scripts[0]?.id).toBe("next");
  });

  it("rejects invalid projects before writes", async () => {
    const repository = makeRepository();
    const invalidProgram = {
      schema: SCHEMA_VERSION,
      ownerAccountId: "owner:one",
      scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [] }],
    } as unknown as ProjectProgram;

    await expect(
      repository.create("owner:one", "Bad", makeStoredProject(invalidProgram)),
    ).rejects.toMatchObject({
      code: "INVALID_STORED_PROJECT",
    });
    await expect(repository.create("owner:one", " ", makeStoredProject())).rejects.toMatchObject({
      code: "INVALID_TITLE",
    });
    await expect(
      repository.create("owner:one", "Huge", makeStoredProject()),
    ).resolves.toMatchObject({ title: "Huge" });
  });

  it("rejects payloads over the configured limit", async () => {
    const repository = new InMemoryProjectRepository({ maxPayloadBytes: 10 });
    await expect(
      repository.create("owner:one", "Too large", makeStoredProject()),
    ).rejects.toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
    });
  });

  it("preserves semantic hash across durable round trips and ownership envelopes", async () => {
    const repository = makeRepository();
    const storedProject = makeStoredProject(makeProgram("semantic"));
    const beforeHash = semanticProjectHash(storedProject);

    const firstOwnerRecord = await repository.create("owner:one", "Semantic", storedProject);
    const secondOwnerRecord = await repository.create("owner:two", "Semantic", storedProject);

    expect(firstOwnerRecord.semanticHash).toBe(beforeHash);
    expect(secondOwnerRecord.semanticHash).toBe(beforeHash);
    expect(
      semanticProjectHash(
        (await repository.get("owner:one", firstOwnerRecord.projectId)).storedProject,
      ),
    ).toBe(beforeHash);
    expect(firstOwnerRecord.storedProject).not.toHaveProperty("ownerId");
    expect(firstOwnerRecord.storedProject.program).not.toHaveProperty("ownerId");
  });

  it("paginates deterministically", async () => {
    const repository = makeRepository(2);
    await repository.create("owner:one", "A", makeStoredProject(makeProgram("a")));
    await repository.create("owner:one", "B", makeStoredProject(makeProgram("b")));
    await repository.create("owner:one", "C", makeStoredProject(makeProgram("c")));

    const firstPage = await repository.list("owner:one");
    const secondPage = await repository.list("owner:one", firstPage.nextCursor);

    expect(firstPage.items.map((item) => item.title)).toEqual(["C", "B"]);
    expect(firstPage.nextCursor).toBe("offset:2");
    expect(secondPage.items.map((item) => item.title)).toEqual(["A"]);
    expect(secondPage.nextCursor).toBeUndefined();
  });
});

describe("validateStoredProject", () => {
  it("requires the current StoredProject schema version", () => {
    expect(() => validateStoredProject({ ...makeStoredProject(), schemaVersion: "old" })).toThrow(
      ProjectRepositoryError,
    );
  });
});
