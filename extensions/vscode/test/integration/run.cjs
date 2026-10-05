// Launches a real VS Code (Extension Development Host) and runs ./index.cjs inside it.
// Env: VSCODE_VERSION (default "stable"), VSCODE_EXECUTABLE (use an installed VS Code
// instead of downloading), VSIX_PATH is handled by index.cjs (installed-extension mode).
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
const { runTests } = require("@vscode/test-electron");

async function main() {
  // A parent Electron/VS Code process may leak this; it would make the host run as plain Node.
  delete process.env.ELECTRON_RUN_AS_NODE;
  const extensionDevelopmentPath = path.resolve(__dirname, "../..");
  const extensionTestsPath = path.resolve(__dirname, "index.cjs");
  const workspace = path.resolve(__dirname, "fixtures");
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "agorix-studio-it-"));
  const vscodeExecutablePath = process.env.VSCODE_EXECUTABLE;
  try {
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      ...(vscodeExecutablePath
        ? { vscodeExecutablePath }
        : { version: process.env.VSCODE_VERSION || "stable" }),
      launchArgs: [
        workspace,
        "--disable-extensions",
        "--disable-workspace-trust",
        ...(process.env.VSCODE_LOCALE ? ["--locale", process.env.VSCODE_LOCALE] : []),
        "--user-data-dir",
        path.join(scratch, "user-data"),
        "--extensions-dir",
        path.join(scratch, "extensions"),
      ],
    });
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error("Agorix Studio integration tests failed:", error);
  process.exit(1);
});
