import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { md5Hex, zipStored } from "./kidsScratchPack.js";
import {
  readScratchPictures,
  SCRATCH_MAX_PICTURE_BYTES,
  SCRATCH_MAX_PICTURES,
  readScratchProject,
} from "./kidsScratchZip.js";

function zip(name: string, content: string, deflate: boolean): ArrayBuffer {
  const raw = new TextEncoder().encode(content);
  const data = deflate ? new Uint8Array(deflateRawSync(raw)) : raw;
  const nameBytes = new TextEncoder().encode(name);
  const local = new Uint8Array(30 + nameBytes.length);
  const lv = new DataView(local.buffer);
  lv.setUint32(0, 0x04034b50, true);
  lv.setUint16(8, deflate ? 8 : 0, true);
  lv.setUint32(18, data.length, true);
  lv.setUint32(22, raw.length, true);
  lv.setUint16(26, nameBytes.length, true);
  local.set(nameBytes, 30);
  const central = new Uint8Array(46 + nameBytes.length);
  const cv = new DataView(central.buffer);
  cv.setUint32(0, 0x02014b50, true);
  cv.setUint16(10, deflate ? 8 : 0, true);
  cv.setUint32(20, data.length, true);
  cv.setUint32(24, raw.length, true);
  cv.setUint16(28, nameBytes.length, true);
  cv.setUint32(42, 0, true);
  central.set(nameBytes, 46);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, 1, true);
  ev.setUint16(10, 1, true);
  ev.setUint32(12, central.length, true);
  ev.setUint32(16, local.length + data.length, true);
  const out = new Uint8Array(local.length + data.length + central.length + end.length);
  out.set(local, 0);
  out.set(data, local.length);
  out.set(central, local.length + data.length);
  out.set(end, local.length + data.length + central.length);
  return out.buffer;
}

describe("Scratch .sb3 reader", () => {
  it("reads project.json from a stored or a deflated entry", async () => {
    for (const deflate of [false, true])
      expect(await readScratchProject(zip("project.json", '{"targets":[1]}', deflate))).toEqual({
        targets: [1],
      });
  });
  it("accepts a bare project.json", async () => {
    const bytes = new TextEncoder().encode('{"targets":[]}');
    expect(await readScratchProject(bytes.buffer as ArrayBuffer)).toEqual({ targets: [] });
  });
  it("rejects a zip without project.json and garbage", async () => {
    await expect(readScratchProject(zip("other.txt", "x", false))).rejects.toThrow();
    await expect(
      readScratchProject(new Uint8Array([0x50, 0x4b, 1, 2, 3, 4]).buffer),
    ).rejects.toThrow();
  });
});

describe("reading pictures out of an .sb3", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  const nameOf = (bytes: Uint8Array, extension: string) => `${md5Hex(bytes)}.${extension}`;
  const pack = (files: { name: string; bytes: Uint8Array }[]) =>
    zipStored(files).buffer as ArrayBuffer;

  it("returns only the named pictures, with their type", async () => {
    const svg = new TextEncoder().encode("<svg/>");
    const other = new Uint8Array([9, 9, 9]);
    const buffer = pack([
      { name: "project.json", bytes: new TextEncoder().encode("{}") },
      { name: nameOf(png, "png"), bytes: png },
      { name: nameOf(svg, "svg"), bytes: svg },
      { name: nameOf(other, "png"), bytes: other },
    ]);
    const found = await readScratchPictures(buffer, [nameOf(png, "png"), nameOf(svg, "svg")]);
    expect(found.map((item) => [item.name, item.type])).toEqual([
      [nameOf(png, "png"), "image/png"],
      [nameOf(svg, "svg"), "image/svg+xml"],
    ]);
    expect([...found[0]!.bytes]).toEqual([...png]);
  });

  it("ignores a name that is not a Scratch picture file name, and a name the file lacks", async () => {
    const buffer = pack([
      { name: "../evil.png", bytes: png },
      { name: "project.json", bytes: png },
      { name: nameOf(png, "png"), bytes: png },
    ]);
    const found = await readScratchPictures(buffer, [
      "../evil.png",
      "project.json",
      "abc.png",
      `${"0".repeat(32)}.png`,
    ]);
    expect(found).toEqual([]);
  });

  it("skips a picture over the size cap and reads no more than the picture limit", async () => {
    const big = new Uint8Array(SCRATCH_MAX_PICTURE_BYTES + 1).fill(7);
    const many = Array.from(
      { length: SCRATCH_MAX_PICTURES + 5 },
      (_, i) => new Uint8Array([i, i + 1, i + 2]),
    );
    const buffer = pack([
      { name: nameOf(big, "png"), bytes: big },
      ...many.map((bytes) => ({ name: nameOf(bytes, "png"), bytes })),
    ]);
    const found = await readScratchPictures(buffer, [
      nameOf(big, "png"),
      ...many.map((bytes) => nameOf(bytes, "png")),
    ]);
    expect(found.some((item) => item.name === nameOf(big, "png"))).toBe(false);
    expect(found.length).toBeLessThanOrEqual(SCRATCH_MAX_PICTURES);
    expect(found.length).toBeGreaterThan(0);
  });

  it("returns nothing for a bare project.json or a file that is not a zip", async () => {
    const text = new TextEncoder().encode("{}").buffer as ArrayBuffer;
    expect(await readScratchPictures(text, [nameOf(png, "png")])).toEqual([]);
    expect(await readScratchPictures(new ArrayBuffer(0), [nameOf(png, "png")])).toEqual([]);
  });
});
