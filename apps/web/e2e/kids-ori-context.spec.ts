import { expect, test } from "./fixtures.js";

test("Ori follows what is under the cursor, locally and without names (#1209)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/kids");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
  });
  const outgoing: string[] = [];
  page.on("request", (request) => outgoing.push(request.postData() ?? ""));
  await page.reload();
  await page.getByRole("button", { name: "Misión 1" }).click();
  await page.getByRole("tab", { name: /Código/ }).click();
  await page
    .getByRole("navigation", { name: "Categorías de bloques" })
    .getByRole("button", { name: "Movimiento" })
    .click();
  await page.getByRole("button", { name: "★ Mover" }).click();

  const ori = page.getByRole("button", { name: "Abrir Ori" });

  // Over a block: its panel and its family, never its text.
  await page.locator(".kids-program-block").first().hover();
  await expect(ori).toHaveAttribute(
    "data-ori-context",
    "Estás mirando el panel Programa, un bloque de Movimiento.",
  );

  // Moving on to Ori keeps what was being looked at, so a click on Ori can use it.
  await ori.hover();
  await expect(ori).toHaveAttribute("data-ori-context", /un bloque de Movimiento/);

  // Over the stage: the stage panel.
  await page.locator(".kids-studio-stage").hover();
  await expect(ori).toHaveAttribute("data-ori-context", /el panel Escenario/);

  // Over nothing annotated: the screen.
  await page.mouse.move(2, 2);
  await expect(ori).toHaveAttribute("data-ori-context", /^Estás (en|mirando)/);

  // Nothing about the context travels anywhere by itself.
  expect(outgoing.join("|")).not.toContain("Estás mirando");
});
