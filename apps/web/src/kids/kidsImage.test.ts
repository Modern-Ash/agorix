import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { processKidsImage } from "./kidsImage.js";

const png = readFileSync(new URL("../../e2e/fixtures/kids-solid.png", import.meta.url));

function image(bytes: Uint8Array, type: string): Blob {
  return new Blob([Uint8Array.from(bytes)], { type });
}

describe("local Kids image pipeline", () => {
  const close = vi.fn();
  const drawImage = vi.fn();
  const toDataURL = vi.fn();

  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 40, height: 20, close }));
    vi.stubGlobal("document", {
      createElement: vi.fn().mockReturnValue({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage }),
        toDataURL,
      }),
    });
    toDataURL.mockReturnValue("data:image/webp;base64,YQ==");
  });

  it("cover-crops and returns only the newly encoded image", async () => {
    const url = await processKidsImage(image(png, "image/png"));
    expect(url).toBe("data:image/webp;base64,YQ==");
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 10, 0, 20, 20, 0, 0, 256, 256);
    expect(close).toHaveBeenCalledOnce();
  });

  it("accepts a PNG encoder fallback when WebP encoding is unavailable", async () => {
    toDataURL.mockReturnValue("data:image/png;base64,YQ==");
    expect(await processKidsImage(image(png, "image/png"))).toBe("data:image/png;base64,YQ==");
    expect(close).toHaveBeenCalledOnce();
  });

  it("rejects an oversized input before reading or decoding it", async () => {
    const oversized = new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: "image/png" });
    await expect(processKidsImage(oversized)).rejects.toMatchObject({
      code: "tooLarge",
    });
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it("rejects a mismatched MIME and a failed decode with typed errors", async () => {
    await expect(processKidsImage(image(png, "image/jpeg"))).rejects.toMatchObject({
      code: "unsupportedType",
    });
    vi.mocked(createImageBitmap).mockRejectedValueOnce(new Error("bad image"));
    await expect(processKidsImage(image(png, "image/png"))).rejects.toMatchObject({
      code: "decodeFailed",
    });
  });
});
