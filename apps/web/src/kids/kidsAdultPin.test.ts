import { describe, expect, it } from "vitest";
import {
  ADULT_PIN_KEY,
  checkPin,
  hasPin,
  lockSeconds,
  makeChallenge,
  pinProblem,
  savePin,
} from "./kidsAdultPin.js";

// Issue #599: a local PIN with waiting time, kept only as a salted hash.
function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    data,
  };
}

describe("adult PIN", () => {
  it("accepts 4 to 6 digits and refuses short, long, non-numeric and obvious ones", () => {
    for (const ok of ["4829", "73190", "906152"]) expect(pinProblem(ok)).toBeNull();
    for (const bad of ["", "123", "1234567", "12a4", "12 4"])
      expect(pinProblem(bad)).toBe("length");
    for (const obvious of ["1111", "0000", "1234", "4321", "56789"])
      expect(pinProblem(obvious)).toBe("obvious");
  });

  it("keeps a salted hash and never the PIN itself", async () => {
    const store = memory();
    expect(hasPin(store)).toBe(false);
    await savePin("4829", store);
    expect(hasPin(store)).toBe(true);
    const raw = store.data.get(ADULT_PIN_KEY)!;
    expect(raw).not.toContain("4829");
    expect(JSON.parse(raw)).toMatchObject({ v: 1, iterations: 100000, failures: 0 });
    const other = memory();
    await savePin("4829", other);
    expect(other.data.get(ADULT_PIN_KEY)).not.toBe(raw);
  });

  it("opens with the right PIN and counts the wrong ones", async () => {
    const store = memory();
    await savePin("4829", store);
    const now = 1_000_000;
    expect(await checkPin("4829", now, store)).toEqual({ status: "ok" });
    expect(await checkPin("1357", now, store)).toEqual({ status: "wrong", triesBeforeWait: 4 });
    expect(await checkPin("4829", now, store)).toEqual({ status: "ok" });
    expect(await checkPin("1357", now, store)).toEqual({ status: "wrong", triesBeforeWait: 4 });
  });

  it("makes the child wait after five wrong tries, longer each time, even for the right PIN", async () => {
    const store = memory();
    await savePin("4829", store);
    let now = 5_000_000;
    for (let i = 0; i < 4; i += 1) await checkPin("0000", now, store);
    expect(await checkPin("0000", now, store)).toEqual({ status: "locked", seconds: 30 });
    expect(await checkPin("4829", now + 10_000, store)).toMatchObject({ status: "locked" });
    now += 31_000;
    expect(await checkPin("0000", now, store)).toEqual({ status: "locked", seconds: 60 });
    expect(lockSeconds(4)).toBe(0);
    expect(lockSeconds(5)).toBe(30);
    expect(lockSeconds(6)).toBe(60);
    expect(lockSeconds(50)).toBe(900);
    now += 61_000;
    expect(await checkPin("4829", now, store)).toEqual({ status: "ok" });
  });

  it("refuses to save an invalid PIN and treats a missing or damaged record as no PIN", async () => {
    const store = memory();
    await expect(savePin("12", store)).rejects.toThrow();
    store.setItem(ADULT_PIN_KEY, "{not json");
    expect(hasPin(store)).toBe(false);
    store.setItem(ADULT_PIN_KEY, JSON.stringify({ v: 2 }));
    expect(hasPin(store)).toBe(false);
  });

  it("makes a fresh calculation an adult can do but a young child cannot guess", () => {
    for (let i = 0; i < 50; i += 1) {
      const challenge = makeChallenge();
      expect(challenge.a * challenge.b).toBe(Number(challenge.answer));
      expect(challenge.answer.length).toBeLessThanOrEqual(3);
    }
    expect(makeChallenge(() => 0)).toMatchObject({ a: 12, b: 6, answer: "72" });
  });
});
