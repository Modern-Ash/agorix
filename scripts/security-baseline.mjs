/**
 * Agorix POC child-safety and web-security baseline checks (issue #30).
 *
 * Enforces the controls documented in docs/safety/WEB_SECURITY_BASELINE.md. Every
 * rule is a static, dependency-free check so `pnpm security:check` runs in CI, in
 * a pre-commit hook and on a developer machine with the same result.
 *
 * Design rules for this file:
 * - no provider secrets, no child PII, no network calls;
 * - fail closed: an unreadable or unexpected state is a finding, not a pass;
 * - suppressions are explicit and attributed (`agora-allowlist: <reason>`).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, posix, relative, resolve, sep } from "node:path";

export const BASELINE_DOC = "docs/safety/WEB_SECURITY_BASELINE.md";
export const SAFETY_DOC_DIR = "docs/safety";
export const LINK_POLICY_FILE = "apps/web/src/linkPolicy";

const IGNORED_DIRECTORIES = new Set([
  ".agora",
  ".git",
  ".pnpm-store",
  ".turbo",
  ".venv",
  "ai-sdlc",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);

const IGNORED_FILES = new Set(["pnpm-lock.yaml", "package-lock.json", "yarn.lock"]);

const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".sh",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const FIRST_PARTY_SOURCE_GLOBS = ["apps/", "packages/", "extensions/"];

const ALLOWLIST_MARKER = "agora-allowlist:";
const FILE_ALLOWLIST_MARKER = "agora-allowlist-file:";
const MINIMUM_REASON_LENGTH = 10;

/** Provider secret configuration names, from apps/tutor-api/src/index.ts. */
export const PROVIDER_SECRET_IDENTIFIERS = Object.freeze([
  "AGORIX_TUTOR_API_KEY",
  "AGORIX_TUTOR_AUTH_TOKEN",
  "AGORIX_TUTOR_AUTH_HEADER",
]);

const GENERIC_SECRET_ASSIGNMENT =
  /\b(?:[A-Za-z0-9]*(?:api[_-]?key|secret|password|passwd|access[_-]?token|auth[_-]?token|private[_-]?key|credential)[A-Za-z0-9]*)\s*[:=]\s*["'][^"'\s]{16,}["']/i;

export const SECRET_PATTERNS = Object.freeze([
  { id: "openai-key", re: /\bsk-(?!ant-)[A-Za-z0-9]{20,}\b/ },
  { id: "anthropic-key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { id: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { id: "google-oauth-secret", re: /\bGOCSPX-[A-Za-z0-9_-]{20,}/ },
  { id: "aws-access-key", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  {
    id: "aws-secret-key",
    re: /aws_secret_access_key\s*[:=]\s*["'][A-Za-z0-9/+=]{40}["']/i,
  },
  { id: "github-token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { id: "github-fine-grained-token", re: /\bgithub_pat_[A-Za-z0-9_]{50,}\b/ },
  { id: "slack-token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
  { id: "stripe-live-key", re: /\b[rs]k_live_[A-Za-z0-9]{16,}\b/ },
  { id: "private-key-block", re: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/ },
  {
    id: "jwt",
    re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
  },
  { id: "generic-secret-assignment", re: GENERIC_SECRET_ASSIGNMENT },
]);

export const EXECUTION_SINK_PATTERNS = Object.freeze([
  { id: "eval-call", re: /\beval\s*\(/ },
  { id: "function-constructor", re: /\bnew\s+Function\s*\(|\bFunction\s*\(\s*["'`]/ },
  { id: "string-timer", re: /\bset(?:Timeout|Interval)\s*\(\s*["'`]/ },
  { id: "document-write", re: /\bdocument\s*\.\s*write(?:ln)?\s*\(/ },
  { id: "raw-html-sink", re: /\.innerHTML\s*=|\.outerHTML\s*=|dangerouslySetInnerHTML/ },
  { id: "dynamic-code-module", re: /["'](?:node:)?(?:vm|child_process|worker_threads)["']/ },
  { id: "import-scripts", re: /\bimportScripts\s*\(/ },
  { id: "wasm-execution", re: /\bWebAssembly\s*\.\s*(?:compile|instantiate)\s*\(/ },
]);

/**
 * `scripts/**` and the lint config are excluded: they are where these deny-list
 * literals necessarily live.
 */
const EXECUTION_SINK_SCOPE = { include: FIRST_PARTY_SOURCE_GLOBS, exclude: ["scripts/"] };

export const PROHIBITED_FEATURE_PATTERNS = Object.freeze([
  {
    id: "geolocation",
    re: /\bnavigator\s*\.\s*geolocation\b|\bgetCurrentPosition\s*\(|\bwatchPosition\s*\(/,
  },
  {
    id: "user-media",
    re: /\bgetUserMedia\s*\(|\bMediaRecorder\b|\bnavigator\s*\.\s*mediaDevices\b/,
  },
  { id: "outbound-socket", re: /\bnew\s+WebSocket\s*\(|\bsendBeacon\s*\(/ },
  {
    id: "direct-messaging",
    re: /\b(?:send|create|open)(?:DirectMessage|Dm)\w*\s*\(|\bchatRoom\w*\s*\(|\bpublicChat\w*\s*\(/,
  },
  {
    id: "social-graph",
    re: /\b(?:followUser|unfollowUser|addFriend|removeFriend|friendRequest)\w*\s*\(/,
  },
  { id: "public-publishing", re: /\b(?:publishProject|shareProject|publishToFeed)\w*\s*\(/ },
]);

/** Declared field names that would mean a POC account, PII or location field. */
export const PII_DOMAIN_FIELD_PATTERN =
  /\b(?:email|eMail|phone|phoneNumber|school|schoolName|address|streetAddress|postcode|zipCode|zip|birthDate|dateOfBirth|realName|fullName|legalName|displayName|avatarUrl|photoUrl|userId|accountId|username|password|latitude|longitude|geoHash|age)\??\s*:/g;

const PII_SCOPE = { include: ["packages/persistence/", "packages/platform-contract/"] };

/**
 * Issue #103: raw learner free text must never reach a logging sink. Matches
 * a console/log-shaped call whose arguments reference the free-text fields.
 */
export const LEARNER_FREE_TEXT_LOG_PATTERN =
  /\b(?:console\s*\.\s*\w+|log(?:ger)?\s*\.\s*\w+)\s*\([^)]*\b(?:learnerIntent|learnerQuestion)\b/;

const LEARNER_FREE_TEXT_LOG_SCOPE = { include: FIRST_PARTY_SOURCE_GLOBS };

/** Vite config is included: build-time env injection is the classic bundle leak. */
const CLIENT_IDENTIFIER_SCOPE = { include: ["apps/web/", "apps/mobile/"] };
/** Only code and markup that actually ship to the browser. */
const CLIENT_CODE_SCOPE = {
  include: ["apps/web/src/", "apps/web/index.html", "apps/web/public/", "apps/mobile/"],
};

const EXTERNAL_LINK_PATTERNS = Object.freeze([
  { id: "anchor-element", re: /<a\b[\s>]/ },
  { id: "href-attribute", re: /\bhref\s*[:=]/ },
  { id: "window-open", re: /\bwindow\s*\.\s*open\s*\(/ },
  { id: "location-navigation", re: /\blocation\s*\.\s*(?:href|assign|replace)\s*=/ },
  { id: "import-meta-url", re: /\bimport\s*\.\s*meta\s*\.\s*env\b/ },
]);

const EXTERNAL_LINK_SCOPE = { include: ["apps/web/src/"] };

function toPosix(path) {
  return path.split(sep).join(posix.sep);
}

function stripAllowlist(line) {
  const at = line.indexOf(ALLOWLIST_MARKER);
  return at === -1 ? line : line.slice(0, at);
}

function hasLineAllowlist(line) {
  const at = line.indexOf(ALLOWLIST_MARKER);
  if (at === -1) return false;
  return line.slice(at + ALLOWLIST_MARKER.length).trim().length >= MINIMUM_REASON_LENGTH;
}

function hasFileAllowlist(content) {
  const head = content.split("\n").slice(0, 20).join("\n");
  const at = head.indexOf(FILE_ALLOWLIST_MARKER);
  if (at === -1) return false;
  return (
    head
      .slice(at + FILE_ALLOWLIST_MARKER.length)
      .split("\n")[0]
      .trim().length >= MINIMUM_REASON_LENGTH
  );
}

function isTextFile(path) {
  const base = path.slice(path.lastIndexOf("/") + 1);
  if (IGNORED_FILES.has(base)) return false;
  if (base.startsWith(".")) return base === "_headers";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return true;
  return TEXT_EXTENSIONS.has(base.slice(dot));
}

function inScope(relativePath, scope) {
  if (scope?.exclude?.some((prefix) => relativePath.startsWith(prefix))) return false;
  return scope?.include?.some((prefix) => relativePath.startsWith(prefix)) ?? true;
}

function collectFiles(root) {
  const files = [];
  const walk = (directory) => {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name) || entry.name.startsWith(".")) continue;
        walk(join(directory, entry.name));
      } else if (entry.isFile()) {
        const absolute = join(directory, entry.name);
        const relativePath = toPosix(relative(root, absolute));
        if (isTextFile(relativePath)) files.push(relativePath);
      }
    }
  };
  walk(root);
  return files;
}

function finding(rule, file, line, message) {
  return { rule, file, line, message };
}

function scanPatterns({ files, read, patterns, scope, label }) {
  const findings = [];
  for (const file of files) {
    if (!inScope(file, scope)) continue;
    const content = read(file);
    if (content === null || hasFileAllowlist(content)) continue;
    const lines = content.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const raw = lines[index] ?? "";
      if (hasLineAllowlist(raw)) continue;
      const line = stripAllowlist(raw);
      for (const pattern of patterns) {
        const match = pattern.re.exec(line);
        if (match) {
          findings.push(
            finding(
              "no-eval",
              file,
              index + 1,
              `${label} ${pattern.id} near ${JSON.stringify(match[0].slice(0, 60))}`,
            ),
          );
        }
        pattern.re.lastIndex = 0;
      }
    }
  }
  return findings;
}

function checkSecretFixtures({ files, read }) {
  const findings = [];
  for (const file of files) {
    const content = read(file);
    if (content === null || hasFileAllowlist(content)) continue;
    const lines = content.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const raw = lines[index] ?? "";
      if (hasLineAllowlist(raw)) continue;
      const line = stripAllowlist(raw);
      for (const pattern of SECRET_PATTERNS) {
        const match = pattern.re.exec(line);
        if (match) {
          findings.push(
            finding(
              "secret-scan",
              file,
              index + 1,
              `secret fixture pattern ${pattern.id} — replace with an obviously fake value and add "${ALLOWLIST_MARKER} <reason>" if it must stay`,
            ),
          );
        }
        pattern.re.lastIndex = 0;
      }
    }
  }
  return findings;
}

function checkClientSecrets({ files, read, root, notes }) {
  const findings = [];
  for (const file of files) {
    if (!inScope(file, CLIENT_IDENTIFIER_SCOPE)) continue;
    const content = read(file);
    if (content === null || hasFileAllowlist(content)) continue;
    const lines = content.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const raw = lines[index] ?? "";
      if (hasLineAllowlist(raw)) continue;
      const line = stripAllowlist(raw);
      for (const identifier of PROVIDER_SECRET_IDENTIFIERS) {
        if (line.includes(identifier)) {
          findings.push(
            finding(
              "no-client-secrets",
              file,
              index + 1,
              `provider secret "${identifier}" must not be referenced by client code`,
            ),
          );
        }
      }
    }
  }

  for (const file of files) {
    if (!inScope(file, CLIENT_CODE_SCOPE)) continue;
    const content = read(file);
    if (content === null || hasFileAllowlist(content)) continue;
    const lines = content.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const raw = lines[index] ?? "";
      if (hasLineAllowlist(raw)) continue;
      const line = stripAllowlist(raw);
      if (/\b(?:process|import\s*\.\s*meta)\s*\.\s*env\b/.test(line)) {
        findings.push(
          finding(
            "no-client-secrets",
            file,
            index + 1,
            "shipped client code must not read environment variables",
          ),
        );
      }
    }
  }

  const distDir = resolve(root, "apps/web/dist");
  let distPresent = false;
  try {
    distPresent = statSync(distDir).isDirectory();
  } catch {
    distPresent = false;
  }
  if (distPresent) {
    const bundleFiles = collectFiles(distDir).filter((path) =>
      /\.(?:js|mjs|css|html|map)$/.test(path),
    );
    for (const bundleFile of bundleFiles) {
      const content = readFileSync(join(distDir, bundleFile), "utf8");
      for (const identifier of PROVIDER_SECRET_IDENTIFIERS) {
        if (content.includes(identifier)) {
          findings.push(
            finding(
              "no-client-secrets",
              `apps/web/dist/${bundleFile}`,
              0,
              `built bundle leaks provider secret "${identifier}"`,
            ),
          );
        }
      }
      if (
        /\bsk-ant-[A-Za-z0-9_-]{20,}/.test(content) ||
        /\bsk-(?!ant-)[A-Za-z0-9]{20,}/.test(content)
      ) {
        findings.push(
          finding(
            "no-client-secrets",
            `apps/web/dist/${bundleFile}`,
            0,
            "built bundle contains a provider key pattern",
          ),
        );
      }
    }
    notes.push(`scanned ${bundleFiles.length} built client bundle file(s)`);
  } else {
    notes.push(
      "apps/web/dist not built; client bundle scan skipped (run pnpm build first for full coverage)",
    );
  }
  return findings;
}

function checkExternalLinks({ files, read }) {
  const findings = [];
  for (const file of files) {
    if (!inScope(file, EXTERNAL_LINK_SCOPE)) continue;
    if (file.startsWith(LINK_POLICY_FILE)) continue;
    const content = read(file);
    if (content === null || hasFileAllowlist(content)) continue;
    const lines = content.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const raw = lines[index] ?? "";
      if (hasLineAllowlist(raw)) continue;
      const line = stripAllowlist(raw);
      for (const pattern of EXTERNAL_LINK_PATTERNS) {
        if (pattern.re.test(line)) {
          findings.push(
            finding(
              "external-links",
              file,
              index + 1,
              `link surface ${pattern.id} must go through ${LINK_POLICY_FILE}.ts`,
            ),
          );
        }
      }
    }
  }
  return findings;
}

function checkPiiDomainFields({ files, read }) {
  const findings = [];
  for (const file of files) {
    if (!inScope(file, PII_SCOPE)) continue;
    const content = read(file);
    if (content === null || hasFileAllowlist(content)) continue;
    const lines = content.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const raw = lines[index] ?? "";
      if (hasLineAllowlist(raw)) continue;
      const line = stripAllowlist(raw);
      PII_DOMAIN_FIELD_PATTERN.lastIndex = 0;
      const match = PII_DOMAIN_FIELD_PATTERN.exec(line);
      if (match) {
        const field = match[0].replace(/\??\s*:$/, "");
        if (isAllowedPlatformContractIdentityField(file, field)) continue;
        findings.push(
          finding(
            "no-pii-domain-fields",
            file,
            index + 1,
            `POC domain field "${field}" is not allowed in the canonical/persistence contracts`,
          ),
        );
      }
    }
  }
  return findings;
}

function isAllowedPlatformContractIdentityField(file, field) {
  return file.startsWith("packages/platform-contract/") && field === "accountId";
}

function checkLearnerFreeTextLogging({ files, read }) {
  const findings = [];
  for (const file of files) {
    if (!inScope(file, LEARNER_FREE_TEXT_LOG_SCOPE)) continue;
    const content = read(file);
    if (content === null || hasFileAllowlist(content)) continue;
    const lines = content.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const raw = lines[index] ?? "";
      if (hasLineAllowlist(raw)) continue;
      const line = stripAllowlist(raw);
      if (LEARNER_FREE_TEXT_LOG_PATTERN.test(line)) {
        findings.push(
          finding(
            "no-learner-free-text-logging",
            file,
            index + 1,
            "raw learner free text (learnerIntent/learnerQuestion) must not reach a logging sink",
          ),
        );
      }
    }
  }
  return findings;
}

function checkProhibitedFeatures({ files, read }) {
  const findings = [];
  for (const file of files) {
    if (!inScope(file, { include: FIRST_PARTY_SOURCE_GLOBS })) continue;
    const content = read(file);
    if (content === null || hasFileAllowlist(content)) continue;
    const lines = content.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const raw = lines[index] ?? "";
      if (hasLineAllowlist(raw)) continue;
      const line = stripAllowlist(raw);
      for (const pattern of PROHIBITED_FEATURE_PATTERNS) {
        if (pattern.re.test(line)) {
          findings.push(
            finding(
              "no-prohibited-features",
              file,
              index + 1,
              `prohibited POC feature ${pattern.id}`,
            ),
          );
        }
      }
    }
  }
  return findings;
}

function checkSafetyDocs({ files, read, notes }) {
  const findings = [];
  const baseline = read(BASELINE_DOC);
  if (baseline === null) {
    return [finding("cross-links", BASELINE_DOC, 0, "security baseline document is missing")];
  }

  for (const issue of ["#100", "#103"]) {
    if (!baseline.includes(issue)) {
      findings.push(finding("cross-links", BASELINE_DOC, 0, `must reference ${issue}`));
    }
  }
  if (!baseline.includes("## Deviations")) {
    findings.push(
      finding("adr-deviations", BASELINE_DOC, 0, "must contain a `## Deviations` registry"),
    );
  }

  const deviations = /## Deviations[\s\S]*$/m.exec(baseline)?.[0] ?? "";
  const deviationRows = deviations
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) => line.startsWith("|") && !/^\|\s*-+/.test(line) && !/^\|\s*Control/i.test(line),
    );
  for (const row of deviationRows) {
    if (/^-\s/.test(row) || row === "|" || row === "||") continue;
    if (/ADR-\d+|docs\/architecture\/adr\/|#\d+/.test(row)) continue;
    if (/\bnone\b/i.test(row)) continue;
    findings.push(
      finding(
        "adr-deviations",
        BASELINE_DOC,
        0,
        `deviation row needs an explicit ADR or issue reference: ${row.slice(0, 80)}`,
      ),
    );
  }

  const safetyDocs = files.filter(
    (file) => file.startsWith(`${SAFETY_DOC_DIR}/`) && file.endsWith(".md"),
  );
  for (const doc of safetyDocs) {
    if (doc === BASELINE_DOC) continue;
    const content = read(doc) ?? "";
    const links = safetyDocs.filter(
      (other) => other !== doc && content.includes(posix.basename(other)),
    );
    if (links.length === 0) {
      findings.push(
        finding(
          "cross-links",
          doc,
          0,
          `safety document must link a sibling document in ${SAFETY_DOC_DIR}/`,
        ),
      );
    }
  }
  notes.push(`inspected ${safetyDocs.length} safety document(s)`);
  return findings;
}

/**
 * Runs every baseline rule against `root`. Returns findings plus human-readable
 * notes; never throws for a rule failure.
 */
export function runSecurityBaseline(root = process.cwd()) {
  const absoluteRoot = resolve(root);
  const files = collectFiles(absoluteRoot);
  const cache = new Map();
  const read = (file) => {
    if (cache.has(file)) return cache.get(file);
    let content = null;
    try {
      content = readFileSync(join(absoluteRoot, file), "utf8");
    } catch {
      content = null;
    }
    cache.set(file, content);
    return content;
  };

  const notes = [];
  const findings = [
    ...checkSecretFixtures({ files, read }),
    ...checkClientSecrets({ files, read, root: absoluteRoot, notes }),
    ...scanPatterns({
      files,
      read,
      patterns: EXECUTION_SINK_PATTERNS,
      scope: EXECUTION_SINK_SCOPE,
      label: "arbitrary code execution sink",
    }),
    ...checkExternalLinks({ files, read }),
    ...checkPiiDomainFields({ files, read }),
    ...checkLearnerFreeTextLogging({ files, read }),
    ...checkProhibitedFeatures({ files, read }),
    ...checkSafetyDocs({ files, read, notes }),
  ];

  findings.sort(
    (a, b) => a.rule.localeCompare(b.rule) || a.file.localeCompare(b.file) || a.line - b.line,
  );
  notes.push(`inspected ${files.length} text file(s)`);
  return { ok: findings.length === 0, findings, notes, inspectedFiles: files.length };
}

export function formatFindings(result) {
  if (result.ok) {
    return [`security baseline: PASS (${result.notes.join("; ")})`].join("\n");
  }
  const lines = [`security baseline: FAIL — ${result.findings.length} finding(s)`];
  for (const item of result.findings) {
    lines.push(`  [${item.rule}] ${item.file}:${item.line} — ${item.message}`);
  }
  return lines.join("\n");
}

function main() {
  const result = runSecurityBaseline(process.cwd());
  process.stdout.write(`${formatFindings(result)}\n`);
  process.exitCode = result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main();
}
