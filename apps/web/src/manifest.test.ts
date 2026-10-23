import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const manifestPath = fileURLToPath(new URL("../public/manifest.webmanifest", import.meta.url));
const indexHtmlPath = fileURLToPath(new URL("../index.html", import.meta.url));
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
    readonly purpose?: string;
  }[];
}

function readManifest(): WebAppManifest {
  return JSON.parse(readFileSync(manifestPath, "utf-8")) as WebAppManifest;
}

function pngDimensions(url: URL): [number, number] {
  const bytes = readFileSync(fileURLToPath(url));
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
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

  it("provides real PNG icons at install sizes, including a maskable 512 px asset (#361)", () => {
    const icons = readManifest().icons;
    const expected = [
      ["/icons/agorix-mark-192.png", "192x192", "any"],
      ["/icons/agorix-mark-512.png", "512x512", "any"],
      ["/icons/agorix-mark-maskable-512.png", "512x512", "maskable"],
    ] as const;
    for (const [src, sizes, purpose] of expected) {
      expect(icons).toContainEqual({ src, sizes, type: "image/png", purpose });
      expect(pngDimensions(new URL(`../public${src}`, import.meta.url))).toEqual(
        sizes.split("x").map(Number),
      );
    }
  });

  it("uses a 180 px PNG touch icon and a 1200x630 same-origin sharing image (#361)", () => {
    const html = readFileSync(indexHtmlPath, "utf-8");
    expect(html).toMatch(/<link rel="apple-touch-icon" [^>]*\/icons\/agorix-mark-180\.png"/);
    expect(pngDimensions(new URL("../public/icons/agorix-mark-180.png", import.meta.url))).toEqual([
      180, 180,
    ]);
    expect(html).toContain(
      'content="https://agorix.modern-ash.com/brand/agorix-share-1200x630.png"',
    );
    expect(html).toContain('property="og:image:width" content="1200"');
    expect(html).toContain('property="og:image:height" content="630"');
    expect(
      pngDimensions(new URL("../public/brand/agorix-share-1200x630.png", import.meta.url)),
    ).toEqual([1200, 630]);
  });

  it("uses the brand assets for app logo and favicon paths", () => {
    expect(readFileSync(faviconPath, "utf-8")).toContain("<svg");
    expect(readFileSync(brandLogoPath, "utf-8")).toContain("CODE · CREATE · WITH AI");
    expect(readFileSync(headerLogoPath, "utf-8")).toContain("#FFFFFF");
  });

  it("describes the product in Spanish for the production audience (issue #344)", () => {
    const manifest = readManifest() as WebAppManifest & { lang?: string; description?: string };
    expect(manifest.lang).toBe("es");
    expect(manifest.description).toMatch(/programaci[oó]n/i);
  });

  it("ships search and sharing metadata in the document head (issue #344)", () => {
    const html = readFileSync(indexHtmlPath, "utf-8");
    expect(html).toMatch(/<meta\s+name="description"\s+content="[^"]{40,}"/);
    expect(html).toContain('property="og:title"');
    expect(html).toContain('property="og:description"');
    expect(html).toContain('property="og:locale" content="es_AR"');
    expect(html).toContain('property="og:type" content="website"');
  });

  it("is valid JSON with no trailing content", () => {
    expect(() => readManifest()).not.toThrow();
  });
});
