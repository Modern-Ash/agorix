import { describe, expect, it } from "vitest";
import type { ProjectSceneGoal } from "@agorix/persistence";
import { requestSceneGoal } from "./kidsSceneGoalsRemote.js";

const choices: readonly ProjectSceneGoal[] = [
  { kind: "reachEdge", actorId: "actor:studio-1-nova" },
  { kind: "touchActor", actorId: "actor:studio-1-nova", targetId: "actor:studio-2-mika" },
];
const reply = (body: string, status = 200) =>
  (async () => new Response(body, { status })) as unknown as typeof fetch;

describe("remote scene goals (issue #1135)", () => {
  it("returns the local goal at the index the server chose", async () => {
    expect(await requestSceneGoal("es", choices, reply('{"choice":1}'))).toBe(choices[1]);
  });

  it("falls back (null) on errors, extra keys, bad indexes, oversize replies and network failure", async () => {
    for (const body of [
      '{"choice":2}',
      '{"choice":-1}',
      '{"choice":"1"}',
      '{"choice":0,"message":"hola"}',
      "[]",
      "nope",
      " ".repeat(300) + '{"choice":0}',
    ])
      expect(await requestSceneGoal("es", choices, reply(body))).toBeNull();
    expect(await requestSceneGoal("es", choices, reply('{"choice":0}', 500))).toBeNull();
    const down = (async () => Promise.reject(new Error("offline"))) as unknown as typeof fetch;
    expect(await requestSceneGoal("es", choices, down)).toBeNull();
    expect(await requestSceneGoal("es", [], reply('{"choice":0}'))).toBeNull();
  });

  it("sends only the locale and the closed choices", async () => {
    let sent = "";
    const spy = (async (_url: string, init: RequestInit) => {
      sent = String(init.body);
      return new Response('{"choice":0}');
    }) as unknown as typeof fetch;
    await requestSceneGoal("en", choices, spy);
    expect(JSON.parse(sent)).toEqual({ locale: "en", choices });
  });
});
