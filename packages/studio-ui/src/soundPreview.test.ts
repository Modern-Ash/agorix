import { describe, expect, it, vi } from "vitest";
import type { AssetView } from "@agorix/studio-protocol";
import { canPreviewSound, playSoundPreview } from "./soundPreview.js";

const beacon: AssetView = {
  id: "asset:sound.beacon",
  name: "Beacon",
  kind: "sound",
  tags: [],
  source: "builtin:sound.beacon",
};

describe("Studio sound preview", () => {
  it("plays only the known built-in sound without editing the project", () => {
    const start = vi.fn();
    const stop = vi.fn();
    const close = vi.fn(async () => undefined);
    const connect = vi.fn().mockReturnThis();
    const oscillator = {
      type: "",
      frequency: { value: 0 },
      connect,
      start,
      stop,
      onended: null as null | (() => void),
    };
    const gain = { gain: { value: 0 }, connect };
    const context = {
      createOscillator: () => oscillator,
      createGain: () => gain,
      destination: {},
      currentTime: 2,
      close,
    } as unknown as AudioContext;
    expect(playSoundPreview(beacon, () => context)).toBe(true);
    expect(oscillator.frequency.value).toBe(520);
    expect(start).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledWith(2.2);
    oscillator.onended?.();
    expect(close).toHaveBeenCalledOnce();
  });

  it("refuses unknown or remote sources and handles a blocked audio device", () => {
    const create = vi.fn(() => {
      throw new Error("audio blocked");
    });
    expect(canPreviewSound({ ...beacon, source: "https://example.com/sound.wav" })).toBe(false);
    expect(playSoundPreview({ ...beacon, source: "https://example.com/sound.wav" }, create)).toBe(
      false,
    );
    expect(create).not.toHaveBeenCalled();
    expect(playSoundPreview(beacon, create)).toBe(false);
  });
});
