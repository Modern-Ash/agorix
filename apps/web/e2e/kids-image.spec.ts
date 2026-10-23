import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { transformWithEsbuild } from "vite";

const jpeg = readFileSync(resolve("e2e/fixtures/kids-gps-zero.jpg"));
const png = readFileSync(resolve("e2e/fixtures/kids-solid.png"));
const webp = readFileSync(resolve("e2e/fixtures/kids-solid.webp"));

type ImageWindow = Window & {
  processKidsImage: (blob: Blob) => Promise<string>;
};

async function loadPipeline(page: Page) {
  const source = readFileSync(resolve("src/kids/kidsImage.ts"), "utf8");
  const { code } = await transformWithEsbuild(source, "kidsImage.ts", { loader: "ts" });
  await page.route("**/kids-image-test.js", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/javascript",
      body: `${code}\nwindow.processKidsImage = processKidsImage;`,
    }),
  );
  await page.goto("/");
  await page.addScriptTag({
    type: "module",
    url: "/kids-image-test.js",
  });
  await expect
    .poll(() => page.evaluate(() => typeof (window as ImageWindow).processKidsImage))
    .toBe("function");
}

async function result(page: Page, bytes: Uint8Array, mime: string) {
  return page.evaluate(
    async ({ data, type }) => {
      try {
        const url = await (window as ImageWindow).processKidsImage(
          new Blob([new Uint8Array(data)], { type }),
        );
        return { url };
      } catch (error) {
        return { code: (error as { code?: string }).code };
      }
    },
    { data: Array.from(bytes), type: mime },
  );
}

test("JPEG with GPS EXIF becomes a small 256 px image without source metadata", async ({
  page,
}) => {
  await loadPipeline(page);
  const output = await result(page, jpeg, "image/jpeg");
  expect(output.code).toBeUndefined();
  expect(output.url).toMatch(/^data:image\/(webp|png);base64,/);
  const details = await page.evaluate(async (url) => {
    const bytes = Uint8Array.from(atob(url.split(",")[1]!), (char) => char.charCodeAt(0));
    const blob = new Blob([bytes], { type: url.slice(5, url.indexOf(";")) });
    const bitmap = await createImageBitmap(blob);
    const text = new TextDecoder("latin1").decode(bytes);
    const answer = { width: bitmap.width, height: bitmap.height, bytes: bytes.length, text };
    bitmap.close();
    return answer;
  }, output.url!);
  expect(details).toMatchObject({ width: 256, height: 256 });
  expect(details.bytes).toBeLessThan(60 * 1024);
  expect(details.text).not.toContain("Exif");
  expect(details.text).not.toContain("GPS");
});

test("rejects renamed formats, oversized dimensions and broken images before decoding", async ({
  page,
}) => {
  await loadPipeline(page);
  for (const data of ["<svg></svg>", "GIF89a", "PK\x03\x04"]) {
    const output = await result(page, new TextEncoder().encode(data), "image/png");
    expect(output.code).toBe("unsupportedType");
  }
  const huge = new Uint8Array(png);
  const header = new DataView(huge.buffer);
  header.setUint32(16, 10_000);
  header.setUint32(20, 10_000);
  await page.evaluate(() => {
    (window as Window & { decodeCalls: number }).decodeCalls = 0;
    const original = window.createImageBitmap;
    window.createImageBitmap = async (...args) => {
      (window as Window & { decodeCalls: number }).decodeCalls++;
      return original(...args);
    };
  });
  expect((await result(page, huge, "image/png")).code).toBe("tooLarge");
  expect(await page.evaluate(() => (window as Window & { decodeCalls: number }).decodeCalls)).toBe(
    0,
  );
  expect((await result(page, jpeg.subarray(0, 100), "image/jpeg")).code).toBe("decodeFailed");
});

test("accepts PNG and WebP signatures when the MIME matches", async ({ page }) => {
  await loadPipeline(page);
  for (const [bytes, mime] of [
    [png, "image/png"],
    [webp, "image/webp"],
  ] as const) {
    const output = await result(page, bytes, mime);
    expect(output.code).toBeUndefined();
    expect(output.url).toMatch(/^data:image\/(webp|png);base64,/);
  }
});

test("reports outputTooLarge when local encoding cannot fit the budget", async ({ page }) => {
  await loadPipeline(page);
  await page.evaluate(() => {
    HTMLCanvasElement.prototype.toDataURL = () => `data:image/webp;base64,${"A".repeat(100_000)}`;
  });
  expect((await result(page, png, "image/png")).code).toBe("outputTooLarge");
});
