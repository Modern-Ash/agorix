declare module "vscode" {
  export interface Disposable {
    dispose(): void;
  }

  export interface ExtensionContext {
    readonly subscriptions: Disposable[];
  }

  export interface Uri {
    readonly fsPath: string;
    toString(): string;
  }

  export interface TextDocument {
    readonly uri: Uri;
  }

  export interface OutputChannel extends Disposable {
    clear(): void;
    appendLine(line: string): void;
    show(preserveFocus?: boolean): void;
  }

  export namespace commands {
    function registerCommand(
      command: string,
      callback: (...args: unknown[]) => unknown,
    ): Disposable;
    function executeCommand(command: string, ...args: unknown[]): Thenable<unknown>;
  }

  export namespace window {
    function showInformationMessage(
      message: string,
      ...items: string[]
    ): Thenable<string | undefined>;
    function showWarningMessage(message: string): Thenable<string | undefined>;
    function showErrorMessage(message: string): Thenable<string | undefined>;
    function showOpenDialog(options: {
      canSelectMany?: boolean;
      filters?: Record<string, string[]>;
      openLabel?: string;
    }): Thenable<Uri[] | undefined>;
    function showTextDocument(document: TextDocument): Thenable<unknown>;
    function createOutputChannel(name: string): OutputChannel;
  }

  export namespace workspace {
    function openTextDocument(options: {
      content: string;
      language?: string;
    }): Thenable<TextDocument>;
    const fs: {
      readFile(uri: Uri): Thenable<Uint8Array>;
      writeFile(uri: Uri, content: Uint8Array): Thenable<void>;
    };
  }
}
