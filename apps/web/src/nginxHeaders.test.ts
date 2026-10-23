import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { nginxSecurityHeadersFile, webSecurityHeaders } from "./securityHeaders.js";

const deployFile = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`../../../deploy/web/${name}`, import.meta.url)), "utf8");

describe("nginx production headers (issue #340)", () => {
  it("emits every production security header with the `always` flag", () => {
    const file = nginxSecurityHeadersFile();
    for (const [name, value] of Object.entries(webSecurityHeaders("production"))) {
      expect(file).toContain(`add_header ${name} "${value}" always;`);
    }
  });

  it("keeps deploy/web/security-headers.conf in sync with securityHeaders.ts", () => {
    expect(deployFile("security-headers.conf")).toBe(nginxSecurityHeadersFile());
  });

  it("includes the shared headers in every location that sets its own add_header", () => {
    const conf = deployFile("nginx.conf");
    expect(conf).toContain("include /etc/nginx/security-headers.conf;");
    const blocks = conf.split(/\n\s*location /).slice(1);
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      if (block.includes("add_header")) {
        expect(block, block.split("{")[0]).toContain("include /etc/nginx/security-headers.conf;");
      }
    }
  });

  it("never serves the development backend", () => {
    expect(deployFile("nginx.conf")).toMatch(/location \^~ \/__dev\/\s*\{\s*return 404;/);
  });

  it("routes project API requests to the host socket and returns JSON while it is absent", () => {
    const conf = deployFile("nginx.conf");
    expect(conf).toMatch(/location \^~ \/v1\/\s*\{[^}]*proxy_pass http:\/\/agorix_projects;/);
    expect(conf).toContain("error_page 502 504 = @projects_off;");
    expect(conf).toMatch(/location @projects_off\s*\{[^}]*default_type application\/json;/);
  });
});
