import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const manifestPath = fileURLToPath(new URL("../public/manifest.webmanifest", import.meta.url));
const faviconPath = fileURLToPath(new URL("../public/favicon.v2.svg", import.meta.url));
const brandLogoPath = fileURLToPath(new URL("../public/brand/agorix-logo.v2.svg", import.meta.url));
const headerLogoPath = fileURLToPath(
  new URL("../public/brand/agorix-logo-header.v2.svg", import.meta.url),
);

interface WebAppManifest {
  readonly name: string;
  readonly short_name: string;
  readonly start_url: string;
  readonly display: string;
  readonly background_color: string;
  readonly theme_color: string;
  readonly icons: readonly {
    readonly src: string;
    readonly sizes: string;
    readonly type: string;
  }[];
}

function readManifest(): WebAppManifest {
  return JSON.parse(readFileSync(manifestPath, "utf-8")) as WebAppManifest;
}

describe("web app manifest (issue #36, AC-001: PWA installability)", () => {
  it("declares the minimum fields Chromium's installability check requires", () => {
    const manifest = readManifest();
    expect(manifest.name.length).toBeGreaterThan(0);
    expect(manifest.short_name.length).toBeGreaterThan(0);
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(typeof manifest.background_color).toBe("string");
    expect(typeof manifest.theme_color).toBe("string");
  });

  it("declares at least one 'any'-purpose icon and one maskable icon", () => {
    const manifest = readManifest();
    expect(manifest.icons.some((icon) => !("purpose" in icon) || icon.purpose === "any")).toBe(
      true,
    );
    expect(
      manifest.icons.some((icon) => (icon as { purpose?: string }).purpose === "maskable"),
    ).toBe(true);
    expect(manifest.icons.some((icon) => icon.src === "/icons/agorix-mark.v2.svg")).toBe(true);
    for (const icon of manifest.icons) {
      expect(icon.src.startsWith("/")).toBe(true);
      expect(icon.type.length).toBeGreaterThan(0);
    }
  });

  it("uses the brand assets for app logo and favicon paths", () => {
    expect(readFileSync(faviconPath, "utf-8")).toContain("<svg");
    expect(readFileSync(brandLogoPath, "utf-8")).toContain("CODE · CREATE · WITH AI");
    expect(readFileSync(headerLogoPath, "utf-8")).toContain("#FFFFFF");
  });

  it("is valid JSON with no trailing content", () => {
    expect(() => readManifest()).not.toThrow();
  });
});
