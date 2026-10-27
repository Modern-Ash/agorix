import { expect, test, type Page } from "@playwright/test";

import { BLOCKS_UNLOCKED } from "./helpers.js";

test.use({ serviceWorkers: "block" });

const blockKinds = ["move", "turnL", "turnR", "repeat", "sound"] as const;

async function openEditor(page: Page, puzzleShape: boolean) {
  await page.goto("/kids");
  await page.evaluate((enabled) => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem("agorix.kids.flags.v1", JSON.stringify(enabled ? ["puzzleShape"] : []));
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
  }, puzzleShape);
  await page.evaluate(
    (state) => localStorage.setItem("agorix.kids.mastery.v1", state),
    BLOCKS_UNLOCKED,
  );
  await page.reload();
  await page.getByRole("button", { name: "Misión 1" }).click();
  for (const kind of blockKinds) {
    await page.locator(`.kids-palette-block.kids-block-${kind}`).click();
  }
}

for (const palette of ["default", "scratch"] as const) {
  test(`block connectors in the ${palette} palette`, async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await openEditor(page, palette === "scratch");
    const root = page.locator(".kids-root");
    await expect(root).toHaveAttribute("data-block-palette", palette);
    for (const kind of blockKinds) {
      const block = page.locator(`.kids-program-block.kids-block-${kind}`).first();
      const shape = await block.evaluate((node) => ({
        notch: getComputedStyle(node, "::before").content,
        tab: getComputedStyle(node, "::after").content,
      }));
      expect(shape).toEqual(
        palette === "scratch" ? { notch: '""', tab: '""' } : { notch: "none", tab: "none" },
      );
      await expect(block).toHaveScreenshot(`${palette}-${kind}.png`, {
        animations: "disabled",
        // Linux hosts rasterize bundled fonts differently; shape presence is asserted above.
        maxDiffPixelRatio: 0.04,
      });
    }
    const repeatBody = page.locator(".kids-program-block.kids-block-repeat > .kids-repeat-body");
    await expect(repeatBody).toHaveCSS(
      "background-color",
      palette === "scratch" ? "rgb(248, 247, 242)" : "rgba(0, 0, 0, 0)",
    );
  });
}

test("puzzle visuals leave tap and drag/drop behavior intact", async ({ page }) => {
  await openEditor(page, true);
  const blocks = page.locator(".kids-program-stack > ul > .kids-program-block");
  await expect(blocks).toHaveCount(5);
  await page.locator(".kids-palette-block.kids-block-move").click();
  await expect(blocks).toHaveCount(6);
  await page.evaluate(() => {
    const source = document.querySelector<HTMLElement>(".kids-palette-block.kids-block-turnL");
    const target = document.querySelector<HTMLElement>(".kids-drop-zone");
    if (!source || !target) throw new Error("Missing drag source or target");
    const dataTransfer = new DataTransfer();
    source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer }));
    target.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer }));
    target.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer }));
  });
  await expect(blocks).toHaveCount(7);
  await expect(blocks.last()).toHaveClass(/kids-block-turnL/);
});

test("forced colors keeps outlined blocks and reduced motion has no animation", async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await openEditor(page, true);
  const block = page.locator(".kids-program-block.kids-block-move").first();
  const styles = await block.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      border: style.borderTopWidth,
      notch: getComputedStyle(node, "::before").content,
      tab: getComputedStyle(node, "::after").content,
      animation: style.animationName,
      transition: style.transitionDuration,
    };
  });
  expect(styles).toEqual({
    border: "2px",
    notch: "none",
    tab: "none",
    animation: "none",
    transition: "0s",
  });
});
