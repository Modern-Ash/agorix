import { afterEach, describe, expect, it, vi } from "vitest";
import { withAgorixSessionQueue } from "./sessionRequestQueue.js";

describe("shared rotating session request queue", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("serializes requests and preserves ordering", async () => {
    const events: string[] = [];
    let release!: () => void;
    const first = withAgorixSessionQueue(async () => {
      events.push("first-start");
      await new Promise<void>((done) => {
        release = done;
      });
      events.push("first-end");
    });
    const second = withAgorixSessionQueue(async () => {
      events.push("second");
    });
    await Promise.resolve();
    expect(events).toEqual(["first-start"]);
    release();
    await Promise.all([first, second]);
    expect(events).toEqual(["first-start", "first-end", "second"]);
  });
  it("continues after a rejected request", async () => {
    await expect(
      withAgorixSessionQueue(async () => {
        throw Error("network");
      }),
    ).rejects.toThrow("network");
    await expect(withAgorixSessionQueue(async () => 42)).resolves.toBe(42);
  });
  it("uses an exclusive same-origin Web Lock when available", async () => {
    const calls: string[] = [];
    vi.stubGlobal("navigator", {
      locks: {
        request: async (name: string, options: { mode: string }, task: () => Promise<number>) => {
          calls.push(name + ":" + options.mode);
          return task();
        },
      },
    });
    await expect(withAgorixSessionQueue(async () => 7)).resolves.toBe(7);
    expect(calls).toEqual(["agorix-auth-session-rotation:exclusive"]);
  });
  it("releases the lock and continues after failure", async () => {
    let count = 0;
    vi.stubGlobal("navigator", {
      locks: {
        request: async (_name: string, _options: unknown, task: () => Promise<number>) => {
          count++;
          return task();
        },
      },
    });
    await expect(
      withAgorixSessionQueue(async () => {
        throw Error("denied");
      }),
    ).rejects.toThrow("denied");
    await expect(withAgorixSessionQueue(async () => 9)).resolves.toBe(9);
    expect(count).toBe(2);
  });
});
