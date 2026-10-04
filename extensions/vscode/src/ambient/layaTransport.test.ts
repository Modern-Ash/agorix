import { describe, expect, it } from "vitest";
import { createHttpLayaTransport } from "./layaTransport.js";

describe("createHttpLayaTransport", () => {
  it("posts decideMany to a local endpoint and sanitizes confidence", async () => {
    const calls: unknown[] = [];
    const transport = createHttpLayaTransport({
      endpoint: "http://127.0.0.1:8787/",
      allowRemote: false,
      timeoutMs: 100,
      fetch: async (input, init) => {
        calls.push({ input, init });
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify([{ id: "proactiveAction", value: "silence", confidence: 2 }]),
        };
      },
    });

    await expect(
      transport?.decideMany({
        state: { kind: "runtime-error" },
        questions: [{ id: "proactiveAction", type: "choice", choices: ["silence", "offer"] }],
      }),
    ).resolves.toEqual([{ id: "proactiveAction", value: "silence", confidence: 1 }]);
    expect(calls[0]).toMatchObject({ input: "http://127.0.0.1:8787/decideMany" });
  });

  it("does not create a remote transport without explicit opt-in", () => {
    expect(
      createHttpLayaTransport({
        endpoint: "https://laya.example",
        allowRemote: false,
        timeoutMs: 100,
        fetch: async () => {
          throw new Error("network must not be used");
        },
      }),
    ).toBeUndefined();
  });
});
