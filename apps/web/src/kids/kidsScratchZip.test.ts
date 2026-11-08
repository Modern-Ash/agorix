import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { readScratchProject } from "./kidsScratchZip.js";

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
