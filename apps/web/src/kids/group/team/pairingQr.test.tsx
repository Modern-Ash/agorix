import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { encodeBundle } from "@agorix/group-lockstep";
import { PairingQr, PairingScan } from "./PairingQr.js";
import {
  MAX_PAIRING_IMAGE_SIDE,
  isPairingBundle,
  pairingQrDataUrl,
  readPairingQr,
  type PairingPixels,
} from "./pairingQr.js";

const BUNDLE = encodeBundle({
  ufrag: "Zx9k",
  pwd: "Qm3vT8uYb2nL5cR7aHd0Wp",
  fingerprint: Buffer.from(Array<number>(32).fill(0)).toString("base64url"),
  candidates: [{ foundation: "1", priority: 1, address: "192.168.1.2", port: 5000, type: "host" }],
});

const PIXELS: PairingPixels = {
  data: new Uint8ClampedArray(4),
  width: 1,
  height: 1,
};

function image(name = "qr.png", type = "image/png"): File {
  return new File(["image"], name, { type });
}

async function code(work: () => Promise<unknown>): Promise<string> {
  try {
    await work();
  } catch (error) {
    return (error as { code?: string }).code ?? "UNKNOWN";
  }
  return "OK";
}

describe("pairing QR", () => {
  it("renders the signalling bundle as an inline SVG data URL", () => {
    const url = pairingQrDataUrl(BUNDLE);
    expect(url.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(decodeURIComponent(url.split(",", 2)[1] ?? "")).toContain("<svg");
    expect(() => pairingQrDataUrl("A".repeat(2_400))).not.toThrow();
  });

  it("accepts only complete signalling bundles", () => {
    expect(isPairingBundle(BUNDLE)).toBe(true);
    expect(isPairingBundle(` ${BUNDLE} `)).toBe(true);
    expect(isPairingBundle("not-a-bundle")).toBe(false);
    expect(isPairingBundle("A".repeat(2_401))).toBe(false);
  });

  it("rejects non-images, empty files and oversized dimensions", async () => {
    expect(await code(() => readPairingQr(image("qr.txt", "text/plain")))).toBe("INVALID_IMAGE");
    expect(
      await code(() =>
        readPairingQr(image(), {
          loadPixels: async () => ({
            data: new Uint8ClampedArray(4),
            width: MAX_PAIRING_IMAGE_SIDE + 1,
            height: 1,
          }),
        }),
      ),
    ).toBe("INVALID_IMAGE");
    expect(
      await code(() =>
        readPairingQr(image(), {
          loadPixels: async () => ({ ...PIXELS, width: 0 }),
        }),
      ),
    ).toBe("INVALID_IMAGE");
  });

  it("rejects a photo without a QR or with unrelated text", async () => {
    expect(
      await code(() =>
        readPairingQr(image(), { loadPixels: async () => PIXELS, decode: () => null }),
      ),
    ).toBe("NO_QR");
    expect(
      await code(() =>
        readPairingQr(image(), { loadPixels: async () => PIXELS, decode: () => "hello" }),
      ),
    ).toBe("INVALID_BUNDLE");
    expect(
      await code(() =>
        readPairingQr(image(), {
          loadPixels: async () => PIXELS,
          decode: () => "A".repeat(2_401),
        }),
      ),
    ).toBe("INVALID_BUNDLE");
  });

  it("accepts a photo whose browser reports no MIME type", async () => {
    await expect(
      readPairingQr(image("qr.png", ""), {
        loadPixels: async () => PIXELS,
        decode: () => BUNDLE,
      }),
    ).resolves.toBe(BUNDLE);
  });

  it("returns the trimmed bundle from a photo", async () => {
    await expect(
      readPairingQr(image(), { loadPixels: async () => PIXELS, decode: () => ` ${BUNDLE} ` }),
    ).resolves.toBe(BUNDLE);
  });

  it("never opens the camera or creates a CSP-blocked blob URL", () => {
    const source = readFileSync(new URL("./pairingQr.ts", import.meta.url), "utf8");
    expect(source).not.toContain("getUserMedia");
    expect(source).not.toContain("createObjectURL");
  });

  it("shows the QR and asks the operating system for a photo without opening the camera", () => {
    const qr = renderToStaticMarkup(<PairingQr value={BUNDLE} label="Invitation QR" />);
    expect(qr).toContain('src="data:image/svg+xml');
    expect(qr).toContain('alt="Invitation QR"');
    const scan = renderToStaticMarkup(
      <PairingScan
        label="Scan the invitation QR"
        hint="Take a photo of the QR or paste the text."
        errorText="No QR found."
        onValue={() => undefined}
      />,
    );
    expect(scan).toContain('type="file"');
    expect(scan).toContain('accept="image/*"');
    expect(scan).toContain('capture="environment"');
    expect(scan).not.toContain("getUserMedia");
  });
});
