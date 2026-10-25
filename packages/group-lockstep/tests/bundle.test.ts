import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BundleError,
  compactSdp,
  decodeBundle,
  encodeBundle,
  expandSdp,
  qrFrames,
} from "../src/index.js";

// A local description as Chromium produces it for a data-channel-only offer (mDNS host candidate).
const FP =
  "00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF";
const SDP = [
  "v=0",
  "o=- 8271391040234 2 IN IP4 127.0.0.1",
  "s=-",
  "t=0 0",
  "a=group:BUNDLE 0",
  "a=extmap-allow-mixed",
  "a=msid-semantic: WMS",
  "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
  "c=IN IP4 0.0.0.0",
  "a=candidate:2999745851 1 udp 2113937151 3f2a9c1e-77b0-4c1c-9d77-5a8e2c0b4f11.local 54321 typ host generation 0 network-cost 999",
  "a=candidate:842163049 1 udp 1677729535 203.0.113.9 54321 typ srflx raddr 0.0.0.0 rport 0 generation 0",
  "a=candidate:1 1 tcp 1518280447 192.168.1.20 9 typ host tcptype active generation 0",
  "a=ice-ufrag:Zx9k",
  "a=ice-pwd:Qm3vT8uYb2nL5cR7aHd0Wp",
  "a=ice-options:trickle",
  `a=fingerprint:sha-256 ${FP}`,
  "a=setup:actpass",
  "a=mid:0",
  "a=sctp-port:5000",
  "a=max-message-size:262144",
  "",
].join("\r\n");

function code(work: () => unknown): string {
  try {
    work();
  } catch (error) {
    if (error instanceof BundleError) return error.code;
    throw error;
  }
  return "OK";
}

describe("signalling bundle", () => {
  it("loads in a browser without Buffer, atob or btoa", () => {
    const source = readFileSync(new URL("../src/bundle.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/\bBuffer\s*[.(]/);
    expect(source).not.toMatch(/\b(?:atob|btoa)\s*\(/);
  });

  it("keeps only what offline pairing needs and fits one small QR", () => {
    const bundle = compactSdp(SDP);
    expect(bundle.ufrag).toBe("Zx9k");
    expect(bundle.candidates).toEqual([
      {
        foundation: "2999745851",
        priority: 2113937151,
        address: "3f2a9c1e-77b0-4c1c-9d77-5a8e2c0b4f11.local",
        port: 54321,
        type: "host",
      },
    ]);
    const encoded = encodeBundle(bundle);
    expect(encoded.length).toBeLessThan(400);
    expect(qrFrames(encoded, 600)).toBe(1);
    expect(SDP.length).toBeGreaterThan(encoded.length);
  });

  it("round-trips through the wire form and rebuilds an SDP with the same essentials", () => {
    const decoded = decodeBundle(encodeBundle(compactSdp(SDP)));
    const rebuilt = expandSdp(decoded, "active");
    expect(rebuilt).toContain("a=ice-ufrag:Zx9k");
    expect(rebuilt).toContain(`a=fingerprint:sha-256 ${FP}`);
    expect(rebuilt).toContain("a=setup:active");
    expect(rebuilt).toContain("typ host");
    expect(rebuilt).not.toContain("srflx");
    expect(rebuilt.split("\r\n").filter((l) => l.startsWith("m="))).toEqual([
      "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
    ]);
    // Idempotent: compacting the rebuilt SDP gives the same bundle.
    expect(compactSdp(rebuilt)).toEqual(decoded);
  });

  it("allows relay and server-reflexive candidates only when the fallback permits them", () => {
    const limits = {
      maxCandidates: 12,
      maxEncodedChars: 2400,
      allowedTypes: ["host", "srflx"],
    } as const;
    expect(compactSdp(SDP, limits).candidates.map((c) => c.type)).toEqual(["host", "srflx"]);
  });

  it("rejects an SDP without the three essentials", () => {
    expect(code(() => compactSdp("v=0\r\n"))).toBe("INVALID_SDP");
    expect(code(() => compactSdp(SDP.replace(/a=fingerprint.*\r\n/, "")))).toBe("INVALID_SDP");
    expect(code(() => compactSdp(SDP.replace(FP, "00:11")))).toBe("INVALID_SDP");
  });

  it("rejects hostile bundles before they can reach an SDP", () => {
    const good = decodeBundle(encodeBundle(compactSdp(SDP)));
    const mk = (patch: Record<string, unknown>) => {
      const bundle = { ...good, ...patch };
      return Buffer.from(JSON.stringify(bundle)).toString("base64url");
    };
    const c = good.candidates[0]!;
    const cases: [string, string][] = [
      ["newline in ufrag", mk({ ufrag: "ab\r\nm=video 9 RTP/AVP 0" })],
      ["short pwd", mk({ pwd: "short" })],
      ["bad fingerprint length", mk({ fingerprint: "AAAA" })],
      ["no candidates", mk({ candidates: [] })],
      ["too many candidates", mk({ candidates: Array(13).fill(c) })],
      ["port 0", mk({ candidates: [{ ...c, port: 0 }] })],
      ["port 70000", mk({ candidates: [{ ...c, port: 70000 }] })],
      ["address with space", mk({ candidates: [{ ...c, address: "1.2.3.4 typ host" }] })],
      ["ipv4 out of range", mk({ candidates: [{ ...c, address: "999.1.1.1" }] })],
      ["non-local hostname", mk({ candidates: [{ ...c, address: "evil.example.com" }] })],
      ["relay in offline mode", mk({ candidates: [{ ...c, type: "relay" }] })],
      ["extra field", mk({ extra: 1 })],
      ["extra candidate field", mk({ candidates: [{ ...c, ip: "1.1.1.1" }] })],
      ["priority negative", mk({ candidates: [{ ...c, priority: -1 }] })],
      ["not base64url", "!!!not base64!!!"],
      ["not json", Buffer.from("{nope").toString("base64url")],
      ["json array", Buffer.from("[]").toString("base64url")],
    ];
    for (const [name, encoded] of cases) {
      const actual = code(() => decodeBundle(encoded));
      expect(actual, name).toBe(name === "too many candidates" ? "TOO_LARGE" : "INVALID_BUNDLE");
    }
    expect(code(() => decodeBundle("A".repeat(2401)))).toBe("TOO_LARGE");
  });

  it("accepts ipv4, ipv6 and mDNS candidates together", () => {
    const base = compactSdp(SDP);
    const bundle = {
      ...base,
      candidates: [
        ...base.candidates,
        {
          foundation: "2",
          priority: 1,
          address: "192.168.1.20",
          port: 4000,
          type: "host" as const,
        },
        {
          foundation: "3",
          priority: 1,
          address: "fe80::1ff:fe23:4567:890a",
          port: 4000,
          type: "host" as const,
        },
      ],
    };
    expect(decodeBundle(encodeBundle(bundle)).candidates).toHaveLength(3);
  });
});
