import { describe, expect, it } from "vitest";
import { defaultKidsCatalog } from "@agorix/curriculum";
import { loadKidsCatalog } from "./kidsCatalog.js";

const reply = (body: unknown, ok = true) =>
  (async () => ({ ok, text: async () => JSON.stringify(body) })) as unknown as typeof fetch;

describe("published missions on the device (issue #616)", () => {
  it("uses a valid published catalog", async () => {
    const catalog = structuredClone(defaultKidsCatalog()) as unknown as {
      ocean: { title: { es: string; en: string } }[];
    };
    catalog.ocean[0]!.title = { es: "Corriente corta", en: "Short current" };
    const loaded = await loadKidsCatalog(reply({ catalog }));
    expect(loaded?.ocean[0].title.es).toBe("Corriente corta");
  });

  it("keeps the built-in missions (undefined) for anything wrong, so the app never waits on it", async () => {
    const broken = structuredClone(defaultKidsCatalog()) as unknown as {
      city: { goal: { cx: number } }[];
    };
    broken.city[0]!.goal.cx = 9;
    for (const fetchImpl of [
      reply({ catalog: broken }),
      reply({ catalog: {} }),
      reply({}),
      reply({ catalog: defaultKidsCatalog() }, false),
      (async () => ({ ok: true, text: async () => "x".repeat(40_000) })) as unknown as typeof fetch,
      (async () => ({ ok: true, text: async () => "not json" })) as unknown as typeof fetch,
      (async () => {
        throw new Error("offline");
      }) as unknown as typeof fetch,
    ]) {
      expect(await loadKidsCatalog(fetchImpl)).toBeUndefined();
    }
  });
});
