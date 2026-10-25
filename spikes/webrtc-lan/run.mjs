// THROWAWAY SPIKE for issue #568: headless pairing, bundle sizes and lockstep over WebRTC data
// channels between pages of one Chromium. It does NOT replace the real-device gate (tablets, iOS,
// school Wi-Fi); it only answers what a desktop browser can answer.
//
//   node spikes/webrtc-lan/run.mjs [--guests 3] [--ticks 300]
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const { chromium } = require("@playwright/test");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : fallback;
};
const GUESTS = arg("guests", 3);
const TICKS = arg("ticks", 300);
const html = readFileSync(fileURLToPath(new URL("./spike.html", import.meta.url)));
const server = createServer((_, res) => {
  res.writeHead(200, { "content-type": "text/html" });
  res.end(html);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/`;

const framesFor = (chars, chunk) => Math.ceil(chars / chunk);

async function scenario(name, launchArgs) {
  const browser = await chromium.launch({ args: launchArgs });
  const out = { name, launchArgs, guests: GUESTS };
  try {
    const host = await browser.newPage();
    await host.goto(url);
    const guests = [];
    const offers = [];
    const answers = [];
    const t0 = Date.now();
    for (let i = 1; i <= GUESTS; i += 1) {
      const page = await browser.newPage();
      await page.goto(url);
      guests.push(page);
      const offer = await host.evaluate((id) => window.spike.hostOffer(id), `g${i}`);
      offers.push(offer);
      const answer = await page.evaluate((b) => window.spike.guestJoin(b), offer.bundle);
      answers.push(answer);
      const accepted = await host.evaluate(
        ([id, b]) => window.spike.hostAccept(id, b),
        [`g${i}`, answer.bundle],
      );
      if (!accepted.open) throw new Error(`guest ${i} did not open (${JSON.stringify(accepted)})`);
      (out.connect ??= []).push(accepted.connectMs);
    }
    out.pairingTotalMs = Date.now() - t0;
    const o = offers[0];
    const a = answers[0];
    out.bundles = {
      offer: {
        fullSdpChars: o.fullSdpChars,
        fullGzipB64: o.fullSdpGzipB64,
        compactB64: o.compactChars,
        compactGzipB64: o.compactGzipB64,
        candidates: o.candidates,
        types: o.candidateTypes,
        mdns: o.mdns,
      },
      answer: {
        fullSdpChars: a.fullSdpChars,
        fullGzipB64: a.fullSdpGzipB64,
        compactB64: a.compactChars,
        compactGzipB64: a.compactGzipB64,
        candidates: a.candidates,
        types: a.candidateTypes,
        mdns: a.mdns,
      },
      qrFramesForOfferAt: Object.fromEntries(
        [300, 600, 1000, 2000].map((n) => [n, framesFor(o.compactChars, n)]),
      ),
      qrFramesForAnswerAt: Object.fromEntries(
        [300, 600, 1000, 2000].map((n) => [n, framesFor(a.compactChars, n)]),
      ),
    };

    out.lockstep = await host.evaluate(([t]) => window.spike.lockstep(t, 12345), [TICKS]);
    const digests = new Set([out.lockstep.hostDigest, ...Object.values(out.lockstep.guestDigests)]);
    out.lockstep.allDigestsEqual = digests.size === 1;

    // A guest vanishes mid-game (tab killed, no goodbye). The host must keep going with a safe
    // action, and we measure how long the browser itself takes to report the loss.
    const hostNowAtClose = await host.evaluate(() => window.spike.nowMs());
    await guests[GUESTS - 1].close();
    const during = await host.evaluate(() => window.spike.lockstep(60, 999, 150));
    let detectedAfterMs = null;
    for (let waited = 0; waited < 45000 && detectedAfterMs === null; waited += 500) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      detectedAfterMs = await host.evaluate(
        ([t, lost]) => {
          const hit = window.spike
            .events()
            .find(
              (e) =>
                e.id === lost &&
                e.at >= t &&
                ["disconnected", "failed", "closed", "channel-closed"].includes(e.state),
            );
          return hit ? Math.round(hit.at - t) : null;
        },
        [hostNowAtClose, "g" + GUESTS],
      );
    }
    out.guestLoss = {
      gameContinuedTicks: during.ticks,
      absentInputsCoveredByHost: during.absentInputs,
      browserReportedLossAfterMs: detectedAfterMs,
      remainingGuestsAgree: Object.entries(during.guestDigests)
        .filter(([id]) => id !== "g" + GUESTS)
        .every(([, d]) => d === during.hostDigest),
    };

    // Recovery is a fresh pairing, never an automatic resume (ADR 0010: no silent rejoin).
    const again = await browser.newPage();
    await again.goto(url);
    const offer2 = await host.evaluate(() => window.spike.hostOffer("g9"));
    const answer2 = await again.evaluate((b) => window.spike.guestJoin(b), offer2.bundle);
    out.rejoin = await host.evaluate(([b]) => window.spike.hostAccept("g9", b), [answer2.bundle]);
  } catch (error) {
    out.error = String(error?.message ?? error);
  } finally {
    await browser.close();
  }
  return out;
}

const results = [];
results.push(await scenario("chromium defaults (mDNS host candidates)", []));
results.push(
  await scenario("chromium with mDNS obfuscation off", [
    "--disable-features=WebRtcHideLocalIpsWithMdns",
  ]),
);
server.close();
console.log(JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
