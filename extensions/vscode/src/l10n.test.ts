import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const json = (file: string) =>
  JSON.parse(readFileSync(join(root, file), "utf8")) as Record<string, string>;
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as unknown;
const nlsEn = json("package.nls.json");
const nlsEs = json("package.nls.es.json");
const bundleEs = json("l10n/bundle.l10n.es.json");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith(".ts") && !path.endsWith(".test.ts") ? [path] : [];
  });
}

/** Literal first argument of every t("...") and msg("...") call. */
function wrappedMessages(): Set<string> {
  const pattern = /\b(?:t|msg)\(\s*"((?:[^"\\]|\\.)*)"/g;
  const found = new Set<string>();
  for (const file of sourceFiles(join(root, "src"))) {
    if (file.endsWith("l10n.ts") || file.endsWith("messages.ts")) continue;
    for (const match of readFileSync(file, "utf8").matchAll(pattern)) {
      found.add(JSON.parse(`"${match[1]}"`) as string);
    }
  }
  return found;
}

const placeholders = (text: string) => [...text.matchAll(/\{(\d+)\}/g)].map((m) => m[1]).sort();

function manifestKeys(node: unknown, out = new Set<string>()): Set<string> {
  if (typeof node === "string") {
    for (const match of node.matchAll(/^%([^%]+)%$/g)) out.add(match[1] as string);
  } else if (Array.isArray(node)) {
    node.forEach((item) => manifestKeys(item, out));
  } else if (typeof node === "object" && node !== null) {
    Object.values(node).forEach((item) => manifestKeys(item, out));
  }
  return out;
}

describe("manifest localization", () => {
  it("resolves every %key% in package.json from both language bundles", () => {
    const used = manifestKeys(manifest);
    expect(used.size).toBeGreaterThan(40);
    for (const key of used) {
      expect(nlsEn[key], `package.nls.json is missing ${key}`).toBeTruthy();
      expect(nlsEs[key], `package.nls.es.json is missing ${key}`).toBeTruthy();
    }
    expect(Object.keys(nlsEs).sort()).toEqual(Object.keys(nlsEn).sort());
    expect([...used].sort()).toEqual(Object.keys(nlsEn).sort());
  });

  it("keeps links and placeholders intact in the Spanish welcome text", () => {
    const links = (text: string) => [...text.matchAll(/\(command:[A-Za-z.]+\)/g)].map((m) => m[0]);
    expect(links(nlsEs["welcome.projects"] as string)).toEqual(
      links(nlsEn["welcome.projects"] as string),
    );
  });

  it("really translates visible titles instead of copying English", () => {
    const changed = Object.keys(nlsEn).filter((key) => nlsEn[key] !== nlsEs[key]);
    expect(changed.length).toBeGreaterThan(55);
  });
});

describe("packaging", () => {
  it("points VS Code at the bundles and ships them in the VSIX", () => {
    expect((manifest as { l10n?: string }).l10n).toBe("./l10n");
    const ignore = readFileSync(join(root, ".vscodeignore"), "utf8").split("\n");
    for (const entry of ["!package.nls.json", "!package.nls.es.json", "!l10n/*.json"]) {
      expect(ignore, entry).toContain(entry);
    }
  });
});

describe("runtime message bundle", () => {
  it("has a Spanish entry for every wrapped message and no stale entries", () => {
    const wrapped = wrappedMessages();
    expect(wrapped.size).toBeGreaterThan(100);
    expect([...wrapped].filter((message) => bundleEs[message] === undefined)).toEqual([]);
    expect(Object.keys(bundleEs).filter((key) => !wrapped.has(key))).toEqual([]);
  });

  it("keeps the same placeholders in every translation", () => {
    for (const [english, spanish] of Object.entries(bundleEs)) {
      expect(placeholders(spanish), english).toEqual(placeholders(english));
    }
  });
});

describe("t()", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("vscode");
  });

  it("delegates to vscode.l10n.t when it is available", async () => {
    vi.doMock("vscode", () => ({
      l10n: { t: (message: string, ...args: unknown[]) => `L10N:${message}:${args.join(",")}` },
    }));
    const { t } = await import("./l10n.js");
    expect(t("Saved {0} at revision {1}.", "a", 2)).toBe("L10N:Saved {0} at revision {1}.:a,2");
  });

  it("falls back to formatted English without vscode.l10n", async () => {
    vi.doMock("vscode", () => ({}));
    const { t } = await import("./l10n.js");
    expect(t("Saved {0} at revision {1}.", "demo", 3)).toBe("Saved demo at revision 3.");
    expect(t("Open an Agorix project first.")).toBe("Open an Agorix project first.");
  });
});
