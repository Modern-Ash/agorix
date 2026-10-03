/**
 * Boundary check (issue #205): shared packages must stay VS Code-independent.
 * Only extensions/vscode may import the `vscode` module. This covers every
 * packages/* workspace (not only the lint-listed domain packages) and their manifests.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = new URL("..", import.meta.url).pathname;
const packagesDir = join(root, "packages");

function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(name)) out.push(full);
  }
  return out;
}

const VSCODE_IMPORT = /(?:from\s+|import\s*\(\s*|require\s*\(\s*|import\s+)["']vscode["']/;

describe("shared packages are VS Code-independent", () => {
  const packages = readdirSync(packagesDir).filter((name) =>
    statSync(join(packagesDir, name)).isDirectory(),
  );

  it("finds the shared packages", () => {
    expect(packages.length).toBeGreaterThan(5);
  });

  for (const name of packages) {
    it(`packages/${name} has no vscode import or dependency`, () => {
      const offenders = sourceFiles(join(packagesDir, name)).filter((file) =>
        VSCODE_IMPORT.test(readFileSync(file, "utf8")),
      );
      expect(offenders).toEqual([]);
      const manifest = JSON.parse(readFileSync(join(packagesDir, name, "package.json"), "utf8"));
      const deps = Object.keys({
        ...manifest.dependencies,
        ...manifest.devDependencies,
        ...manifest.peerDependencies,
      });
      expect(deps.filter((dep) => dep === "vscode" || dep === "@types/vscode")).toEqual([]);
    });
  }

  it("the boundary regex detects an import (self-test)", () => {
    expect(VSCODE_IMPORT.test('import * as v from "vscode";')).toBe(true);
    expect(VSCODE_IMPORT.test("const v = require('vscode')")).toBe(true);
    expect(VSCODE_IMPORT.test('import "./vscode-like"')).toBe(false);
  });
});
