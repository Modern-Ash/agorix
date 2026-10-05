// Installs the packaged VSIX into a clean profile of a real VS Code, then runs the same
// integration suite against the INSTALLED extension (not the development folder).
// Usage: pnpm package && pnpm test:vsix   (env VSCODE_VERSION, default "stable")
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
const cp = require("node:child_process"); // agora-allowlist: dev-only harness spawns the VS Code CLI with fixed args, not shipped in the VSIX
const {
  downloadAndUnzipVSCode,
  resolveCliArgsFromVSCodeExecutablePath,
  runTests,
} = require("@vscode/test-electron");

async function main() {
  delete process.env.ELECTRON_RUN_AS_NODE;
  const vsix = path.resolve(__dirname, "../../dist/agorix-studio.vsix");
  if (!fs.existsSync(vsix)) throw new Error(`Missing ${vsix}; run "pnpm package" first.`);
  const executable = await downloadAndUnzipVSCode(process.env.VSCODE_VERSION || "stable");
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "agorix-studio-vsix-"));
  const profile = [
    "--user-data-dir",
    path.join(scratch, "user-data"),
    "--extensions-dir",
    path.join(scratch, "extensions"),
  ];
  try {
    const [cli, ...cliArgs] = resolveCliArgsFromVSCodeExecutablePath(executable);
    const baseCliArgs = cliArgs.filter(
      (arg) => !arg.startsWith("--user-data-dir") && !arg.startsWith("--extensions-dir"),
    );
    const run = (args) =>
      cp.spawnSync(cli, [...baseCliArgs, ...profile, ...args], {
        encoding: "utf8",
        shell: false,
      });
    const install = run(["--install-extension", vsix]);
    process.stdout.write(install.stdout + install.stderr);
    if (install.status !== 0) throw new Error("VSIX install failed");
    const listed = run(["--list-extensions", "--show-versions"]).stdout;
    console.log(`Installed extensions: ${listed.trim()}`);
    const extensionDir = path.join(scratch, "extensions", "modern-ash.agorix-studio-0.1.0");
    const installedManifest = path.join(extensionDir, "package.json");
    if (!/modern-ash\.agorix-studio@/.test(listed) && !fs.existsSync(installedManifest)) {
      throw new Error("VSIX not listed after install");
    }
    await runTests({
      vscodeExecutablePath: executable,
      extensionDevelopmentPath: path.resolve(__dirname, "stub"),
      extensionTestsPath: path.resolve(__dirname, "index.cjs"),
      launchArgs: [path.resolve(__dirname, "fixtures"), "--disable-workspace-trust", ...profile],
    });
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error("VSIX install/smoke failed:", error);
  process.exit(1);
});
