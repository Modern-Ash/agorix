import { readFile, mkdir } from "node:fs/promises";
import { Buffer } from "node:buffer";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { chromium } from "@playwright/test";

const webRoot = fileURLToPath(new URL("../", import.meta.url));
const publicRoot = join(webRoot, "public");
const iconSvg = await readFile(join(publicRoot, "icons/agorix-mark.v2.svg"), "utf8");
const iconData = `data:image/svg+xml;base64,${Buffer.from(iconSvg).toString("base64")}`;
const titleFont = await readFile(
  join(webRoot, "node_modules/@fontsource/epilogue/files/epilogue-latin-700-normal.woff2"),
);
const bodyFont = await readFile(
  join(
    webRoot,
    "node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2",
  ),
);

const browser = await chromium.launch();
try {
  await mkdir(join(publicRoot, "icons"), { recursive: true });
  await mkdir(join(publicRoot, "brand"), { recursive: true });

  for (const size of [180, 192, 512]) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    await page.setContent(
      `<style>body{margin:0}</style><img src="${iconData}" width="${size}" height="${size}" alt="">`,
    );
    await page.locator("img").evaluate((image) => image.decode());
    await page.screenshot({ path: join(publicRoot, `icons/agorix-mark-${size}.png`) });
    await page.close();
  }

  const maskable = await browser.newPage({
    viewport: { width: 512, height: 512 },
    deviceScaleFactor: 1,
  });
  await maskable.setContent(
    `<style>body{margin:0;width:512px;height:512px;background:#F8FAFC;display:grid;place-items:center}</style><img src="${iconData}" width="435" height="435" alt="">`,
  );
  await maskable.locator("img").evaluate((image) => image.decode());
  await maskable.screenshot({ path: join(publicRoot, "icons/agorix-mark-maskable-512.png") });
  await maskable.close();

  const share = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await share.setContent(`
    <style>
      @font-face{font-family:Epilogue;src:url(data:font/woff2;base64,${titleFont.toString("base64")})}
      @font-face{font-family:Atkinson;src:url(data:font/woff2;base64,${bodyFont.toString("base64")})}
      *{box-sizing:border-box}
      body{margin:0;width:1200px;height:630px;overflow:hidden;background:#081A3A;color:#fff;font-family:Atkinson,sans-serif}
      main{position:relative;width:100%;height:100%;padding:66px 76px;display:flex;align-items:center}
      .glow{position:absolute;right:-170px;top:-280px;width:740px;height:740px;border-radius:50%;background:radial-gradient(circle,#4556A7 0%,#28356C 42%,transparent 72%)}
      .copy{position:relative;z-index:1;width:710px}
      .label{display:inline-block;padding:10px 18px;border:2px solid #8B5CF6;border-radius:999px;color:#D8C8FF;font-size:22px;letter-spacing:3px;text-transform:uppercase}
      h1{font:700 69px/1.13 Epilogue,sans-serif;letter-spacing:-3px;margin:36px 0 25px;max-width:700px}
      p{font-size:31px;line-height:1.26;margin:0;color:#D8E7FF;max-width:650px}
      .footer{position:absolute;left:76px;bottom:64px;font-size:23px;color:#B8C7DD}
      .tile{position:absolute;right:91px;top:146px;width:325px;height:325px;border-radius:76px;transform:rotate(9deg);background:#F8FAFC;box-shadow:0 30px 80px #020B247A,0 0 0 15px #FFFFFF1A;display:grid;place-items:center}
      .tile img{width:325px;height:325px}
      .accent{position:absolute;right:76px;bottom:64px;width:65px;height:65px;border-radius:21px;background:#22D3EE;transform:rotate(15deg)}
      .dot{position:absolute;right:458px;top:98px;width:24px;height:24px;border-radius:50%;background:#8B5CF6}
    </style>
    <main><div class="glow"></div><div class="dot"></div><div class="copy">
      <div class="label">Agorix Kids</div>
      <h1>Programá creando.</h1>
      <p>Bloques, código visible y mundos para explorar.</p>
    </div><div class="tile"><img src="${iconData}" alt=""></div>
    <div class="footer">La IA propone. Vos decidís.</div><div class="accent"></div></main>
  `);
  await share.evaluate("document.fonts.ready");
  await share.locator(".tile img").evaluate((image) => image.decode());
  await share.screenshot({ path: join(publicRoot, "brand/agorix-share-1200x630.png") });
  await share.close();
} finally {
  await browser.close();
}
