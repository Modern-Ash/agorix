import { describe, expect, it } from "vitest";
import {
  ContentGate,
  GateError,
  type ContentKind,
  type GateOptions,
  type LocalVerdict,
} from "../src/index.js";
import { FakeClock } from "./support.js";

const PAYLOAD = "PRIVATE-DRAWING-BYTES";

function build(verdict: LocalVerdict | "throws", extra: Partial<GateOptions> = {}) {
  const gate = new ContentGate({
    clock: new FakeClock(),
    sanitize: (_kind: ContentKind, payload: string) =>
      payload === "" ? undefined : `clean:${payload}`,
    classify: async () => {
      if (verdict === "throws") throw new Error("model crashed");
      return verdict;
    },
    ...extra,
  });
  return gate;
}

async function code(work: Promise<unknown>): Promise<string> {
  try {
    await work;
  } catch (error) {
    if (error instanceof GateError) return error.code;
    throw error;
  }
  return "OK";
}

describe("content gate", () => {
  it("queues only content the local model calls safe, for the organizer to decide", async () => {
    const gate = build("safe");
    const result = await gate.submit("slt_a", "Zorro Azul", "image", PAYLOAD);
    expect(result.status).toBe("queued");
    expect(gate.queue()).toEqual([
      { itemId: expect.any(String), alias: "Zorro Azul", kind: "image", hint: "safe" },
    ]);
  });

  it.each<LocalVerdict | "throws">(["unsafe", "uncertain", "unavailable", "throws"])(
    "fails closed on %s: nothing is queued or shared and nothing is echoed",
    async (verdict) => {
      const gate = build(verdict);
      const result = await gate.submit("slt_a", "Zorro Azul", "image", PAYLOAD);
      expect(result.status).toBe("rejected");
      expect(JSON.stringify(result)).not.toContain(PAYLOAD);
      expect(gate.queue()).toEqual([]);
      expect(JSON.stringify(gate.stats())).not.toContain(PAYLOAD);
    },
  );

  it("rejects content the deterministic sanitizer refuses, before any model runs", async () => {
    let classified = 0;
    const gate = build("safe", {
      classify: async () => {
        classified += 1;
        return "safe";
      },
    });
    const result = await gate.submit("slt_a", "Zorro Azul", "image", "");
    expect(result).toMatchObject({ status: "rejected" });
    expect(classified).toBe(0);
    expect(gate.stats().rejected.invalid).toBe(1);
  });

  it("keeps only coarse counts per reason", async () => {
    const unsafe = build("unsafe");
    await unsafe.submit("slt_a", "Zorro Azul", "image", PAYLOAD);
    await unsafe.submit("slt_a", "Zorro Azul", "name", PAYLOAD);
    expect(unsafe.stats().rejected).toMatchObject({ unsafe: 2, uncertain: 0 });
  });

  it("shares nothing until the organizer approves, and an approved item once", async () => {
    const gate = build("safe");
    const { itemId } = (await gate.submit("slt_a", "Zorro Azul", "image", PAYLOAD)) as {
      itemId: string;
    };
    expect(() => gate.sharedPayload(itemId)).toThrow(GateError);
    expect(gate.inspect(itemId)).toBe(`clean:${PAYLOAD}`);
    gate.decide(itemId, "approve");
    expect(gate.sharedPayload(itemId)).toBe(`clean:${PAYLOAD}`);
    expect(gate.queue()).toEqual([]);
    expect(() => gate.decide(itemId, "approve")).toThrow(GateError);
  });

  it("drops the content when the organizer rejects", async () => {
    const gate = build("safe");
    const { itemId } = (await gate.submit("slt_a", "Zorro Azul", "image", PAYLOAD)) as {
      itemId: string;
    };
    gate.decide(itemId, "reject");
    expect(() => gate.inspect(itemId)).toThrow(GateError);
    expect(() => gate.sharedPayload(itemId)).toThrow(GateError);
  });

  it("limits how much a member can queue and bounds the payload", async () => {
    const gate = build("safe", { maxQueuedPerMember: 1, maxPayloadChars: 10 });
    await gate.submit("slt_a", "Zorro Azul", "name", "ok");
    expect(await code(gate.submit("slt_a", "Zorro Azul", "name", "ok2"))).toBe("QUEUE_FULL");
    expect(await code(gate.submit("slt_b", "Gato Verde", "name", "x".repeat(11)))).toBe(
      "PAYLOAD_TOO_LARGE",
    );
  });

  it("forgets a removed member's queued and approved content", async () => {
    const gate = build("safe");
    const first = (await gate.submit("slt_a", "Zorro Azul", "image", PAYLOAD)) as {
      itemId: string;
    };
    gate.decide(first.itemId, "approve");
    await gate.submit("slt_a", "Zorro Azul", "name", "again");
    gate.forgetMember("slt_a");
    expect(gate.queue()).toEqual([]);
    expect(() => gate.sharedPayload(first.itemId)).toThrow(GateError);
  });

  it("clear() empties everything when the group closes", async () => {
    const gate = build("safe");
    const { itemId } = (await gate.submit("slt_a", "Zorro Azul", "image", PAYLOAD)) as {
      itemId: string;
    };
    gate.decide(itemId, "approve");
    gate.clear();
    expect(() => gate.sharedPayload(itemId)).toThrow(GateError);
    expect(gate.queue()).toEqual([]);
  });
});
