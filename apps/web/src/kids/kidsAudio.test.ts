import { describe, expect, it } from "vitest";
import { KidsAudioError, actorAudioKey, processKidsAudio } from "./kidsAudio.js";

function wav(seconds: number, type = "audio/wav"): Blob {
  const samples = 8_000 * seconds;
  const bytes = new Uint8Array(44 + samples * 2);
  const view = new DataView(bytes.buffer);
  for (const [at, text] of [
    [0, "RIFF"],
    [8, "WAVE"],
    [12, "fmt "],
    [36, "data"],
  ] as const) {
    for (let i = 0; i < text.length; i++) bytes[at + i] = text.charCodeAt(i);
  }
  view.setUint32(4, bytes.length - 8, true);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8_000, true);
  view.setUint32(28, 16_000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(40, samples * 2, true);
  return new Blob([bytes], { type });
}

describe("adult custom audio (issue #462)", () => {
  it("accepts valid local audio up to five seconds and strips file metadata", async () => {
    const output = await processKidsAudio(wav(5), async () => 5);
    expect(output).toBeInstanceOf(Blob);
    expect(output.size).toBe(wav(5).size);
    expect(output.type).toBe("audio/wav");
    expect(actorAudioKey({ kind: "emoji", value: "🐸" })).toBe("emoji:🐸");
    expect(actorAudioKey({ kind: "custom", id: "custom-2" })).toBe("custom:custom-2");
  });

  it("rejects wrong type, forged magic, over 500 KB and 30-second files", async () => {
    await expect(processKidsAudio(wav(1, "audio/mp4"), async () => 1)).rejects.toMatchObject({
      code: "unsupportedType",
    });
    await expect(
      processKidsAudio(new Blob(["bad"], { type: "audio/wav" }), async () => 1),
    ).rejects.toMatchObject({ code: "unsupportedType" });
    await expect(
      processKidsAudio(
        new Blob([new Uint8Array(500 * 1024 + 1)], { type: "audio/wav" }),
        async () => 1,
      ),
    ).rejects.toMatchObject({ code: "tooLarge" });
    await expect(processKidsAudio(wav(30), async () => 30)).rejects.toMatchObject({
      code: "tooLong",
    });
    await expect(
      processKidsAudio(wav(1), async () => {
        throw Error("decode");
      }),
    ).rejects.toBeInstanceOf(KidsAudioError);
  });
});
