import { isCustomRefId, type KidsAvatarRef } from "./kidsProjects.js";

export const KIDS_AUDIO_DB = "agorix.kids.audio.v1";
const STORE = "actorAudio";
const MAX_BYTES = 500 * 1024;
const MAX_SECONDS = 5;
type AudioType = "audio/mpeg" | "audio/wav" | "audio/ogg";
export type KidsAudioErrorCode =
  "unsupportedType" | "tooLarge" | "tooLong" | "decodeFailed" | "storageUnavailable";

export class KidsAudioError extends Error {
  constructor(readonly code: KidsAudioErrorCode) {
    super(code);
    this.name = "KidsAudioError";
  }
}

function signature(bytes: Uint8Array): AudioType | null {
  const text = (at: number, length: number) =>
    String.fromCharCode(...bytes.subarray(at, at + length));
  if (bytes.length >= 12 && text(0, 4) === "RIFF" && text(8, 4) === "WAVE") return "audio/wav";
  if (bytes.length >= 4 && text(0, 4) === "OggS") return "audio/ogg";
  if (bytes.length >= 3 && text(0, 3) === "ID3") return "audio/mpeg";
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0) return "audio/mpeg";
  return null;
}

async function browserDuration(blob: Blob): Promise<number> {
  const context = new AudioContext();
  try {
    return (await context.decodeAudioData(await blob.arrayBuffer())).duration;
  } finally {
    await context.close().catch(() => undefined);
  }
}

/** Validate before IndexedDB. A new Blob drops the uploaded filename and File metadata. */
export async function processKidsAudio(
  input: Blob,
  durationOf: (blob: Blob) => Promise<number> = browserDuration,
): Promise<Blob> {
  if (input.size > MAX_BYTES) throw new KidsAudioError("tooLarge");
  if (!["audio/mpeg", "audio/wav", "audio/ogg"].includes(input.type))
    throw new KidsAudioError("unsupportedType");
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await input.arrayBuffer());
  } catch {
    throw new KidsAudioError("decodeFailed");
  }
  if (signature(bytes) !== input.type) throw new KidsAudioError("unsupportedType");
  const clean = new Blob([Uint8Array.from(bytes)], { type: input.type });
  let duration: number;
  try {
    duration = await durationOf(clean);
  } catch {
    throw new KidsAudioError("decodeFailed");
  }
  if (!Number.isFinite(duration) || duration <= 0) throw new KidsAudioError("decodeFailed");
  if (duration > MAX_SECONDS) throw new KidsAudioError("tooLong");
  return clean;
}

export function actorAudioKey(actor: KidsAvatarRef): string {
  if (actor.kind === "emoji") return `emoji:${actor.value}`;
  if (actor.kind === "gallery") return `gallery:${actor.id}`;
  if (!isCustomRefId(actor.id)) throw new RangeError("invalid custom explorer id");
  return `custom:${actor.id}`;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new KidsAudioError("storageUnavailable"));
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(KIDS_AUDIO_DB, 1);
    } catch {
      return reject(new KidsAudioError("storageUnavailable"));
    }
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new KidsAudioError("storageUnavailable"));
    request.onblocked = () => reject(new KidsAudioError("storageUnavailable"));
  });
}

async function operate<T>(
  mode: IDBTransactionMode,
  actor: KidsAvatarRef,
  action: (store: IDBObjectStore, done: (value: T) => void) => void,
): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      db.close();
      reject(new KidsAudioError("storageUnavailable"));
    };
    try {
      const transaction = db.transaction(STORE, mode);
      transaction.onerror = fail;
      transaction.onabort = fail;
      action(transaction.objectStore(STORE), (value) => {
        transaction.oncomplete = () => {
          if (settled) return;
          settled = true;
          db.close();
          resolve(value);
        };
      });
    } catch {
      fail();
    }
  });
}

export async function saveKidsAudio(actor: KidsAvatarRef, blob: Blob): Promise<void> {
  const clean = await processKidsAudio(blob);
  return operate("readwrite", actor, (store, done) => {
    store.put(clean, actorAudioKey(actor));
    done(undefined);
  });
}

export function loadKidsAudio(actor: KidsAvatarRef): Promise<Blob | undefined> {
  return operate("readonly", actor, (store, done) => {
    const request = store.get(actorAudioKey(actor));
    request.onsuccess = () => done(request.result instanceof Blob ? request.result : undefined);
  });
}

export function removeKidsAudio(actor: KidsAvatarRef): Promise<void> {
  return operate("readwrite", actor, (store, done) => {
    store.delete(actorAudioKey(actor));
    done(undefined);
  });
}
