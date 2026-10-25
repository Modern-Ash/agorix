/**
 * Compact signalling bundle for a data-channel-only WebRTC connection (spike #568: 208 to 244
 * characters, one QR frame, against about 570 for the raw SDP).
 *
 * Only what the other side needs travels: ICE ufrag and pwd, the DTLS fingerprint and the
 * candidates. The receiver rebuilds the SDP from a fixed template out of validated fields, so a
 * hostile bundle can never inject a line, a codec, a media section or a script into the SDP.
 */

export interface BundleCandidate {
  readonly foundation: string;
  readonly priority: number;
  /** An IP address or an mDNS name such as `3f2a-....local`. */
  readonly address: string;
  readonly port: number;
  readonly type: "host" | "srflx" | "relay";
}

export interface SignalBundle {
  readonly ufrag: string;
  readonly pwd: string;
  /** SHA-256 DTLS fingerprint, 32 bytes as base64url. */
  readonly fingerprint: string;
  readonly candidates: readonly BundleCandidate[];
}

export type BundleErrorCode = "INVALID_SDP" | "INVALID_BUNDLE" | "TOO_LARGE";

export class BundleError extends Error {
  constructor(readonly code: BundleErrorCode) {
    super(code);
    this.name = "BundleError";
  }
}

export interface BundleLimits {
  /** Most candidates accepted. A phone with IPv4, IPv6 and a few interfaces stays well below. */
  readonly maxCandidates: number;
  /** Longest encoded bundle accepted, in characters. */
  readonly maxEncodedChars: number;
  /** Offline pairing allows only local candidates; relay and server-reflexive need the fallback. */
  readonly allowedTypes: readonly BundleCandidate["type"][];
}

export const DEFAULT_BUNDLE_LIMITS: BundleLimits = {
  maxCandidates: 12,
  maxEncodedChars: 2_400,
  allowedTypes: ["host"],
};

const UFRAG = /^[A-Za-z0-9+/]{4,256}$/;
const PWD = /^[A-Za-z0-9+/]{22,256}$/;
const FOUNDATION = /^[A-Za-z0-9+/]{1,32}$/;
const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /^[0-9a-fA-F:]{2,45}$/;
const MDNS = /^[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63})*\.local$/;

function validAddress(address: string): boolean {
  if (IPV4.test(address)) return address.split(".").every((part) => Number(part) <= 255);
  if (address.includes(":")) return IPV6.test(address) && address.split(":").length <= 8;
  return MDNS.test(address) && address.length <= 253;
}

const B64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const B64URL_VALUES: Readonly<Record<string, number>> = Object.fromEntries(
  [...B64URL].map((char, index) => [char, index]),
);

/** Portable base64url: no Buffer, atob or btoa, so this module loads in a browser unchanged. */
function b64u(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    out += B64URL[a >> 2];
    out += B64URL[((a & 0x03) << 4) | (b >> 4)];
    if (i + 1 < bytes.length) out += B64URL[((b & 0x0f) << 2) | (c >> 6)];
    if (i + 2 < bytes.length) out += B64URL[c & 0x3f];
  }
  return out;
}

function fromB64u(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) {
    throw new BundleError("INVALID_BUNDLE");
  }
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i += 4) {
    const a = B64URL_VALUES[text[i] ?? ""] ?? -1;
    const b = B64URL_VALUES[text[i + 1] ?? ""] ?? -1;
    const c = B64URL_VALUES[text[i + 2] ?? ""] ?? -1;
    const d = B64URL_VALUES[text[i + 3] ?? ""] ?? -1;
    if (a < 0 || b < 0 || (i + 2 < text.length && c < 0) || (i + 3 < text.length && d < 0)) {
      throw new BundleError("INVALID_BUNDLE");
    }
    bytes.push((a << 2) | (b >> 4));
    if (i + 2 < text.length) bytes.push(((b & 0x0f) << 4) | (c >> 2));
    if (i + 3 < text.length) bytes.push(((c & 0x03) << 6) | d);
  }
  return Uint8Array.from(bytes);
}

function validate(bundle: unknown, limits: BundleLimits): SignalBundle {
  if (typeof bundle !== "object" || bundle === null || Array.isArray(bundle)) {
    throw new BundleError("INVALID_BUNDLE");
  }
  const b = bundle as Record<string, unknown>;
  if (Object.keys(b).sort().join() !== "candidates,fingerprint,pwd,ufrag") {
    throw new BundleError("INVALID_BUNDLE");
  }
  const { ufrag, pwd, fingerprint, candidates } = b;
  if (
    typeof ufrag !== "string" ||
    !UFRAG.test(ufrag) ||
    typeof pwd !== "string" ||
    !PWD.test(pwd) ||
    typeof fingerprint !== "string" ||
    fromB64u(fingerprint).length !== 32 ||
    !Array.isArray(candidates) ||
    candidates.length === 0 ||
    candidates.length > limits.maxCandidates
  ) {
    throw new BundleError("INVALID_BUNDLE");
  }
  const out: BundleCandidate[] = candidates.map((raw: unknown) => {
    const c = raw as Record<string, unknown>;
    if (
      typeof c !== "object" ||
      c === null ||
      Object.keys(c).sort().join() !== "address,foundation,port,priority,type" ||
      typeof c["foundation"] !== "string" ||
      !FOUNDATION.test(c["foundation"]) ||
      typeof c["address"] !== "string" ||
      !validAddress(c["address"]) ||
      !Number.isInteger(c["port"]) ||
      (c["port"] as number) < 1 ||
      (c["port"] as number) > 65_535 ||
      !Number.isInteger(c["priority"]) ||
      (c["priority"] as number) < 0 ||
      (c["priority"] as number) > 0xffff_ffff ||
      !limits.allowedTypes.includes(c["type"] as BundleCandidate["type"])
    ) {
      throw new BundleError("INVALID_BUNDLE");
    }
    return {
      foundation: c["foundation"],
      priority: c["priority"] as number,
      address: c["address"],
      port: c["port"] as number,
      type: c["type"] as BundleCandidate["type"],
    };
  });
  return { ufrag, pwd, fingerprint, candidates: out };
}

/** Extract the compact bundle from a local description produced by `RTCPeerConnection`. */
export function compactSdp(
  sdp: string,
  limits: BundleLimits = DEFAULT_BUNDLE_LIMITS,
): SignalBundle {
  const get = (re: RegExp) => re.exec(sdp)?.[1];
  const ufrag = get(/^a=ice-ufrag:(\S+)/m);
  const pwd = get(/^a=ice-pwd:(\S+)/m);
  const fp = get(/^a=fingerprint:sha-256 ([0-9A-Fa-f:]+)/m);
  if (ufrag === undefined || pwd === undefined || fp === undefined) {
    throw new BundleError("INVALID_SDP");
  }
  const fingerprintBytes = fp.split(":").map((hex) => Number.parseInt(hex, 16));
  if (fingerprintBytes.length !== 32 || fingerprintBytes.some((n) => !Number.isInteger(n))) {
    throw new BundleError("INVALID_SDP");
  }
  const candidates = [
    ...sdp.matchAll(/^a=candidate:(\S+) 1 udp (\d+) (\S+) (\d+) typ (\w+)/gm),
  ].map((m) => ({
    foundation: m[1] as string,
    priority: Number(m[2]),
    address: m[3] as string,
    port: Number(m[4]),
    type: m[5] as BundleCandidate["type"],
  }));
  // Candidates the offline mode does not allow (TCP, relay, server-reflexive) are simply left out.
  const allowed = candidates.filter((c) => limits.allowedTypes.includes(c.type));
  return validate(
    { ufrag, pwd, fingerprint: b64u(Uint8Array.from(fingerprintBytes)), candidates: allowed },
    limits,
  );
}

/** The string that goes into a QR code, or is pasted as the supervised fallback. */
export function encodeBundle(
  bundle: SignalBundle,
  limits: BundleLimits = DEFAULT_BUNDLE_LIMITS,
): string {
  const checked = validate(bundle, limits);
  const encoded = b64u(new TextEncoder().encode(JSON.stringify(checked)));
  if (encoded.length > limits.maxEncodedChars) throw new BundleError("TOO_LARGE");
  return encoded;
}

export function decodeBundle(
  encoded: string,
  limits: BundleLimits = DEFAULT_BUNDLE_LIMITS,
): SignalBundle {
  if (encoded.length > limits.maxEncodedChars) throw new BundleError("TOO_LARGE");
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(fromB64u(encoded)));
  } catch (error) {
    throw error instanceof BundleError ? error : new BundleError("INVALID_BUNDLE");
  }
  return validate(parsed, limits);
}

/** `actpass` for the offer, `active` for the answer. */
export function expandSdp(bundle: SignalBundle, setup: "actpass" | "active"): string {
  const checked = validate(bundle, {
    ...DEFAULT_BUNDLE_LIMITS,
    allowedTypes: ["host", "srflx", "relay"],
  });
  const fingerprint = [...fromB64u(checked.fingerprint)]
    .map((byte) => byte.toString(16).toUpperCase().padStart(2, "0"))
    .join(":");
  return [
    "v=0",
    "o=- 4611731400430051336 2 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "a=group:BUNDLE 0",
    "a=msid-semantic: WMS",
    "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
    "c=IN IP4 0.0.0.0",
    `a=ice-ufrag:${checked.ufrag}`,
    `a=ice-pwd:${checked.pwd}`,
    `a=fingerprint:sha-256 ${fingerprint}`,
    `a=setup:${setup}`,
    "a=mid:0",
    "a=sctp-port:5000",
    "a=max-message-size:262144",
    ...checked.candidates.map(
      (c) => `a=candidate:${c.foundation} 1 udp ${c.priority} ${c.address} ${c.port} typ ${c.type}`,
    ),
    "",
  ].join("\r\n");
}

/** How many QR frames a bundle needs at a given per-frame size. */
export function qrFrames(encoded: string, charsPerFrame: number): number {
  return Math.max(1, Math.ceil(encoded.length / charsPerFrame));
}
