import { beforeEach, describe, expect, it, vi } from "vitest";
import { SCHEMA_VERSION } from "@agorix/program-model";

type Handler = (...args: unknown[]) => unknown;

const handlers = new Map<string, Handler>();
const files = new Map<string, Uint8Array>();
const shown: string[] = [];
const diffs: unknown[][] = [];
const output: string[] = [];
const treeViews: string[] = [];
const providers = new Map<string, { provideTextDocumentContent(uri: unknown): string }>();
const revealed: unknown[] = [];
let failRegistration = false;
let choice: string | undefined;
let picked: { fsPath: string } | undefined;
let quickPick: { id: string; label: string } | undefined;

vi.mock("vscode", () => {
  const uri = (fsPath: string) => ({
    fsPath,
    path: fsPath.replace(/^[^:]+:/, ""),
    scheme: fsPath.includes(":") ? fsPath.split(":")[0] : "file",
    toString: () => fsPath,
  });
  class Uri {
    static parse(value: string) {
      return uri(value);
    }
  }
  class TreeItem {
    description?: string | boolean;
    contextValue?: string;
    command?: unknown;
    constructor(
      public label: string,
      public collapsibleState?: unknown,
    ) {}
  }
  class EventEmitter<T = unknown> {
    event = vi.fn();
    fire = vi.fn((_value?: T) => undefined);
    dispose() {}
  }
  class Position {
    constructor(
      public line: number,
      public character: number,
    ) {}
  }
  class Range {
    constructor(
      public start: Position,
      public end: Position,
    ) {}
  }
  class Selection extends Range {}
  return {
    Uri,
    TreeItem,
    TreeItemCollapsibleState: { None: 0 },
    EventEmitter,
    Position,
    Range,
    Selection,
    TextEditorRevealType: { InCenterIfOutsideViewport: 2 },
    commands: {
      registerCommand: (name: string, handler: Handler) => {
        if (failRegistration) {
          throw new Error("registration refused");
        }
        handlers.set(name, handler);
        return { dispose() {} };
      },
      executeCommand: async (...args: unknown[]) => {
        diffs.push(args);
      },
    },
    window: {
      showOpenDialog: async () => (picked === undefined ? undefined : [picked]),
      showInformationMessage: async (message: string) => {
        shown.push(message);
        return choice;
      },
      showWarningMessage: async (message: string) => {
        shown.push(message);
        return undefined;
      },
      showQuickPick: async () => quickPick,
      showErrorMessage: async (message: string) => {
        shown.push(message);
        return undefined;
      },
      showTextDocument: async () => ({
        selection: undefined,
        revealRange: (range: unknown) => revealed.push(range),
      }),
      createTreeView: (id: string) => {
        treeViews.push(id);
        return { dispose() {} };
      },
      createOutputChannel: () => ({
        clear: () => (output.length = 0),
        appendLine: (line: string) => output.push(line),
        show() {},
        dispose() {},
      }),
    },
    workspace: {
      registerTextDocumentContentProvider: (
        scheme: string,
        provider: { provideTextDocumentContent(uri: unknown): string },
      ) => {
        providers.set(scheme, provider);
        return { dispose() {} };
      },
      openTextDocument: async (target: { content?: string; toString?: () => string }) => {
        if ("content" in target && target.content !== undefined) {
          return { uri: uri(`untitled:${target.content.length}`), content: target.content };
        }
        return {
          uri: target,
          content: providers.get("agorix-studio")?.provideTextDocumentContent(target) ?? "",
        };
      },
      fs: {
        readFile: async (target: { fsPath: string }) =>
          files.get(target.fsPath) ?? new Uint8Array(),
        writeFile: async (target: { fsPath: string }, content: Uint8Array) => {
          files.set(target.fsPath, content);
        },
      },
    },
    languages: {
      setTextDocumentLanguage: async (document: unknown) => document,
    },
    __uri: uri,
  };
});

const stored = (statements: unknown[]) =>
  JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    program: {
      schema: SCHEMA_VERSION,
      scripts: [{ id: "main", trigger: { type: "onStart" }, statements }],
    },
    metadata: {
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      missionProgress: 0,
      hintLevel: 0,
      locale: "en",
    },
  });

const repeated = stored(
  [1, 2, 3].flatMap(() => [
    { type: "move", steps: 20 },
    { type: "turn", degrees: 90 },
  ]),
);

async function openFile(path: string, content: string) {
  files.set(path, new TextEncoder().encode(content));
  picked = { fsPath: path };
  await handlers.get("agorixStudio.openProject")!();
}

describe("Studio extension wiring", () => {
  beforeEach(async () => {
    handlers.clear();
    files.clear();
    shown.length = 0;
    diffs.length = 0;
    output.length = 0;
    treeViews.length = 0;
    providers.clear();
    revealed.length = 0;
    choice = undefined;
    quickPick = undefined;
    failRegistration = false;
    picked = undefined;
    vi.resetModules();
    const extension = await import("./extension.js");
    extension.activate({ subscriptions: [] } as never);
  });

  it("registers commands, virtual projection provider and native Activity Bar views", () => {
    expect([...handlers.keys()].sort()).toEqual([
      "agorixStudio.openProject",
      "agorixStudio.openProjection",
      "agorixStudio.revealCanonicalNode",
      "agorixStudio.showEvidence",
      "agorixStudio.suggestRepeat",
      "agorixStudio.switchProjection",
    ]);
    expect([...providers.keys()]).toEqual(["agorix-studio"]);
    expect(treeViews.sort()).toEqual([
      "agorixStudio.companion",
      "agorixStudio.missions",
      "agorixStudio.progress",
      "agorixStudio.projects",
      "agorixStudio.worlds",
    ]);
  });

  it("asks to open a project before evidence or suggestions", async () => {
    await handlers.get("agorixStudio.showEvidence")!();
    await handlers.get("agorixStudio.suggestRepeat")!();
    expect(shown).toEqual(["Open an Agorix project first.", "Open an Agorix project first."]);
  });

  it("reports an invalid project file instead of crashing", async () => {
    await openFile("/p/bad.json", "{ not json");
    expect(shown[0]).toContain("could not open this project");
  });

  it("prints the execution inspector for an opened project", async () => {
    await openFile("/p/a.json", repeated);
    await handlers.get("agorixStudio.showEvidence")!();
    expect(output[0]).toContain("Outcome:");
    expect(output.some((line) => line.includes("Step 1"))).toBe(true);
    expect(revealed).toHaveLength(1);
  });

  it("opens and switches read-only projection documents without rewriting the project", async () => {
    await openFile("/p/a.json", repeated);
    const before = new TextDecoder().decode(files.get("/p/a.json"));

    await handlers.get("agorixStudio.openProjection")!("agorix-code");
    expect(shown.at(-1)).toMatch(/Read-only/i);

    quickPick = { id: "python", label: "Python" };
    await handlers.get("agorixStudio.switchProjection")!();
    expect(shown.at(-1)).toMatch(/Read-only Python projection/i);
    expect(new TextDecoder().decode(files.get("/p/a.json"))).toBe(before);
  });

  it("shows a diff and does not write the file unless the learner applies", async () => {
    await openFile("/p/a.json", repeated);
    const before = new TextDecoder().decode(files.get("/p/a.json"));
    choice = "Reject";
    await handlers.get("agorixStudio.suggestRepeat")!();
    expect(diffs[0]?.[0]).toBe("vscode.diff");
    expect(new TextDecoder().decode(files.get("/p/a.json"))).toBe(before);
  });

  it("writes the repeat program back to the same file on Apply", async () => {
    await openFile("/p/a.json", repeated);
    choice = "Apply";
    await handlers.get("agorixStudio.suggestRepeat")!();
    const written = JSON.parse(new TextDecoder().decode(files.get("/p/a.json")));
    expect(written.program.scripts[0].statements).toEqual([
      {
        type: "repeat",
        count: 3,
        body: [
          { type: "move", steps: 20 },
          { type: "turn", degrees: 90 },
        ],
      },
    ]);
  });

  it("says so when nothing repeats", async () => {
    await openFile("/p/b.json", stored([{ type: "move", steps: 5 }]));
    await handlers.get("agorixStudio.suggestRepeat")!();
    expect(shown.at(-1)).toContain("No suggestion");
    expect(diffs).toHaveLength(0);
  });

  it("surfaces a command failure to the learner and the output channel", async () => {
    await openFile("/p/a.json", repeated);
    shown.length = 0;
    // Corrupt the open file so the Apply write-back path throws.
    choice = "Apply";
    files.delete("/p/a.json");
    const vscode = await import("vscode");
    vi.spyOn(vscode.workspace.fs, "writeFile").mockRejectedValueOnce(new Error("disk full"));
    await handlers.get("agorixStudio.suggestRepeat")!();
    expect(shown.some((m) => m.includes("Suggest repeat failed") && m.includes("disk full"))).toBe(
      true,
    );
  });

  it("surfaces an activation failure and rethrows it", async () => {
    handlers.clear();
    failRegistration = true;
    const extension = await import("./extension.js");
    expect(() => extension.activate({ subscriptions: [] } as never)).toThrow(
      "registration refused",
    );
    expect(shown.some((m) => m.includes("activation failed"))).toBe(true);
  });
});
