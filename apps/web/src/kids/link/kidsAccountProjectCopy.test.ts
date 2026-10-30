import { describe, expect, it } from "vitest";
import { semanticProjectHash, type ProjectStore } from "@agorix/persistence";
import type { ProjectApiClient } from "../../accounts/clients.js";
import { ClientError } from "../../accounts/clients.js";
import {
  copyKidsProjectToAccount,
  pullKidsAccountCopy,
  reconcileKidsAccountProject,
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
      } as unknown as Pick<ProjectStore, "load">,
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
      store: { load: () => stored } as unknown as Pick<ProjectStore, "load">,
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
    const store = { load: () => stored } as unknown as Pick<ProjectStore, "load">;
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
