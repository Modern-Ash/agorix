// agora-allowlist-file: self-test for the deny-list scanner; it must contain the
// secret and execution-sink literals it asserts on, all obviously fake.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  BASELINE_DOC,
  formatFindings,
  PROVIDER_SECRET_IDENTIFIERS,
  runSecurityBaseline,
  SAFETY_DOC_DIR,
} from "./security-baseline.mjs";

let root;

function write(relativePath, content) {
  const absolute = join(root, relativePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf8");
}

function rulesIn(relativePath = ".") {
  const result = runSecurityBaseline(join(root, relativePath));
  return {
    result,
    findings: result.findings,
    rules: new Set(result.findings.map((item) => item.rule)),
    inRule: (rule) => result.findings.some((item) => item.rule === rule),
  };
}

/** A baseline document that satisfies every documentation rule, for clean-tree runs. */
function writeValidBaselineDoc() {
  write(
    BASELINE_DOC,
    "# Baseline\n\n#100 #103\n\n## Deviations\n\n| Control | Reason | ADR/Issue |\n| --- | --- | --- |\n| none | n/a | n/a |\n",
  );
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "agorix-security-baseline-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("security baseline checker", () => {
  it("passes on an empty tree", () => {
    writeValidBaselineDoc();
    const { result, rules } = rulesIn();
    expect(rules.size).toBe(0);
    expect(result.ok).toBe(true);
    expect(formatFindings(result)).toContain("PASS");
  });

  it("names the baseline document it depends on", () => {
    expect(BASELINE_DOC).toBe(`${SAFETY_DOC_DIR}/WEB_SECURITY_BASELINE.md`);
  });

  describe("secret fixtures", () => {
    it.each([
      ["openai", 'const key = "sk-abcdefghijklmnopqrstuvwxyz0123";'],
      ["anthropic", 'const key = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz";'],
      ["google", 'const key = "AIzaSyA1234567890abcdefghijklmnopqrstuv";'],
      ["aws", 'const id = "AKIAIOSFODNN7EXAMPLE";'],
      ["github", 'const token = "ghp_abcdefghijklmnopqrstuvwxyz0123456789";'],
      ["slack", 'const token = "xoxb-1234567890-abcdefghijkl";'],
      ["private-key", "-----BEGIN RSA PRIVATE KEY-----"],
      ["jwt", 'const t = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVP";'],
    ])("catches an accidental %s secret", (_label, line) => {
      write("src/thing.ts", `export const value = 1;\n${line}\n`);
      expect(rulesIn().inRule("secret-scan")).toBe(true);
    });

    it("catches a generic secret assignment", () => {
      write("src/config.ts", 'export const clientSecret = "hunter2hunter2hunter2";\n');
      const { findings } = rulesIn();
      expect(findings.some((item) => item.rule === "secret-scan")).toBe(true);
    });

    it("reports the file and line of the leak", () => {
      write("src/thing.ts", "const a = 1;\nconst key = 'sk-abcdefghijklmnopqrstuvwxyz0123';\n");
      const finding = rulesIn().result.findings.find((item) => item.rule === "secret-scan");
      expect(finding?.file).toBe("src/thing.ts");
      expect(finding?.line).toBe(2);
    });

    it("allows an attributed, reasoned suppression", () => {
      write(
        "src/fixtures.ts",
        'const fake = "sk-abcdefghijklmnopqrstuvwxyz0123"; // agora-allowlist: non-secret fixture for scanner self-test\n',
      );
      expect(rulesIn().inRule("secret-scan")).toBe(false);
    });

    it("rejects a suppression with no usable reason", () => {
      write(
        "src/fixtures.ts",
        'const fake = "sk-abcdefghijklmnopqrstuvwxyz0123"; // agora-allowlist: x\n',
      );
      expect(rulesIn().inRule("secret-scan")).toBe(true);
    });

    it("does not flag ordinary identifiers or env var names", () => {
      write(
        "src/config.ts",
        [
          "export const AGORIX_TUTOR_API_KEY = process.env.AGORIX_TUTOR_API_KEY;",
          "export function readPassword(): string { return ''; }",
          "const authorization = { headers: { Authorization: 'Bearer' } };",
        ].join("\n"),
      );
      expect(rulesIn().inRule("secret-scan")).toBe(false);
    });
  });

  describe("client bundles", () => {
    it.each(PROVIDER_SECRET_IDENTIFIERS)("catches %s in client code", (identifier) => {
      write("apps/web/src/app.ts", `const token = import.meta.env.${identifier};\n`);
      const { result } = rulesIn();
      expect(result.findings.some((item) => item.rule === "no-client-secrets")).toBe(true);
    });

    it("catches a provider secret in the vite config", () => {
      write(
        "apps/web/vite.config.ts",
        "define: { __TOKEN__: process.env.AGORIX_TUTOR_AUTH_TOKEN }\n",
      );
      expect(rulesIn().inRule("no-client-secrets")).toBe(true);
    });

    it("catches an environment read in shipped client code", () => {
      write("apps/web/src/app.ts", "const mode = import.meta.env.MODE;\n");
      expect(rulesIn().inRule("no-client-secrets")).toBe(true);
    });

    it("does not flag build and e2e tooling", () => {
      write("apps/web/playwright.config.ts", "const reuse = !process.env.CI;\n");
      expect(rulesIn().inRule("no-client-secrets")).toBe(false);
    });

    it("scans a built bundle for provider keys", () => {
      write(
        "apps/web/dist/assets/index.js",
        'const t="sk-ant-api03-abcdefghijklmnopqrstuvwxyz";\n',
      );
      const { result, findings } = rulesIn();
      expect(findings.some((item) => item.rule === "no-client-secrets")).toBe(true);
      expect(result.notes.join(" ")).toContain("built client bundle");
    });

    it("reports a clean built bundle", () => {
      write("apps/web/dist/assets/index.js", "export const app = 1;\n");
      const { result } = rulesIn();
      expect(result.notes.join(" ")).toMatch(/scanned 1 built client bundle file/);
      expect(result.findings.filter((item) => item.rule === "no-client-secrets")).toEqual([]);
    });

    it("says so when no build output exists", () => {
      const { result } = rulesIn();
      expect(result.notes.join(" ")).toContain("client bundle scan skipped");
    });
  });

  describe("generated-code execution", () => {
    it.each([
      ["eval", "eval('1+1')"],
      ["Function constructor", "new Function('return 1')()"],
      ["string timer", "setTimeout('doThing()', 10)"],
      ["document.write", "document.write('<p>hi</p>')"],
      ["raw html", "node.innerHTML = payload"],
      ["react raw html", "return <div dangerouslySetInnerHTML={{ __html: body }} />;"],
      ["node vm", 'import vm from "node:vm";'],
      ["child process", 'import { exec } from "node:child_process";'],
      ["importScripts", 'importScripts("payload.js");'],
    ])("catches %s", (_label, line) => {
      write("packages/runtime/src/bad.ts", `${line}\n`);
      expect(rulesIn().inRule("no-eval")).toBe(true);
    });

    it("does not flag regex .exec or evaluateExpression", () => {
      write(
        "packages/runtime/src/ok.ts",
        [
          "const m = /^scripts\\[(\\d+)\\]/.exec(nodeId);",
          "function evaluateExpression() {}",
          "evaluatePredicate();",
        ].join("\n"),
      );
      expect(rulesIn().inRule("no-eval")).toBe(false);
    });

    it("does not flag the checker or the lint config that hold the deny-list", () => {
      write(
        "scripts/security-baseline.mjs",
        'const re = /\\beval\\s*\\(/;\nconst call = "new Function(";\n',
      );
      write("eslint.config.js", "const selectors = [\"CallExpression[callee.name='eval']\"];\n");
      expect(rulesIn().inRule("no-eval")).toBe(false);
    });
  });

  describe("external links", () => {
    it.each([
      ["anchor", 'const el = <a href="https://example.com">x</a>;'],
      ["href", "const props = { href: url };"],
      ["window.open", "window.open(url);"],
      ["location navigation", "location.href = url;"],
      ["import.meta.url", "const base = import.meta.env.BASE_URL;"],
    ])("catches an ungoverned %s", (_label, line) => {
      write("apps/web/src/widget.tsx", `${line}\n`);
      expect(rulesIn().inRule("external-links")).toBe(true);
    });

    it("points the finding at the link policy module", () => {
      write("apps/web/src/widget.tsx", "const a = <a href={x}>y</a>;\n");
      const finding = rulesIn().result.findings.find((item) => item.rule === "external-links");
      expect(finding?.message).toContain("linkPolicy");
    });

    it("allows the link policy module itself", () => {
      write("apps/web/src/linkPolicy.ts", 'const rel = "noopener noreferrer";\n');
      expect(rulesIn().inRule("external-links")).toBe(false);
    });

    it("does not flag markdown documentation", () => {
      write("docs/safety/CHILD_SAFETY_PRIVACY.md", "See [baseline](WEB_SECURITY_BASELINE.md).\n");
      expect(rulesIn().inRule("external-links")).toBe(false);
    });
  });

  describe("POC account and PII domain fields", () => {
    it.each([
      ["packages/persistence/src/store.ts", "  email: string;"],
      ["packages/platform-contract/src/index.ts", "  readonly school: string;"],
      ["packages/persistence/src/store.ts", "  latitude: number;"],
      ["packages/persistence/src/store.ts", "  dateOfBirth: string;"],
    ])("catches an account/PII field in %s", (file, line) => {
      write(file, `export interface X {\n${line}\n}\n`);
      expect(rulesIn().inRule("no-pii-domain-fields")).toBe(true);
    });

    it("allows the POC metadata field set", () => {
      write(
        "packages/persistence/src/store.ts",
        "export interface ProjectMetadata {\n  createdAt: string;\n  updatedAt: string;\n  missionProgress: string;\n  hintLevel: number;\n  locale?: string;\n}\n",
      );
      expect(rulesIn().inRule("no-pii-domain-fields")).toBe(false);
    });

    it("does not flag block positions or trace profiles", () => {
      write(
        "packages/block-editor/src/changes.ts",
        "export interface Position {\n  location: { container: string; index: number };\n}\nexport type Profile = 'beginner' | 'studio';\n",
      );
      expect(rulesIn().inRule("no-pii-domain-fields")).toBe(false);
    });
  });

  describe("learner free-text logging (issue #103)", () => {
    it.each([
      ["apps/tutor-api/src/index.ts", 'console.log("request", learnerIntent);'],
      ["apps/web/src/App.tsx", "console.warn(learnerQuestion);"],
      ["packages/tutor-contract/src/learning-companion.ts", "logger.info({ learnerIntent });"],
    ])("catches a logging call referencing raw learner free text in %s", (file, line) => {
      write(file, `${line}\n`);
      expect(rulesIn().inRule("no-learner-free-text-logging")).toBe(true);
    });

    it("does not flag the field being read, stripped, or typed without logging it", () => {
      write(
        "apps/tutor-api/src/index.ts",
        [
          "function toCompanionRequest(request) {",
          "  if (config.includeLearnerQuestion === true || companion.learnerIntent === undefined) {",
          "    return companion;",
          "  }",
          "  delete projected.learnerIntent;",
          "  return projected;",
          "}",
        ].join("\n"),
      );
      expect(rulesIn().inRule("no-learner-free-text-logging")).toBe(false);
    });

    it("does not flag console calls unrelated to learner free text", () => {
      write("apps/web/src/App.tsx", 'console.error("network failure");\n');
      expect(rulesIn().inRule("no-learner-free-text-logging")).toBe(false);
    });
  });

  describe("prohibited POC features", () => {
    it.each([
      ["geolocation", "navigator.geolocation.getCurrentPosition(onLoc);"],
      ["watched position", "const id = watchPosition(success);"],
      ["user media", "const s = await getUserMedia({ video: true });"],
      ["media recorder", "const r = new MediaRecorder(stream);"],
      ["outbound socket", 'const ws = new WebSocket("wss://x.test");'],
      ["beacon", "navigator.sendBeacon(url, body);"],
      ["direct messaging", "sendDirectMessage(peerId, text);"],
      ["chat room", "chatRoom('lobby');"],
      ["social graph", "followUser(otherId);"],
      ["public publishing", "publishProject(projectId);"],
    ])("catches %s", (_label, line) => {
      write("apps/web/src/feature.ts", `${line}\n`);
      expect(rulesIn().inRule("no-prohibited-features")).toBe(true);
    });

    it("does not flag the OpenAI-compatible provider transport path", () => {
      write(
        "apps/tutor-api/src/index.ts",
        [
          'const CHAT_COMPLETIONS_SUFFIX = "/chat/completions";',
          'fetch(url, { method: "POST" });',
        ].join("\n"),
      );
      expect(rulesIn().inRule("no-prohibited-features")).toBe(false);
    });

    it("does not flag the two literal words used in docs and tests", () => {
      write("docs/safety/CHILD_SAFETY_PRIVACY.md", "See [baseline](WEB_SECURITY_BASELINE.md).\n");
      write("apps/web/src/app.ts", "// direct message surface is prohibited\n");
      expect(rulesIn().inRule("no-prohibited-features")).toBe(false);
    });

    it("allows an attributed, reasoned suppression", () => {
      write(
        "apps/web/src/feature.ts",
        "sendDirectMessage(peerId, text); // agora-allowlist: negative fixture proving the ban fires\n",
      );
      expect(rulesIn().inRule("no-prohibited-features")).toBe(false);
    });
  });

  describe("safety documentation", () => {
    it("fails when the baseline document is missing", () => {
      const { inRule } = rulesIn();
      expect(inRule("cross-links")).toBe(true);
    });

    it("requires the baseline document to link #100 and #103", () => {
      write(BASELINE_DOC, "# Baseline\n\nsee #100 only\n");
      const { findings } = rulesIn();
      const messages = findings
        .filter((item) => item.rule === "cross-links")
        .map((item) => item.message);
      expect(messages.join(" ")).toContain("#103");
    });

    it("passes when the baseline document links both successors", () => {
      write(
        BASELINE_DOC,
        "# Baseline\n\nBuilt on #100 and #103.\n\n## Deviations\n\n| Control | Reason | ADR/Issue |\n| --- | --- | --- |\n| none | n/a | n/a |\n",
      );
      const { findings } = rulesIn();
      expect(findings.filter((item) => item.rule === "cross-links")).toEqual([]);
      expect(findings.filter((item) => item.rule === "adr-deviations")).toEqual([]);
    });

    it("requires a deviations registry", () => {
      write(BASELINE_DOC, "# Baseline\n\n#100 #103\n");
      expect(rulesIn().inRule("adr-deviations")).toBe(true);
    });

    it("rejects a deviation row with no ADR or issue reference", () => {
      write(
        BASELINE_DOC,
        "# Baseline\n\n#100 #103\n\n## Deviations\n\n| Control | Reason | ADR/Issue |\n| --- | --- | --- |\n| inline styles | needed for block editor | later |\n",
      );
      const finding = rulesIn().result.findings.find((item) => item.rule === "adr-deviations");
      expect(finding?.message).toContain("explicit ADR or issue");
    });

    it("accepts a deviation row that cites an issue", () => {
      write(
        BASELINE_DOC,
        "# Baseline\n\n#100 #103\n\n## Deviations\n\n| Control | Reason | ADR/Issue |\n| --- | --- | --- |\n| inline styles | needed for block editor | #142 |\n",
      );
      expect(rulesIn().inRule("adr-deviations")).toBe(false);
    });

    it("accepts a deviation row that cites an ADR", () => {
      write(
        BASELINE_DOC,
        "# Baseline\n\n#100 #103\n\n## Deviations\n\n| Control | Reason | ADR/Issue |\n| --- | --- | --- |\n| inline styles | needed for block editor | ADR-0007 |\n",
      );
      expect(rulesIn().inRule("adr-deviations")).toBe(false);
    });

    it("requires sibling safety documents to link each other", () => {
      writeValidBaselineDoc();
      write("docs/safety/AI_OUTPUT_VALIDATION.md", "# AI\n");
      const finding = rulesIn().result.findings.find(
        (item) => item.file === "docs/safety/AI_OUTPUT_VALIDATION.md",
      );
      expect(finding?.message).toContain("sibling document");
    });
  });

  describe("reporting", () => {
    it("sorts findings by rule then file then line", () => {
      write("packages/runtime/src/b.ts", "eval('x')\n");
      write("apps/web/src/a.ts", 'const key = "sk-abcdefghijklmnopqrstuvwxyz0123";\n');
      const { result } = rulesIn();
      const keys = result.findings.map((item) => `${item.rule}|${item.file}|${item.line}`);
      expect([...keys].sort()).toEqual(keys);
    });

    it("lists every finding in the formatted output", () => {
      write("apps/web/src/a.ts", 'const key = "sk-abcdefghijklmnopqrstuvwxyz0123";\n');
      write("packages/runtime/src/b.ts", "eval('x')\n");
      const { result } = rulesIn();
      const output = formatFindings(result);
      expect(output).toContain("FAIL");
      for (const item of result.findings) {
        expect(output).toContain(`[${item.rule}] ${item.file}:${item.line}`);
      }
    });

    it("ignores dependency and build output directories", () => {
      writeValidBaselineDoc();
      write(
        "node_modules/pkg/index.js",
        "eval('x')\nconst k='sk-abcdefghijklmnopqrstuvwxyz0123';\n",
      );
      write("apps/web/dist/assets/index.js", "eval('x')\n");
      const { result } = rulesIn();
      expect(result.findings).toEqual([]);
    });
  });
});
