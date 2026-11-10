import { describe, expect, it } from "vitest";
import { md5Hex, zipStored } from "./kidsScratchPack.js";
import { readScratchProject } from "./kidsScratchZip.js";

const bytes = (text: string) => new TextEncoder().encode(text);

describe("the .sb3 packer", () => {
  it("computes MD5 like the standard test vectors", () => {
    expect(md5Hex(bytes(""))).toBe("d41d8cd98f00b204e9800998ecf8427e");
    expect(md5Hex(bytes("abc"))).toBe("900150983cd24fb0d6963f7d28e17f72");
    expect(md5Hex(bytes("The quick brown fox jumps over the lazy dog"))).toBe(
      "9e107d9d372bb6826bd81d3542a419d6",
    );
    expect(md5Hex(bytes("a".repeat(1000)))).toBe("cabe45dcc9ae5b66ba86600cca6b8ba8");
  });

  it("writes a zip the importer's reader opens, with the same bytes every time", async () => {
    const files = [
      { name: "project.json", bytes: bytes('{"targets":[{"isStage":true}]}') },
      { name: "a.svg", bytes: bytes("<svg/>") },
    ];
    const zip = zipStored(files);
    expect(zipStored(files)).toEqual(zip);
    expect(await readScratchProject(zip.buffer as ArrayBuffer)).toEqual({
      targets: [{ isStage: true }],
    });
  });
});
