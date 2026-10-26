/**
 * Access to the grown-ups area (issue #599).
 *
 * What this is: a PIN an adult chooses, kept on this device only as a salted PBKDF2 hash, with
 * waiting time after repeated wrong tries. It keeps a young child out of the settings and the
 * progress summary. What it is not: authentication. Someone with the unlocked device and browser
 * tools can clear it, so nothing that needs real trust (an account, linking a device, sharing) relies
 * on it; those use the adult's account sign-in. A forgotten PIN is reset by solving a fresh adult
 * calculation and choosing a new one, which keeps the device usable offline.
 */
export const ADULT_PIN_KEY = "agorix.kids.adultpin.v1";
export const PIN_MIN_DIGITS = 4;
export const PIN_MAX_DIGITS = 6;
const ITERATIONS = 100_000;
const FREE_TRIES = 5;
const BASE_LOCK_SECONDS = 30;
const MAX_LOCK_SECONDS = 15 * 60;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

interface Stored {
  readonly v: 1;
  readonly salt: string;
  readonly iterations: number;
  readonly hash: string;
  readonly failures: number;
  readonly lockedUntil: number;
}

function browserStore(): Store | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function toBase64(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("secure hashing is not available");
  const key = await subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return toBase64(new Uint8Array(bits));
}

function read(store: Store | undefined): Stored | null {
  try {
    const parsed = JSON.parse(store?.getItem(ADULT_PIN_KEY) ?? "null") as Partial<Stored> | null;
    if (
      parsed?.v === 1 &&
      typeof parsed.salt === "string" &&
      typeof parsed.hash === "string" &&
      Number.isInteger(parsed.iterations) &&
      Number.isInteger(parsed.failures) &&
      typeof parsed.lockedUntil === "number"
    )
      return parsed as Stored;
    return null;
  } catch {
    return null;
  }
}

function write(store: Store | undefined, value: Stored): void {
  try {
    store?.setItem(ADULT_PIN_KEY, JSON.stringify(value));
  } catch {
    // Without storage the PIN cannot be kept; the caller falls back to the calculation.
  }
}

/** True when the browser can hash a PIN and keep it. */
export function canKeepPin(store: Store | undefined = browserStore()): boolean {
  return Boolean(globalThis.crypto?.subtle) && store !== undefined;
}

export function hasPin(store: Store | undefined = browserStore()): boolean {
  return read(store) !== null;
}

/** A PIN of 4 to 6 digits that is not an obvious run or repeat. */
export function pinProblem(pin: string): "length" | "obvious" | null {
  if (!/^[0-9]+$/.test(pin) || pin.length < PIN_MIN_DIGITS || pin.length > PIN_MAX_DIGITS)
    return "length";
  if (/^(\d)\1+$/.test(pin)) return "obvious";
  const digits = [...pin].map(Number);
  const steps = digits.slice(1).map((digit, index) => digit - digits[index]!);
  if (steps.every((step) => step === 1) || steps.every((step) => step === -1)) return "obvious";
  return null;
}

export async function savePin(
  pin: string,
  store: Store | undefined = browserStore(),
  random: (bytes: number) => Uint8Array = (bytes) =>
    globalThis.crypto.getRandomValues(new Uint8Array(bytes)),
): Promise<void> {
  if (pinProblem(pin) !== null) throw new RangeError("invalid PIN");
  const salt = random(16);
  write(store, {
    v: 1,
    salt: toBase64(salt),
    iterations: ITERATIONS,
    hash: await derive(pin, salt, ITERATIONS),
    failures: 0,
    lockedUntil: 0,
  });
}

export type PinCheck =
  | { readonly status: "ok" }
  | { readonly status: "wrong"; readonly triesBeforeWait: number }
  | { readonly status: "locked"; readonly seconds: number };

/** How long to wait after this many wrong tries in a row. */
export function lockSeconds(failures: number): number {
  if (failures < FREE_TRIES) return 0;
  return Math.min(MAX_LOCK_SECONDS, BASE_LOCK_SECONDS * 2 ** (failures - FREE_TRIES));
}

export async function checkPin(
  pin: string,
  now: number,
  store: Store | undefined = browserStore(),
): Promise<PinCheck> {
  const saved = read(store);
  if (!saved) return { status: "wrong", triesBeforeWait: FREE_TRIES };
  if (saved.lockedUntil > now)
    return { status: "locked", seconds: Math.ceil((saved.lockedUntil - now) / 1000) };
  const match = (await derive(pin, fromBase64(saved.salt), saved.iterations)) === saved.hash;
  if (match) {
    write(store, { ...saved, failures: 0, lockedUntil: 0 });
    return { status: "ok" };
  }
  const failures = saved.failures + 1;
  const wait = lockSeconds(failures);
  write(store, { ...saved, failures, lockedUntil: wait > 0 ? now + wait * 1000 : 0 });
  return wait > 0
    ? { status: "locked", seconds: wait }
    : { status: "wrong", triesBeforeWait: FREE_TRIES - failures };
}

/** A fresh adult calculation, used to start a PIN and to reset a forgotten one. */
export function makeChallenge(random: () => number = Math.random): {
  readonly a: number;
  readonly b: number;
  readonly answer: string;
} {
  const a = 12 + Math.floor(random() * 8);
  const b = 6 + Math.floor(random() * 4);
  return { a, b, answer: String(a * b) };
}
