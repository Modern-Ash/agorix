import { semanticProjectHash, type StoredProject } from "@agorix/persistence";
import { describe, expect, it } from "vitest";
import { createDevBackend } from "../dev/devBackend.js";
import { createInProcessFetch } from "../dev/inProcessFetch.js";
import { addBlockToWorkspace, createEditorModel, type EditorModel } from "../editorModel.js";
import { ClientError, isClientError } from "./clients.js";
import { createHttpBackend } from "./httpClient.js";
import {
  DRAFT_KEY,
  IMPORT_DECISIONS_KEY,
  WorkspaceController,
  type WorkspaceState,
} from "./workspace.js";

const PASSWORD = "correct horse battery";

class MemoryStorage implements Storage {
  private readonly map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(index: number) {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
}

function stored(blocks = 0): StoredProject {
  let model: EditorModel = createEditorModel();
  for (let i = 0; i < blocks; i += 1) {
    model = { ...model, ...addBlockToWorkspace(model.workspace, "motion_move") };
  }
  return {
    schemaVersion: model.program.schema,
    program: model.program,
    metadata: {
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      missionProgress: blocks > 0 ? 1 : 0,
      hintLevel: 0,
      locale: "en",
    },
  };
}

function setup(local?: StoredProject) {
  const backend = createDevBackend();
  const net = createInProcessFetch(backend);
  const http = createHttpBackend({ fetch: net.fetch });
  const storage = new MemoryStorage();
  let cleared = 0;
  const controller = new WorkspaceController({
    backend: http,
    storage,
    readLocalProject: () => local,
    onAccountContentCleared: () => {
      cleared += 1;
    },
    setTimer: () => 0,
    clearTimer: () => undefined,
  });
  return { backend, net, http, storage, controller, cleared: () => cleared };
}

async function waitFor(controller: WorkspaceController, ok: (s: WorkspaceState) => boolean) {
  for (let i = 0; i < 200; i += 1) {
    if (ok(controller.getState())) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`state never reached: ${JSON.stringify(controller.getState().saveState)}`);
}

describe("account journeys against the in-process dev backend", () => {
  it("is anonymous without a session, then registers, signs in and lists nothing", async () => {
    const { controller } = setup();
    await controller.init();
    expect(controller.getState().authStatus).toBe("anonymous");
    await controller.register("Ada Lovelace", PASSWORD);
    const state = controller.getState();
    expect(state.authStatus).toBe("authenticated");
    expect(state.account?.alias).toBe("Ada Lovelace");
    expect(state.projects).toEqual({ status: "ready", items: [] });
  });

  it("reports unavailable when no Agorix server answers", async () => {
    const controller = new WorkspaceController({
      backend: createHttpBackend({
        fetch: async () => ({ status: 404, text: async () => "<html>nope</html>" }),
      }),
      readLocalProject: () => undefined,
    });
    await controller.init();
    expect(controller.getState().authStatus).toBe("unavailable");
  });

  it("treats a network failure on restore as anonymous, not as signed in", async () => {
    const { controller, net } = setup();
    net.setOffline(true);
    await controller.init();
    expect(controller.getState().authStatus).toBe("anonymous");
  });

  it("gives the same generic error for unknown user and wrong password", async () => {
    const { controller } = setup();
    await controller.register("grace-h", PASSWORD);
    await controller.signOut();
    const wrong = await controller.signIn("grace-h", "not the password").catch((e: unknown) => e);
    const unknown = await controller.signIn("nobody-here", PASSWORD).catch((e: unknown) => e);
    expect(isClientError(wrong, "invalid-credentials")).toBe(true);
    expect(isClientError(unknown, "invalid-credentials")).toBe(true);
    expect((wrong as ClientError).message).toBe((unknown as ClientError).message);
  });

  it("surfaces taken alias and weak password as typed errors", async () => {
    const { controller } = setup();
    await controller.register("taken-one", PASSWORD);
    await controller.signOut();
    const taken = await controller.register("Taken-One", PASSWORD).catch((e: unknown) => e);
    expect(isClientError(taken, "username-taken")).toBe(true);
    const weak = await controller.register("other-one", "short").catch((e: unknown) => e);
    expect(isClientError(weak, "validation")).toBe(true);
    const email = await controller.register("a@b.co", PASSWORD).catch((e: unknown) => e);
    expect(isClientError(email, "validation")).toBe(true);
  });
});

describe("private project CRUD and persistence", () => {
  it("creates, renames, duplicates, deletes and reloads durably", async () => {
    const { controller, http } = setup();
    await controller.register("crud-user", PASSWORD);
    const created = await controller.createProject("First", stored(1));
    expect(controller.getState().active?.projectId).toBe(created.projectId);
    await controller.renameProject(created.projectId, "Renamed");
    const copy = await controller.duplicateProject(created.projectId, "Renamed copy");
    expect(copy.semanticHash).toBe(created.semanticHash);
    expect(
      controller
        .getState()
        .projects.items.map((p) => p.title)
        .sort(),
    ).toEqual(["Renamed", "Renamed copy"]);

    // "Reload": a fresh controller over the same cookie jar sees the durable projects.
    const fresh = new WorkspaceController({
      backend: http,
      readLocalProject: () => undefined,
    });
    await fresh.init();
    expect(fresh.getState().projects.items).toHaveLength(2);

    await controller.deleteProject(copy.projectId);
    expect(controller.getState().projects.items.map((p) => p.title)).toEqual(["Renamed"]);
  });

  it("autosaves with the new revision and reports Saved", async () => {
    const { controller, http } = setup();
    await controller.register("save-user", PASSWORD);
    const created = await controller.createProject("Auto", stored(1));
    controller.queueSave(stored(2));
    await waitFor(controller, (s) => s.saveState === "saved" && s.active?.revision === 2);
    const loaded = await http.projects.get(created.projectId);
    expect(loaded.semanticHash).toBe(semanticProjectHash(stored(2)));
  });

  it("never persists undo/redo history", async () => {
    const { http, controller } = setup();
    await controller.register("history-user", PASSWORD);
    const polluted = { ...stored(1), history: { undo: [] } } as unknown as StoredProject;
    const result = await http.projects.create("x", polluted).catch((e: unknown) => e);
    expect(isClientError(result, "validation")).toBe(true);
  });
});

describe("truthful save states", () => {
  it("goes Offline, keeps a device draft, and recovers when the network returns", async () => {
    const { controller, net, storage } = setup();
    await controller.register("offline-user", PASSWORD);
    await controller.createProject("Off", stored(1));
    net.setOffline(true);
    controller.queueSave(stored(2));
    await waitFor(controller, (s) => s.saveState === "offline");
    expect(controller.getState().deviceDraftOk).toBe(true);
    expect(storage.getItem(DRAFT_KEY)).not.toBeNull();
    net.setOffline(false);
    controller.retrySave();
    await waitFor(controller, (s) => s.saveState === "saved");
    expect(storage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("does not claim device safety when the draft cannot be written", async () => {
    const { controller, net, storage } = setup();
    await controller.register("full-user", PASSWORD);
    await controller.createProject("Full", stored(1));
    storage.setItem = () => {
      throw new Error("quota");
    };
    net.setOffline(true);
    controller.queueSave(stored(2));
    await waitFor(controller, (s) => s.saveState === "offline");
    expect(controller.getState().deviceDraftOk).toBe(false);
  });

  it("flips to Session expired, keeps the draft and resumes after the same account signs in", async () => {
    const { controller, net, storage } = setup();
    await controller.register("expire-user", PASSWORD);
    const created = await controller.createProject("Exp", stored(1));
    net.setSessionCookie("not-a-real-session");
    controller.queueSave(stored(2));
    await waitFor(controller, (s) => s.saveState === "session-expired");
    expect(controller.getState().authStatus).toBe("session-expired");
    expect(storage.getItem(DRAFT_KEY)).not.toBeNull();
    await controller.signIn("expire-user", PASSWORD);
    await waitFor(controller, (s) => s.saveState === "saved");
    const loaded = await controller.openProject(created.projectId);
    expect(loaded.dto.semanticHash).toBe(semanticProjectHash(stored(2)));
  });

  it("detects a revision conflict and requires an explicit choice", async () => {
    const { controller, http } = setup();
    await controller.register("conflict-user", PASSWORD);
    const created = await controller.createProject("Conf", stored(1));
    // Another tab/device saves first.
    await http.projects.update(created.projectId, 1, stored(3));
    controller.queueSave(stored(2));
    await waitFor(controller, (s) => s.saveState === "conflict");
    const state = controller.getState();
    expect(state.conflictDialogOpen).toBe(true);
    expect(state.conflict?.currentRevision).toBe(2);
    // Server data was NOT overwritten.
    expect((await http.projects.get(created.projectId)).semanticHash).toBe(
      semanticProjectHash(stored(3)),
    );
    // Cancel keeps the conflict and pauses autosave.
    await controller.resolveConflict("cancel");
    expect(controller.getState().saveState).toBe("conflict");
    controller.queueSave(stored(4));
    expect(controller.getState().saveState).toBe("conflict");
    expect((await http.projects.get(created.projectId)).revision).toBe(2);
  });

  it("resolves a conflict by reloading the latest or saving a copy", async () => {
    const { controller, http } = setup();
    await controller.register("resolve-user", PASSWORD);
    const created = await controller.createProject("Res", stored(1));
    await http.projects.update(created.projectId, 1, stored(3));
    controller.queueSave(stored(2));
    await waitFor(controller, (s) => s.saveState === "conflict");
    const copy = await controller.resolveConflict("copy", "Res (copy)");
    expect(copy?.semanticHash).toBe(semanticProjectHash(stored(2)));
    expect(controller.getState().saveState).toBe("saved");
    expect((await http.projects.get(created.projectId)).semanticHash).toBe(
      semanticProjectHash(stored(3)),
    );

    controller.queueSave(stored(5));
    await waitFor(controller, (s) => s.saveState === "saved" && s.active?.revision === 2);
    await http.projects.update(copy!.projectId, 2, stored(6));
    controller.queueSave(stored(7));
    await waitFor(controller, (s) => s.saveState === "conflict");
    const latest = await controller.resolveConflict("reload");
    expect(latest?.semanticHash).toBe(semanticProjectHash(stored(6)));
    expect(controller.getState().saveState).toBe("saved");
  });
});

describe("explicit local project import", () => {
  it("offers, never uploads silently, and imports on request keeping the local copy", async () => {
    const local = stored(2);
    const { controller, http, storage } = setup(local);
    await controller.register("import-user", PASSWORD);
    expect(controller.getState().importOffer.phase).toBe("offered");
    expect(await http.projects.list()).toHaveLength(0);
    const dto = await controller.importLocalProject("My project");
    expect(dto?.semanticHash).toBe(semanticProjectHash(local));
    expect(controller.getState().importOffer.phase).toBe("imported");
    expect(controller.getState().projects.items).toHaveLength(1);
    // never offered again
    await controller.signOut();
    await controller.signIn("import-user", PASSWORD);
    expect(controller.getState().importOffer.phase).toBe("none");
    expect(storage.getItem(IMPORT_DECISIONS_KEY)).toContain("imported");
  });

  it("does not nag after keep-local, across sign-outs", async () => {
    const { controller, http } = setup(stored(1));
    await controller.register("keep-user", PASSWORD);
    controller.keepLocalOnly();
    expect(await http.projects.list()).toHaveLength(0);
    await controller.signOut();
    await controller.signIn("keep-user", PASSWORD);
    expect(controller.getState().importOffer.phase).toBe("none");
  });

  it("offers nothing when no local project exists", async () => {
    const { controller } = setup(undefined);
    await controller.register("none-user", PASSWORD);
    expect(controller.getState().importOffer.phase).toBe("none");
  });

  it("a failed import leaves everything intact and can be retried", async () => {
    const local = stored(2);
    const { controller, net, http } = setup(local);
    await controller.register("fail-user", PASSWORD);
    net.setOffline(true);
    expect(await controller.importLocalProject("My project")).toBeUndefined();
    expect(controller.getState().importOffer.phase).toBe("failed");
    net.setOffline(false);
    expect(await http.projects.list()).toHaveLength(0);
    const dto = await controller.importLocalProject("My project");
    expect(dto).toBeDefined();
  });
});

describe("account cache isolation", () => {
  it("clears project list, active project and drafts on sign-out", async () => {
    const { controller, storage, cleared } = setup();
    await controller.register("iso-a", PASSWORD);
    await controller.createProject("A secret", stored(1));
    controller.queueSave(stored(2));
    await controller.signOut();
    const state = controller.getState();
    expect(state.account).toBeUndefined();
    expect(state.projects.items).toEqual([]);
    expect(state.active).toBeUndefined();
    expect(storage.getItem(DRAFT_KEY)).toBeNull();
    expect(cleared()).toBeGreaterThan(0);
  });

  it("account B never sees account A's projects", async () => {
    const { controller } = setup();
    await controller.register("iso-a2", PASSWORD);
    await controller.createProject("A only", stored(1));
    await controller.signOut();
    await controller.register("iso-b2", PASSWORD);
    expect(controller.getState().projects.items).toEqual([]);
    const aItems = JSON.stringify(controller.getState());
    expect(aItems).not.toContain("A only");
  });

  it("drops A's unsynced draft when B signs in after A's session expired", async () => {
    const { controller, net, storage, http } = setup();
    await controller.register("iso-a3", PASSWORD);
    await controller.createProject("A draft", stored(1));
    net.setSessionCookie("gone");
    controller.queueSave(stored(2));
    await waitFor(controller, (s) => s.saveState === "session-expired");
    await controller.signOut();
    await controller.register("iso-b3", PASSWORD);
    expect(storage.getItem(DRAFT_KEY)).toBeNull();
    expect(controller.getState().active).toBeUndefined();
    expect(await http.projects.list()).toHaveLength(0);
  });
});
