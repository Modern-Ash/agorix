import { describe, expect, it } from "vitest";
import {
  ProjectStore,
  semanticProjectHash,
  type ProjectMetadata,
  type StoredProject,
} from "@agorix/persistence";
import type { ProjectApiClient } from "../../accounts/clients.js";
import { ClientError } from "../../accounts/clients.js";
import { deleteFreeProject } from "../kidsProjects.js";
import {
  copyKidsProjectToAccount,
  kidsAccountCopy,
  pullKidsAccountCopy,
  reconcileKidsAccountProject,
  restoreKidsAccountProject,
  kidsAccountCopyByRemote,
  updateKidsAccountCopy,
  type CopyStorage,
} from "./kidsAccountProjectCopy.js";

const stored = {
  schemaVersion: "agorix/program/v1",
  program: { schema: "agorix/program/v1", scripts: [] },
  metadata: {
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    missionProgress: 0,
    hintLevel: 0,
    missionSpec: { goal: "kids.cell.4.2", successCheck: "touches-goal" },
  },
};
const storedHash = semanticProjectHash(stored as Parameters<typeof semanticProjectHash>[0]);

describe("explicit Kids account project copy", () => {
  it("stores the built-in world and avatar with a newly linked project", async () => {
    const values = new Map<string, string>();
    values.set(
      "agorix.kids.projects.v1",
      JSON.stringify([{ id: "free-11", world: "ocean", avatar: "🐸" }]),
    );
    const storage: CopyStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => void values.set(key, value),
    };
    let local = stored as StoredProject;
    const store = {
      load: () => local,
      save: (_id: string, program: StoredProject["program"], metadata: ProjectMetadata) => {
        local = { ...stored, program, metadata };
      },
    } as unknown as Pick<ProjectStore, "load" | "save">;
    const projects = {
      create: async (_title: string, saved: StoredProject) => {
        expect(saved.metadata.kidsView).toEqual({ world: "ocean", avatar: "🐸" });
        return {
          projectId: "remote-11",
          revision: 1,
          semanticHash: semanticProjectHash(saved as Parameters<typeof semanticProjectHash>[0]),
        };
      },
    } as unknown as Pick<ProjectApiClient, "create">;
    expect(
      (
        await copyKidsProjectToAccount({
          accountAlias: "adult",
          localProjectId: "free-11",
          store,
          projects,
          storage,
        })
      ).status,
    ).toBe("copied");
    expect(local.metadata.kidsView).toEqual({ world: "ocean", avatar: "🐸" });
  });
  it("creates one account copy and leaves the local project untouched", async () => {
    const values = new Map<string, string>();
    const storage: CopyStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
    };
    let creates = 0;
    let loads = 0;
    const input = {
      accountAlias: "adult",
      localProjectId: "free-1",
      store: {
        load: () => {
          loads++;
          return stored;
        },
        save: () => undefined,
      } as unknown as Pick<ProjectStore, "load" | "save">,
      projects: {
        create: async () => {
          creates++;
          return { projectId: "remote-1", revision: 1, semanticHash: storedHash };
        },
      } as unknown as Pick<ProjectApiClient, "create">,
      storage,
    };
    expect(await copyKidsProjectToAccount(input)).toEqual({
      status: "copied",
      remoteProjectId: "remote-1",
    });
    expect(await copyKidsProjectToAccount(input)).toEqual({
      status: "already-copied",
      remoteProjectId: "remote-1",
    });
    expect(creates).toBe(1);
    expect(loads).toBe(1);
  });

  it("reports a created server copy when browser storage fails", async () => {
    const result = await copyKidsProjectToAccount({
      accountAlias: "adult",
      localProjectId: "free-2",
      store: { load: () => stored, save: () => undefined } as unknown as Pick<
        ProjectStore,
        "load" | "save"
      >,
      projects: {
        create: async () => ({ projectId: "remote-2", revision: 1, semanticHash: storedHash }),
      } as unknown as Pick<ProjectApiClient, "create">,
      storage: {
        getItem: () => null,
        setItem: () => {
          throw Error("quota");
        },
      },
    });
    expect(result).toEqual({ status: "copied-untracked", remoteProjectId: "remote-2" });
  });

  it("updates only at the remembered revision and preserves it on conflict", async () => {
    const values = new Map<string, string>();
    const storage: CopyStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => void values.set(key, value),
    };
    const store = { load: () => stored, save: () => undefined } as unknown as Pick<
      ProjectStore,
      "load" | "save"
    >;
    const seen: number[] = [];
    const projects = {
      create: async () => ({ projectId: "remote-3", revision: 1, semanticHash: storedHash }),
      update: async (_id: string, revision: number) => {
        seen.push(revision);
        if (revision === 2) throw new ClientError("revision-conflict");
        return { projectId: "remote-3", revision: 2, semanticHash: storedHash };
      },
    } as unknown as Pick<ProjectApiClient, "create" | "update">;
    const input = { accountAlias: "adult", localProjectId: "free-3", store, projects, storage };
    await copyKidsProjectToAccount(input);
    expect(await updateKidsAccountCopy(input)).toBe("updated");
    await expect(updateKidsAccountCopy(input)).rejects.toMatchObject({
      kind: "revision-conflict",
    });
    expect(seen).toEqual([1, 2]);
  });

  it("pulls an account change only when the local project still matches the last push", async () => {
    const values = new Map<string, string>();
    const storage: CopyStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => void values.set(key, value),
    };
    let local = stored;
    let saves = 0;
    const store = {
      load: () => local,
      save: (_id: string, program: typeof stored.program, metadata: typeof stored.metadata) => {
        local = { ...local, program, metadata };
        saves++;
      },
    } as unknown as Pick<ProjectStore, "load" | "save">;
    const remote = {
      ...stored,
      metadata: { ...stored.metadata, hintLevel: 1 },
    };
    const projects = {
      create: async () => ({ projectId: "remote-4", revision: 1, semanticHash: storedHash }),
      get: async () => ({
        projectId: "remote-4",
        revision: 2,
        semanticHash: semanticProjectHash(remote as Parameters<typeof semanticProjectHash>[0]),
        storedProject: remote,
      }),
    } as unknown as Pick<ProjectApiClient, "create" | "get">;
    const input = { accountAlias: "adult", localProjectId: "free-4", store, projects, storage };
    await copyKidsProjectToAccount(input);
    expect(await pullKidsAccountCopy(input)).toBe("pulled");
    expect(local.metadata.hintLevel).toBe(1);
    expect(saves).toBe(1);

    local = { ...local, metadata: { ...local.metadata, hintLevel: 2 } };
    expect(await pullKidsAccountCopy(input)).toBe("local-conflict");
    expect(saves).toBe(1);
  });

  it("reconciles a local edit before Ori reads the account project", async () => {
    const values = new Map<string, string>();
    const storage: CopyStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => void values.set(key, value),
    };
    let local = stored;
    const store = { load: () => local, save: () => undefined } as unknown as Pick<
      ProjectStore,
      "load" | "save"
    >;
    let updates = 0;
    const projects = {
      create: async () => ({ projectId: "remote-5", revision: 1, semanticHash: storedHash }),
      get: async () => ({
        projectId: "remote-5",
        revision: 1,
        semanticHash: storedHash,
        storedProject: stored,
      }),
      update: async (_id: string, expectedRevision: number, next: typeof stored) => {
        expect(expectedRevision).toBe(1);
        updates++;
        return {
          projectId: "remote-5",
          revision: 2,
          semanticHash: semanticProjectHash(next as Parameters<typeof semanticProjectHash>[0]),
          storedProject: next,
        };
      },
    } as unknown as Pick<ProjectApiClient, "create" | "get" | "update">;
    const input = { accountAlias: "adult", localProjectId: "free-5", store, projects, storage };
    await copyKidsProjectToAccount(input);
    local = { ...stored, metadata: { ...stored.metadata, hintLevel: 1 } };
    expect(await reconcileKidsAccountProject(input)).toBe("updated");
    expect(updates).toBe(1);
  });

  it("accepts a newer remote revision when its project content is unchanged", async () => {
    const values = new Map<string, string>();
    const storage: CopyStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => void values.set(key, value),
    };
    let local = stored;
    const store = { load: () => local, save: () => undefined } as unknown as Pick<
      ProjectStore,
      "load" | "save"
    >;
    const projects = {
      create: async () => ({ projectId: "remote-7", revision: 1, semanticHash: storedHash }),
      get: async () => ({
        projectId: "remote-7",
        revision: 2,
        semanticHash: storedHash,
        storedProject: stored,
      }),
      update: async (_id: string, expectedRevision: number, next: typeof stored) => {
        expect(expectedRevision).toBe(2);
        return {
          projectId: "remote-7",
          revision: 3,
          semanticHash: semanticProjectHash(next as Parameters<typeof semanticProjectHash>[0]),
          storedProject: next,
        };
      },
    } as unknown as Pick<ProjectApiClient, "create" | "get" | "update">;
    const input = { accountAlias: "adult", localProjectId: "free-7", store, projects, storage };
    await copyKidsProjectToAccount(input);
    local = { ...stored, metadata: { ...stored.metadata, hintLevel: 1 } };
    expect(await reconcileKidsAccountProject(input)).toBe("updated");
    expect(kidsAccountCopy(storage, "adult", "free-7")?.remoteRevision).toBe(3);
  });

  it("refuses divergent local and account edits without writing either side", async () => {
    const values = new Map<string, string>();
    const storage: CopyStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => void values.set(key, value),
    };
    let local = stored;
    let writes = 0;
    const store = {
      load: () => local,
      save: () => {
        writes++;
      },
    } as unknown as Pick<ProjectStore, "load" | "save">;
    const remote = { ...stored, metadata: { ...stored.metadata, hintLevel: 2 } };
    const projects = {
      create: async () => ({ projectId: "remote-6", revision: 1, semanticHash: storedHash }),
      get: async () => ({
        projectId: "remote-6",
        revision: 2,
        semanticHash: semanticProjectHash(remote as Parameters<typeof semanticProjectHash>[0]),
        storedProject: remote,
      }),
      update: async () => {
        writes++;
        throw Error("must not update");
      },
    } as unknown as Pick<ProjectApiClient, "create" | "get" | "update">;
    const input = { accountAlias: "adult", localProjectId: "free-6", store, projects, storage };
    await copyKidsProjectToAccount(input);
    local = { ...stored, metadata: { ...stored.metadata, hintLevel: 1 } };
    expect(await reconcileKidsAccountProject(input)).toBe("conflict");
    expect(writes).toBe(0);
  });
});

describe("Kids account project recovery", () => {
  function fixture() {
    const values = new Map<string, string>();
    const storage: CopyStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => void values.set(key, value),
    };
    const projectStorage = {
      get: (key: string) => values.get(`agorix:${key}`) ?? null,
      set: (key: string, value: string) => void values.set(`agorix:${key}`, value),
      remove: (key: string) => void values.delete(`agorix:${key}`),
      has: (key: string) => values.has(`agorix:${key}`),
    };
    return { values, storage, store: new ProjectStore({ storage: projectStorage }) };
  }

  it("restores the same account identity once without creating another server project", async () => {
    const { values, storage, store } = fixture();
    values.set(
      "agorix.kids.projects.v1",
      JSON.stringify([{ id: "free-1", world: "space", avatar: "🦊" }]),
    );
    const projects = {
      get: async () => ({
        projectId: "remote-8",
        revision: 3,
        semanticHash: storedHash,
        storedProject: stored,
      }),
    } as unknown as Pick<ProjectApiClient, "get">;
    const input = {
      accountAlias: "adult",
      remoteProjectId: "remote-8",
      world: "ocean" as const,
      avatar: "🐼" as const,
      store,
      projects,
      storage,
    };
    expect(await restoreKidsAccountProject(input)).toEqual({
      status: "restored",
      localProjectId: "free-2",
    });
    expect(store.load("free-2")).toEqual(stored);
    expect(kidsAccountCopyByRemote(storage, "adult", "remote-8")).toBe("free-2");
    expect(await restoreKidsAccountProject(input)).toEqual({
      status: "already-linked",
      localProjectId: "free-2",
    });
    expect(JSON.parse(values.get("agorix.kids.projects.v1") ?? "[]")).toContainEqual({
      id: "free-2",
      world: "ocean",
      avatar: "🐼",
    });
  });

  it("repairs a stale link after the local project was deleted", async () => {
    const { values, storage, store } = fixture();
    const projects = {
      get: async () => ({
        projectId: "remote-13",
        revision: 4,
        semanticHash: storedHash,
        storedProject: stored,
      }),
    } as unknown as Pick<ProjectApiClient, "get">;
    const input = {
      accountAlias: "adult",
      remoteProjectId: "remote-13",
      world: "ocean" as const,
      avatar: "🐸" as const,
      store,
      projects,
      storage,
    };
    expect((await restoreKidsAccountProject(input)).status).toBe("restored");
    expect(deleteFreeProject("free-1", store, storage)).not.toBeNull();
    expect(kidsAccountCopyByRemote(storage, "adult", "remote-13", store)).toBeNull();
    expect(await restoreKidsAccountProject(input)).toEqual({
      status: "restored",
      localProjectId: "free-1",
    });
    expect(kidsAccountCopyByRemote(storage, "adult", "remote-13", store)).toBe("free-1");
    expect(JSON.parse(values.get("agorix.kids.account-project-copies.v1") ?? "[]")).toHaveLength(1);
  });

  it("rejects a mismatched project hash before writing local state", async () => {
    const { values, storage, store } = fixture();
    const projects = {
      get: async () => ({
        projectId: "remote-9",
        revision: 1,
        semanticHash: "fnv1a32:00000000",
        storedProject: stored,
      }),
    } as unknown as Pick<ProjectApiClient, "get">;
    expect(
      await restoreKidsAccountProject({
        accountAlias: "adult",
        remoteProjectId: "remote-9",
        world: "ocean",
        avatar: "🦊",
        store,
        projects,
        storage,
      }),
    ).toEqual({ status: "invalid-project" });
    expect(values.size).toBe(0);
  });

  it("uses the account world and avatar when the project carries them", async () => {
    const { values, storage, store } = fixture();
    const accountProject: StoredProject = {
      ...(stored as StoredProject),
      metadata: {
        ...(stored as StoredProject).metadata,
        kidsView: { world: "robots", avatar: "🦄" },
      },
    };
    const projects = {
      get: async () => ({
        projectId: "remote-12",
        revision: 1,
        semanticHash: semanticProjectHash(accountProject),
        storedProject: accountProject,
      }),
    } as unknown as Pick<ProjectApiClient, "get">;
    expect(
      await restoreKidsAccountProject({
        accountAlias: "adult",
        remoteProjectId: "remote-12",
        world: "ocean",
        avatar: "🦊",
        store,
        projects,
        storage,
      }),
    ).toEqual({ status: "restored", localProjectId: "free-1" });
    expect(JSON.parse(values.get("agorix.kids.projects.v1") ?? "[]")).toEqual([
      { id: "free-1", world: "robots", avatar: "🦄" },
    ]);
  });

  it("rolls back the local view when its account link cannot be stored", async () => {
    const { values, store } = fixture();
    const storage: CopyStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        if (key === "agorix.kids.account-project-copies.v1") throw Error("storage full");
        values.set(key, value);
      },
    };
    const projects = {
      get: async () => ({
        projectId: "remote-10",
        revision: 1,
        semanticHash: storedHash,
        storedProject: stored,
      }),
    } as unknown as Pick<ProjectApiClient, "get">;
    expect(
      await restoreKidsAccountProject({
        accountAlias: "adult",
        remoteProjectId: "remote-10",
        world: "ocean",
        avatar: "🦊",
        store,
        projects,
        storage,
      }),
    ).toEqual({ status: "storage-unavailable" });
    expect(store.has("free-1")).toBe(false);
    expect(JSON.parse(values.get("agorix.kids.projects.v1") ?? "[]")).toEqual([]);
  });
});
