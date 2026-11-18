import { describe, expect, it, vi } from "vitest";
import type { AssetView } from "@agorix/studio-protocol";
import { ADVANCED_SOUNDS } from "@agorix/curriculum";
import { canPreviewSound, playSoundPreview } from "./soundPreview.js";

const beacon: AssetView = {
  id: "asset:sound.beacon",
  name: "Beacon",
  kind: "sound",
  tags: [],
  source: "builtin:sound.beacon",
};
const wav =
  "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQEAAACAAA==";

describe("Studio sound preview", () => {
  it("previews a bounded embedded WAV without requesting a remote source", () => {
    const play = vi.fn(async () => undefined);
    const createAudio = vi.fn(() => ({ play }) as unknown as HTMLAudioElement);
    const createContext = vi.fn(() => {
      throw new Error("tone context should not open");
    });
    const sound = { ...beacon, source: wav };
    expect(canPreviewSound(sound)).toBe(true);
    expect(playSoundPreview(sound, createContext, createAudio)).toBe(true);
    expect(createAudio).toHaveBeenCalledWith(wav);
    expect(play).toHaveBeenCalledOnce();
    expect(createContext).not.toHaveBeenCalled();
    expect(canPreviewSound({ ...sound, source: "https://example.com/sound.wav" })).toBe(false);
  });
  it("previews every bundled sound with its bounded local tone", () => {
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
    for (const sound of ADVANCED_SOUNDS) {
      const asset = { ...beacon, id: sound.id, source: sound.source };
      expect(canPreviewSound(asset)).toBe(true);
      expect(playSoundPreview(asset, () => context)).toBe(true);
      expect(oscillator.type).toBe(sound.wave);
      expect(oscillator.frequency.value).toBe(sound.frequencyHz);
      expect(gain.gain.value).toBe(sound.gain);
      expect(stop).toHaveBeenLastCalledWith(2 + sound.durationMs / 1000);
      oscillator.onended?.();
    }
    expect(start).toHaveBeenCalledTimes(ADVANCED_SOUNDS.length);
    expect(close).toHaveBeenCalledTimes(ADVANCED_SOUNDS.length);
  });

  it("refuses unknown or remote sources and handles a blocked audio device", () => {
    const create = vi.fn(() => {
      throw new Error("audio blocked");
    });
    expect(canPreviewSound({ ...beacon, source: "https://example.com/sound.wav" })).toBe(false);
    expect(canPreviewSound({ ...beacon, kind: "costume" })).toBe(false);
    expect(canPreviewSound({ ...beacon, source: "builtin:sound.unknown" })).toBe(false);
    expect(playSoundPreview({ ...beacon, source: "https://example.com/sound.wav" }, create)).toBe(
      false,
    );
    expect(create).not.toHaveBeenCalled();
    expect(playSoundPreview(beacon, create)).toBe(false);
  });
});
