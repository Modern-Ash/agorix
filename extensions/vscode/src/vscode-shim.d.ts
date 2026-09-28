declare module "vscode" {
  export interface Disposable {
    dispose(): void;
  }

  export interface ExtensionContext {
    readonly subscriptions: Disposable[];
  }

  export namespace commands {
    function registerCommand(
      command: string,
      callback: (...args: unknown[]) => unknown,
    ): Disposable;
  }

  export namespace window {
    function showInformationMessage(message: string): Thenable<string | undefined>;
  }
}
