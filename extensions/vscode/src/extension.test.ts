import { beforeEach, describe, expect, it, vi } from "vitest";
import { SCHEMA_VERSION } from "@agorix/program-model";
import { serializeAgorixProject } from "@agorix/persistence";

type Handler = (...args: unknown[]) => unknown;

const handlers = new Map<string, Handler>();
const files = new Map<string, Uint8Array>();
const shown: string[] = [];
const diffs: unknown[][] = [];
const output: string[] = [];
const treeViews: string[] = [];
const treeProviders = new Map<string, { getChildren(): unknown[] }>();
const providers = new Map<string, { provideTextDocumentContent(uri: unknown): string }>();
const revealed: unknown[] = [];
const executedTasks: unknown[] = [];
const commandCalls: unknown[][] = [];
const secrets = new Map<string, string>();
const webviewPanels: Array<{
  readonly messages: unknown[];
  readonly reveal: ReturnType<typeof vi.fn>;
  receive(message: unknown): void;
  html: string;
}> = [];
let failRegistration = false;
let choice: string | undefined;
let picked: { fsPath: string } | undefined;
let savePicked: { fsPath: string } | undefined;
let quickPick: Record<string, unknown> | undefined;
let quickPicks: Array<Record<string, unknown> | undefined> = [];
let inputBox: string | undefined;
let serverUrl = "";

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
    static file(value: string) {
      return uri(value);
    }
    static joinPath(base: { fsPath: string }, ...paths: string[]) {
      return uri([base.fsPath.replace(/\/$/, ""), ...paths].join("/"));
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
  class ShellExecution {
    constructor(public commandLine: string) {}
  }
  class Task {
    problemMatchers: unknown[] = [];
    constructor(
      public definition: unknown,
      public scope: unknown,
      public name: string,
      public source: string,
      public execution: ShellExecution,
      public problemMatchersInput: unknown[],
    ) {}
  }
  return {
    Uri,
    TreeItem,
    TreeItemCollapsibleState: { None: 0 },
    EventEmitter,
    Position,
    Range,
    Selection,
    ShellExecution,
    Task,
    TextEditorRevealType: { InCenterIfOutsideViewport: 2 },
    ViewColumn: { Beside: 2 },
    StatusBarAlignment: { Left: 1 },
    commands: {
      registerCommand: (name: string, handler: Handler) => {
        if (failRegistration) {
          throw new Error("registration refused");
        }
        handlers.set(name, handler);
        return { dispose() {} };
      },
      executeCommand: async (...args: unknown[]) => {
        commandCalls.push(args);
        if (args[0] === "vscode.diff") {
          diffs.push(args);
        }
      },
    },
    env: {
      language: "en-US",
    },
    window: {
      showOpenDialog: async () => (picked === undefined ? undefined : [picked]),
      showSaveDialog: async () => savePicked,
      showInputBox: async () => inputBox,
      showInformationMessage: async (message: string, ...items: string[]) => {
        shown.push(message);
        return items.includes(choice ?? "") ? choice : undefined;
      },
      showWarningMessage: async (message: string, ...items: string[]) => {
        shown.push(message);
        return items.includes(choice ?? "") ? choice : undefined;
      },
      showQuickPick: async () => (quickPicks.length > 0 ? quickPicks.shift() : quickPick),
      showErrorMessage: async (message: string) => {
        shown.push(message);
        return undefined;
      },
      showTextDocument: async () => ({
        selection: undefined,
        revealRange: (range: unknown) => revealed.push(range),
      }),
      createTreeView: (id: string, options: { treeDataProvider: { getChildren(): unknown[] } }) => {
        treeViews.push(id);
        treeProviders.set(id, options.treeDataProvider);
        return { dispose() {} };
      },
      createWebviewPanel: () => {
        let receive: ((message: unknown) => void) | undefined;
        const panel = {
          messages: [] as unknown[],
          reveal: vi.fn(),
          receive: (message: unknown) => receive?.(message),
          html: "",
        };
        webviewPanels.push(panel);
        return {
          webview: {
            cspSource: "vscode-webview:",
            asWebviewUri: (target: { fsPath: string }) => uri(`vscode-webview:${target.fsPath}`),
            get html() {
              return panel.html;
            },
            set html(value: string) {
              panel.html = value;
            },
            postMessage: async (message: unknown) => {
              panel.messages.push(message);
              return true;
            },
            onDidReceiveMessage: (listener: (message: unknown) => void) => {
              receive = listener;
              return { dispose() {} };
            },
          },
          reveal: panel.reveal,
          onDidDispose: vi.fn(),
          dispose: vi.fn(),
        };
      },
      createStatusBarItem: () => ({
        text: "",
        tooltip: "",
        command: undefined as unknown,
        show() {},
        dispose() {},
      }),
      createOutputChannel: () => ({
        clear: () => (output.length = 0),
        appendLine: (line: string) => output.push(line),
        show() {},
        dispose() {},
      }),
    },
    workspace: {
      workspaceFolders: [{ uri: uri("/workspace"), name: "workspace", index: 0 }],
      getConfiguration: () => ({
        get: (_key: string, defaultValue: string) => serverUrl || defaultValue,
      }),
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
    tasks: {
      executeTask: async (task: unknown) => {
        executedTasks.push(task);
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

const parseStored = (raw: string) =>
  JSON.parse(raw) as Parameters<typeof serializeAgorixProject>[0];

const flushWorkbench = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

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
    treeProviders.clear();
    providers.clear();
    revealed.length = 0;
    executedTasks.length = 0;
    commandCalls.length = 0;
    secrets.clear();
    webviewPanels.length = 0;
    choice = undefined;
    quickPick = undefined;
    quickPicks = [];
    savePicked = undefined;
    inputBox = undefined;
    serverUrl = "";
    failRegistration = false;
    picked = undefined;
    vi.stubGlobal("fetch", undefined);
    vi.resetModules();
    const extension = await import("./extension.js");
    extension.activate({
      subscriptions: [],
      extensionUri: (await import("vscode")).Uri.file("/extension"),
      asAbsolutePath: (relativePath: string) => `/extension/${relativePath}`,
      secrets: {
        get: async (key: string) => secrets.get(key),
        store: async (key: string, value: string) => {
          secrets.set(key, value);
        },
        delete: async (key: string) => {
          secrets.delete(key);
        },
      },
    } as never);
  });

  it("registers commands, virtual projection provider and native Activity Bar views", () => {
    expect([...handlers.keys()].sort()).toEqual(
      [
        "agorixStudio.createProject",
        "agorixStudio.checkAgentHealth",
        "agorixStudio.clearAgentCredential",
        "agorixStudio.setAgentCredential",
        "agorixStudio.openProject",
        "agorixStudio.openProjection",
        "agorixStudio.openWorldPreview",
        "agorixStudio.openWorkbench",
        "agorixStudio.exportAgorix",
        "agorixStudio.applyProposal",
        "agorixStudio.companionBuild",
        "agorixStudio.companionChallenge",
        "agorixStudio.companionDebug",
        "agorixStudio.companionExplain",
        "agorixStudio.companionReflect",
        "agorixStudio.listRemoteProjects",
        "agorixStudio.openRemoteProject",
        "agorixStudio.openScm",
        "agorixStudio.redoProposal",
        "agorixStudio.rejectProposal",
        "agorixStudio.revealCanonicalNode",
        "agorixStudio.revealProposalAffectedNode",
        "agorixStudio.reset",
        "agorixStudio.run",
        "agorixStudio.runChecks",
        "agorixStudio.saveRemoteProject",
        "agorixStudio.selectExecutionStep",
        "agorixStudio.showEvidence",
        "agorixStudio.showDeveloperContext",
        "agorixStudio.signIn",
        "agorixStudio.signOut",
        "agorixStudio.suggestFirstStep",
        "agorixStudio.suggestRepeat",
        "agorixStudio.step",
        "agorixStudio.stop",
        "agorixStudio.switchProjection",
        "agorixStudio.undoProposal",
        "agorixStudio.validateProject",
      ].sort(),
    );
    expect([...providers.keys()]).toEqual(["agorix-studio"]);
    expect(treeViews.sort()).toEqual([
      "agorixStudio.companion",
      "agorixStudio.companionHistory",
      "agorixStudio.developer",
      "agorixStudio.inspector",
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

  it("opens one Workbench beside the current project and ignores malformed messages", async () => {
    await handlers.get("agorixStudio.openWorkbench")!();
    expect(shown.at(-1)).toContain("Open an Agorix project first");
    expect(webviewPanels).toHaveLength(0);

    await openFile("/p/workbench.json", stored([]));
    await handlers.get("agorixStudio.openWorkbench")!();
    await handlers.get("agorixStudio.openWorkbench")!();

    expect(webviewPanels).toHaveLength(1);
    expect(webviewPanels[0]?.reveal).toHaveBeenCalledTimes(1);
    expect(webviewPanels[0]?.html).toContain("Content-Security-Policy");
    expect(webviewPanels[0]?.html).toContain("Agorix Workbench");
    expect(webviewPanels[0]?.messages.at(-1)).toMatchObject({ type: "workspace" });

    const before = new TextDecoder().decode(files.get("/p/workbench.json"));
    expect(() => webviewPanels[0]?.receive({})).not.toThrow();
    expect(() => webviewPanels[0]?.receive("x")).not.toThrow();
    expect(() =>
      webviewPanels[0]?.receive({
        schema: "agorix/studio-protocol/v1",
        type: "intent",
        intent: { type: "revealNode", nodeId: "/etc/passwd" },
      }),
    ).not.toThrow();
    expect(new TextDecoder().decode(files.get("/p/workbench.json"))).toBe(before);
  });

  it("shows clean-install project actions before a project is open", () => {
    const rows = treeProviders.get("agorixStudio.projects")?.getChildren() ?? [];

    expect(JSON.stringify(rows)).toContain("Create New Project");
    expect(JSON.stringify(rows)).toContain("Open local .agorix project");
    expect(JSON.stringify(rows)).toContain("Open account project");
    expect(commandCalls).toContainEqual(["setContext", "agorixStudio.hasProject", false]);
  });

  it("creates a local First Mission .agorix project and opens it immediately", async () => {
    inputBox = "My First Mission!";
    quickPicks = [
      { id: "first-mission", label: "First Mission" },
      { id: "en", label: "English" },
    ];
    savePicked = { fsPath: "/workspace/my-first-mission.agorix" };

    const uri = await handlers.get("agorixStudio.createProject")!();
    const raw = new TextDecoder().decode(files.get("/workspace/my-first-mission.agorix"));
    const envelope = JSON.parse(raw);

    expect(uri).toMatchObject({ fsPath: "/workspace/my-first-mission.agorix" });
    expect(envelope.format).toBe("agorix-project");
    expect(envelope.project.schemaVersion).toBe(SCHEMA_VERSION);
    expect(envelope.project.metadata.locale).toBe("en");
    expect(envelope.project.program.scripts[0].statements).toEqual([]);
    expect(commandCalls).toContainEqual(["setContext", "agorixStudio.hasProject", true]);
    expect(shown.at(-1)).toContain("Created Agorix project");

    const run = await handlers.get("agorixStudio.run")!();
    const step = await handlers.get("agorixStudio.step")!();
    expect(run).toMatchObject({ status: "completed" });
    expect(step).toMatchObject({ status: "completed" });
  });

  it("cancels local project creation without writing partial files", async () => {
    inputBox = "Cancelled";
    quickPicks = [{ id: "blank", label: "Blank project" }];
    savePicked = undefined;

    const created = await handlers.get("agorixStudio.createProject")!();

    expect(created).toBeUndefined();
    expect(files.size).toBe(0);
    expect(commandCalls).not.toContainEqual(["setContext", "agorixStudio.hasProject", true]);
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

  it("drives World Preview and Execution Inspector from one runtime session", async () => {
    await openFile("/p/a.json", repeated);

    const reset = await handlers.get("agorixStudio.reset")!();
    expect(reset).toMatchObject({ status: "idle", selectedFrameIndex: 0 });

    const stepped = await handlers.get("agorixStudio.step")!();
    expect(stepped).toMatchObject({ status: "running", selectedFrameIndex: 1 });

    const preview = await handlers.get("agorixStudio.openWorldPreview")!();
    expect(preview).toMatchObject({ selectedFrameIndex: 1 });
    expect(webviewPanels).toHaveLength(1);
    expect(webviewPanels[0]?.html).toContain("Content-Security-Policy");
    expect(webviewPanels[0]?.html).toContain("canonical runtime");
    expect(webviewPanels[0]?.messages.at(-1)).toMatchObject({
      type: "agorix-frame",
      view: { selectedFrameIndex: 1 },
    });

    const inspectorRows = treeProviders.get("agorixStudio.inspector")?.getChildren() ?? [];
    expect(inspectorRows.length).toBeGreaterThan(0);
    expect(JSON.stringify(inspectorRows[0])).toContain("runtime fact");

    const selected = await handlers.get("agorixStudio.selectExecutionStep")!(1);
    expect(selected).toMatchObject({ selectedFrameIndex: 1 });
    expect(revealed.length).toBeGreaterThan(0);
  });

  it("records contextual Companion responses with deterministic routing diagnostics", async () => {
    await openFile("/p/a.json", repeated);
    await handlers.get("agorixStudio.run")!();

    const turn = await handlers.get("agorixStudio.companionDebug")!();

    expect(turn).toMatchObject({
      action: "debug",
      diagnostics: { providerSelection: "bypassed" },
      response: { capability: "debugger" },
    });
    const rows = treeProviders.get("agorixStudio.companionHistory")?.getChildren() ?? [];
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows[0])).toContain("bypassed");
    expect(JSON.stringify(rows[0])).toContain("runtime facts");
  });

  it("runs and stops through coherent execution controls", async () => {
    await openFile("/p/a.json", repeated);

    const run = await handlers.get("agorixStudio.run")!();
    expect(run).toMatchObject({ status: "completed", outcome: "completed" });

    await handlers.get("agorixStudio.reset")!();
    await handlers.get("agorixStudio.step")!();
    const stop = await handlers.get("agorixStudio.stop")!();
    expect(stop).toMatchObject({ status: "stopped", outcome: "stopped" });
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

  it("opens and exports portable .agorix files without leaking account state", async () => {
    const portable = serializeAgorixProject(parseStored(stored([{ type: "move", steps: 8 }])), {
      exportedAt: "2026-01-02T00:00:00.000Z",
    });
    await openFile("/p/a.agorix", portable);
    savePicked = { fsPath: "/p/exported.agorix" };

    await handlers.get("agorixStudio.exportAgorix")!();

    const exported = JSON.parse(new TextDecoder().decode(files.get("/p/exported.agorix")));
    expect(exported.format).toBe("agorix-project");
    expect(exported.project.program.scripts[0].statements).toEqual([{ type: "move", steps: 8 }]);
    expect(JSON.stringify(exported)).not.toMatch(/token|revision|history|account/i);
  });

  it("validates the project and exposes native developer workflow entry points", async () => {
    await openFile("/p/a.json", repeated);

    const report = await handlers.get("agorixStudio.validateProject")!();
    const context = await handlers.get("agorixStudio.showDeveloperContext")!();
    await handlers.get("agorixStudio.runChecks")!();
    await handlers.get("agorixStudio.openScm")!();

    expect(JSON.parse(String(report))).toMatchObject({
      schema: "agorix/studio-validation-report/v1",
      outcome: "completed",
    });
    expect(JSON.parse(String(context))).toMatchObject({
      schema: "agorix/studio-developer-context/v1",
      authority: "canonical-project",
      scmCommand: "vscode.scm",
    });
    expect(executedTasks[0]).toMatchObject({ name: "agorix: verify", source: "agorix" });
    expect(commandCalls.some((call) => call[0] === "workbench.view.scm")).toBe(true);
  });

  it("stores account tokens in SecretStorage and handles revision conflicts explicitly", async () => {
    inputBox = "secret-token";
    await handlers.get("agorixStudio.signIn")!();
    expect(secrets.get("agorixStudio.accountToken")).toBe("secret-token");

    serverUrl = "https://studio.example";
    const remoteProject = JSON.parse(stored([{ type: "move", steps: 5 }]));
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ Authorization: "Bearer secret-token" });
      if (url.endsWith("/projects") && init?.method === undefined) {
        return new Response(JSON.stringify([{ id: "p1", title: "First", revision: "r1" }]));
      }
      if (url.endsWith("/projects/p1") && init?.method === undefined) {
        return new Response(
          JSON.stringify({ id: "p1", title: "First", revision: "r1", project: remoteProject }),
        );
      }
      return new Response(
        JSON.stringify({
          status: "conflict",
          expectedRevision: "r1",
          actualRevision: "r2",
          latest: remoteProject,
        }),
        { status: 409 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    quickPick = { project: { id: "p1", title: "First", revision: "r1" } };
    choice = "Cancel";

    await handlers.get("agorixStudio.openRemoteProject")!();
    const result = await handlers.get("agorixStudio.saveRemoteProject")!();

    expect(result).toMatchObject({ status: "conflict", actualRevision: "r2" });
    expect(shown.some((message) => message.includes("Server has revision r2"))).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await handlers.get("agorixStudio.signOut")!();
    expect(secrets.has("agorixStudio.accountToken")).toBe(false);
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

    await handlers.get("agorixStudio.undoProposal")!();
    const undone = JSON.parse(new TextDecoder().decode(files.get("/p/a.json")));
    expect(undone.program.scripts[0].statements).toHaveLength(6);

    await handlers.get("agorixStudio.redoProposal")!();
    const redone = JSON.parse(new TextDecoder().decode(files.get("/p/a.json")));
    expect(redone.program.scripts[0].statements).toEqual(written.program.scripts[0].statements);
  });

  it("writes Workbench edits through the proposal undo stack and clears redo", async () => {
    await openFile("/p/workbench-edit.json", stored([]));
    const original = new TextDecoder().decode(files.get("/p/workbench-edit.json"));
    await handlers.get("agorixStudio.openWorkbench")!();

    webviewPanels[0]?.receive({
      schema: "agorix/studio-protocol/v1",
      type: "intent",
      intent: {
        type: "insertBlock",
        blockType: "motion_move",
        to: { container: { kind: "script", scriptIndex: 0 }, index: 0 },
      },
    });
    await flushWorkbench();

    const edited = JSON.parse(new TextDecoder().decode(files.get("/p/workbench-edit.json")));
    expect(edited.program.scripts[0].statements).toEqual([{ type: "move", steps: 10 }]);

    await handlers.get("agorixStudio.undoProposal")!();
    expect(JSON.parse(new TextDecoder().decode(files.get("/p/workbench-edit.json")))).toEqual(
      JSON.parse(original),
    );

    await handlers.get("agorixStudio.redoProposal")!();
    expect(JSON.parse(new TextDecoder().decode(files.get("/p/workbench-edit.json")))).toMatchObject(
      {
        program: { scripts: [{ statements: [{ type: "move", steps: 10 }] }] },
      },
    );

    webviewPanels[0]?.receive({
      schema: "agorix/studio-protocol/v1",
      type: "intent",
      intent: {
        type: "insertBlock",
        blockType: "motion_turn",
        to: { container: { kind: "script", scriptIndex: 0 }, index: 1 },
      },
    });
    await flushWorkbench();
    await handlers.get("agorixStudio.redoProposal")!();
    const afterNewEdit = JSON.parse(new TextDecoder().decode(files.get("/p/workbench-edit.json")));
    expect(afterNewEdit.program.scripts[0].statements).toEqual([
      { type: "move", steps: 10 },
      { type: "turn", degrees: 90 },
    ]);
  });

  it("drives the agent loop on the Workbench with learner decisions only", async () => {
    await openFile("/p/agent.json", stored([]));
    const original = new TextDecoder().decode(files.get("/p/agent.json"));
    await handlers.get("agorixStudio.openWorkbench")!();
    const schema = "agorix/studio-protocol/v1";
    const types = () => webviewPanels[0]?.messages.map((m) => (m as { type: string }).type) ?? [];
    webviewPanels[0]?.receive({ schema, type: "ready" });
    await flushWorkbench();
    expect(types()).toEqual(expect.arrayContaining(["workspace", "agreements", "workflow"]));

    webviewPanels[0]?.receive({ schema, type: "stateIntent", text: "make it move" });
    await flushWorkbench();
    expect(webviewPanels[0]?.messages.at(-1)).toMatchObject({ type: "plan" });
    webviewPanels[0]?.receive({ schema, type: "stateIntent", text: "x".repeat(200) });
    await flushWorkbench();
    expect(new TextDecoder().decode(files.get("/p/agent.json"))).toBe(original);

    webviewPanels[0]?.receive({ schema, type: "acceptPlan" });
    webviewPanels[0]?.receive({ schema, type: "requestProposal" });
    await flushWorkbench();
    const proposal = webviewPanels[0]?.messages.find(
      (m) => (m as { type: string }).type === "proposal",
    );
    expect(proposal).toBeDefined();
    expect(new TextDecoder().decode(files.get("/p/agent.json"))).toBe(original);

    webviewPanels[0]?.receive({
      schema,
      type: "decideProposal",
      proposalId: (proposal as { proposalId: string }).proposalId,
      decision: "rejected",
    });
    await flushWorkbench();
    expect(new TextDecoder().decode(files.get("/p/agent.json"))).toBe(original);

    webviewPanels[0]?.receive({ schema, type: "requestProposal" });
    await flushWorkbench();
    webviewPanels[0]?.receive({
      schema,
      type: "decideProposal",
      proposalId: (proposal as { proposalId: string }).proposalId,
      decision: "accepted",
    });
    await flushWorkbench();
    const applied = JSON.parse(new TextDecoder().decode(files.get("/p/agent.json")));
    expect(applied.program.scripts[0].statements.length).toBeGreaterThan(0);
    expect(types()).toContain("prediction");

    await handlers.get("agorixStudio.undoProposal")!();
    expect(JSON.parse(new TextDecoder().decode(files.get("/p/agent.json")))).toEqual(
      JSON.parse(original),
    );
  });

  it("reviews first-step proposal through the generic apply flow", async () => {
    await openFile("/p/empty.json", stored([]));
    choice = "Apply";
    await handlers.get("agorixStudio.suggestFirstStep")!();
    const written = JSON.parse(new TextDecoder().decode(files.get("/p/empty.json")));
    expect(written.program.scripts[0].statements).toEqual([{ type: "move", steps: 10 }]);
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
    expect(() =>
      extension.activate({ subscriptions: [], asAbsolutePath: (p: string) => p } as never),
    ).toThrow("registration refused");
    expect(shown.some((m) => m.includes("activation failed"))).toBe(true);
  });
});
