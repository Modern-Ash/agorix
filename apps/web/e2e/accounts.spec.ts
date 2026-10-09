import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Issue #190. These journeys run against the DEV/E2E-only in-process backend that
 * playwright.config.ts mounts (AGORIX_DEV_BACKEND=1). They prove the Web UX, not a production server.
 */
const PASSWORD = "correct horse battery";

// Playwright cannot intercept requests that pass through a service worker; routing is used below.
test.use({ serviceWorkers: "block" });
const PROJECT_KEY = "agorix:default-project";

let counter = 0;
function alias(prefix = "kid"): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}-${Math.floor(Math.random() * 1e4)}`;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    localStorage.clear();
    for (const registration of await navigator.serviceWorker.getRegistrations()) {
      await registration.unregister();
    }
    for (const key of await caches.keys()) {
      await caches.delete(key);
    }
  });
  await page.reload();
});

const moveBlocks = (page: Page) => page.getByLabel(/^(Move|Mover) block|^Bloque Mover$/);

async function addMove(page: Page) {
  await page
    .locator(".action-palette")
    .getByLabel(/^(Move|Mover)$/)
    .click();
}

async function openAppMenu(page: Page) {
  const menuButton = page.getByRole("button", { name: "Show app menu" });
  if (await menuButton.isVisible().catch(() => false)) {
    await menuButton.click();
  }
}

function authDialog(page: Page): Locator {
  return page.getByTestId("auth-dialog");
}

async function register(page: Page, name: string) {
  await openAppMenu(page);
  await page.getByRole("button", { name: "Create account" }).click();
  const dialog = authDialog(page);
  await dialog.getByLabel("Username").fill(name);
  await dialog.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await dialog.getByRole("button", { name: "Create account" }).click();
}

async function signIn(page: Page, name: string, password = PASSWORD) {
  await openAppMenu(page);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const dialog = authDialog(page);
  await dialog.getByLabel("Username").fill(name);
  await dialog.getByLabel("Password", { exact: true }).fill(password);
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
}

const projectsDialog = (page: Page) => page.getByTestId("projects-dialog");
const saveState = (page: Page) => page.getByTestId("save-state");

async function closeProjects(page: Page) {
  await expect(projectsDialog(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(projectsDialog(page)).toHaveCount(0);
}

async function newProject(page: Page) {
  await projectsDialog(page)
    .getByRole("button", { name: /^(New project|Nuevo proyecto)$/ })
    .click();
  await expect.poll(async () => saveState(page).getAttribute("data-save-state")).toBe("saved");
  if (
    await projectsDialog(page)
      .isVisible()
      .catch(() => false)
  ) {
    await page.keyboard.press("Escape");
  }
  await expect(projectsDialog(page)).toHaveCount(0);
}

async function openMyProjects(page: Page) {
  await openAppMenu(page);
  await page.getByRole("button", { name: "My projects" }).click();
  await expect(projectsDialog(page)).toBeVisible();
}

async function keepLocalIfOffered(page: Page) {
  const offer = page.getByTestId("import-dialog");
  if (await offer.isVisible().catch(() => false)) {
    await offer.getByRole("button", { name: "Keep only on this device" }).click();
  }
}

test("anonymous use works unchanged and account entry points are optional", async ({ page }) => {
  await openAppMenu(page);
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await addMove(page);
  await expect(moveBlocks(page)).toHaveCount(1);
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), PROJECT_KEY))
    .not.toBeNull();
  await page.reload();
  await expect(moveBlocks(page)).toHaveCount(1);
  await expect(authDialog(page)).toHaveCount(0);
  await expect(page.getByTestId("save-state")).toHaveCount(0);
});

test("create account, land in My projects, sign out and sign in again", async ({ page }) => {
  const name = alias();
  await register(page, name);
  await expect(projectsDialog(page)).toBeVisible();
  await expect(page.getByTestId("projects-empty")).toBeVisible();
  await expect(page.getByTestId("account-alias")).toContainText(name);
  await closeProjects(page);

  await openAppMenu(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await openAppMenu(page);
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByTestId("account-alias")).toHaveCount(0);

  await signIn(page, name);
  await expect(projectsDialog(page)).toBeVisible();
});

test("sign-in errors are generic and the password toggle is accessible", async ({ page }) => {
  const name = alias();
  await register(page, name);
  await closeProjects(page);
  await openAppMenu(page);
  await page.getByRole("button", { name: "Sign out" }).click();

  await openAppMenu(page);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const dialog = authDialog(page);
  const password = dialog.getByLabel("Password", { exact: true });
  await expect(dialog.getByLabel("Username")).toHaveAttribute("autocomplete", "username");
  await expect(password).toHaveAttribute("autocomplete", "current-password");
  await expect(password).toHaveAttribute("type", "password");
  const toggle = dialog.getByRole("button", { name: "Show password" });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await password.fill("a wrong password");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(password).toHaveAttribute("type", "text");

  await dialog.getByLabel("Username").fill(name);
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(dialog.getByTestId("auth-error")).toHaveText("Invalid username or password.");
  await dialog.getByLabel("Username").fill("nobody-" + name);
  await password.fill("another wrong one");
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(dialog.getByTestId("auth-error")).toHaveText("Invalid username or password.");
});

test("registration validates alias and password and rejects taken aliases", async ({ page }) => {
  const name = alias();
  await register(page, name);
  await closeProjects(page);
  await openAppMenu(page);
  await page.getByRole("button", { name: "Sign out" }).click();

  await openAppMenu(page);
  await page.getByRole("button", { name: "Create account" }).click();
  const dialog = authDialog(page);
  await expect(dialog.getByLabel("Password", { exact: true })).toHaveAttribute(
    "autocomplete",
    "new-password",
  );
  await dialog.getByLabel("Username").fill(name);
  await dialog.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await dialog.getByRole("button", { name: "Create account" }).click();
  await expect(dialog.getByTestId("auth-error")).toContainText("already taken");

  await dialog.getByLabel("Username").fill(alias());
  await dialog.getByLabel("Password", { exact: true }).fill("short");
  await dialog.getByRole("button", { name: "Create account" }).click();
  await expect(dialog.getByTestId("auth-error")).toContainText("at least 12");

  await dialog.getByLabel("Username").fill("me@example.com");
  await dialog.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await dialog.getByRole("button", { name: "Create account" }).click();
  await expect(dialog.getByTestId("auth-error")).toContainText("Email addresses are not allowed");
});

test("dialog keeps focus inside, closes on Escape and returns focus", async ({ page }) => {
  await openAppMenu(page);
  const opener = page.getByRole("button", { name: "Sign in", exact: true });
  await opener.click();
  const dialog = authDialog(page);
  await expect(dialog.getByLabel("Username")).toBeFocused();
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("project CRUD, reload persistence and delete confirmation", async ({ page }) => {
  await register(page, alias());
  await newProject(page);
  await expect(saveState(page)).toHaveAttribute("data-save-state", "saved");
  await addMove(page);
  await expect(saveState(page)).toHaveText("Saved");
  await expect.poll(async () => saveState(page).getAttribute("data-save-state")).toBe("saved");
  await expect(moveBlocks(page)).toHaveCount(1);

  // The saved project survives a full page reload (session cookie + server state).
  await page.waitForTimeout(700);
  await page.reload();
  await openAppMenu(page);
  await expect(page.getByRole("button", { name: "My projects" })).toBeVisible();
  await openMyProjects(page);
  const dialog = projectsDialog(page);
  await expect(page.getByTestId("project-card")).toHaveCount(1);
  await dialog.getByRole("button", { name: /^Open: Untitled project/ }).click();
  await expect(moveBlocks(page)).toHaveCount(1);

  await openMyProjects(page);
  await dialog.getByRole("button", { name: /^Rename: Untitled project/ }).click();
  const rename = page.getByTestId("rename-dialog");
  await rename.getByLabel("Project name").fill("Space race");
  await rename.getByRole("button", { name: "Save name" }).click();
  await expect(dialog.getByRole("heading", { name: "Space race" })).toBeVisible();

  await dialog.getByRole("button", { name: /^Duplicate: Space race/ }).click();
  await expect(page.getByTestId("project-card")).toHaveCount(2);
  await expect(dialog.getByRole("heading", { name: "Space race (copy)" })).toBeVisible();

  await dialog.getByRole("button", { name: /^Delete: Space race \(copy\)/ }).click();
  const confirm = page.getByTestId("delete-dialog");
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByTestId("project-card")).toHaveCount(2);
  await dialog.getByRole("button", { name: /^Delete: Space race \(copy\)/ }).click();
  await confirm.getByRole("button", { name: "Delete project" }).click();
  await expect(page.getByTestId("project-card")).toHaveCount(1);

  // No public or share affordance anywhere.
  await expect(page.getByRole("button", { name: /share|publish|public/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /share|publish|public/i })).toHaveCount(0);
});

test("projects list shows error with retry", async ({ page }) => {
  await register(page, alias());
  await closeProjects(page);
  await page.route("**/v1/projects", (route) => route.abort());
  await openMyProjects(page);
  await expect(page.getByTestId("projects-error")).toBeVisible();
  await page.unroute("**/v1/projects");
  await projectsDialog(page).getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("projects-empty")).toBeVisible();
});

test("local project import is explicit, opt-in and leaves the local copy", async ({ page }) => {
  await addMove(page);
  await expect(moveBlocks(page)).toHaveCount(1);
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), PROJECT_KEY))
    .not.toBeNull();
  const before = await page.evaluate((key) => localStorage.getItem(key), PROJECT_KEY);

  await register(page, alias());
  const offer = page.getByTestId("import-dialog");
  await expect(offer).toContainText("You have a project saved on this device");
  // Nothing has been uploaded yet.
  expect(await page.evaluate(() => fetch("/v1/projects").then((r) => r.json()))).toEqual({
    items: [],
  });

  await offer.getByRole("button", { name: "Import to my projects" }).click();
  await expect(offer).toContainText("Imported to your projects");
  await offer.getByRole("button", { name: "Keep both" }).click();
  await expect(projectsDialog(page)).toBeVisible();
  await expect(page.getByTestId("project-card")).toHaveCount(1);
  expect(await page.evaluate((key) => localStorage.getItem(key), PROJECT_KEY)).toBe(before);
});

test("keep-local never uploads and does not nag again", async ({ page }) => {
  await addMove(page);
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), PROJECT_KEY))
    .not.toBeNull();
  const name = alias();
  await register(page, name);
  await page
    .getByTestId("import-dialog")
    .getByRole("button", { name: "Keep only on this device" })
    .click();
  await expect(page.getByTestId("project-card")).toHaveCount(0);
  await closeProjects(page);
  await openAppMenu(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, name);
  await expect(page.getByTestId("import-dialog")).toHaveCount(0);
  await expect(projectsDialog(page)).toBeVisible();
  await expect(page.getByTestId("project-card")).toHaveCount(0);
});

test("failed import leaves the local project untouched and can be retried", async ({ page }) => {
  await addMove(page);
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), PROJECT_KEY))
    .not.toBeNull();
  const before = await page.evaluate((key) => localStorage.getItem(key), PROJECT_KEY);
  await register(page, alias());
  const offer = page.getByTestId("import-dialog");
  await page.route("**/v1/projects", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await offer.getByRole("button", { name: "Import to my projects" }).click();
  await expect(offer).toContainText("Import didn't finish");
  expect(await page.evaluate((key) => localStorage.getItem(key), PROJECT_KEY)).toBe(before);
  await page.unroute("**/v1/projects");
  await offer.getByRole("button", { name: "Try again" }).click();
  await expect(offer).toContainText("Imported to your projects");
});

test("offline autosave is labelled truthfully and recovers", async ({ page, context }) => {
  await register(page, alias());
  await newProject(page);
  await expect(saveState(page)).toHaveAttribute("data-save-state", "saved");
  await context.setOffline(true);
  await addMove(page);
  await expect(saveState(page)).toHaveAttribute("data-save-state", "offline", { timeout: 10_000 });
  await expect(saveState(page)).toHaveText("Offline — saved on this device");
  await context.setOffline(false);
  await expect(saveState(page)).toHaveAttribute("data-save-state", "saved", { timeout: 15_000 });
});

test("a newer server version raises a conflict that needs an explicit choice", async ({
  page,
  browser,
}) => {
  const name = alias();
  await register(page, name);
  await newProject(page);
  await addMove(page);
  await expect(saveState(page)).toHaveAttribute("data-save-state", "saved");
  await expect.poll(async () => (await saveState(page).textContent()) ?? "").toBe("Saved");

  // Another device saves a newer revision of the same project.
  const other = await browser.newContext({ baseURL: page.url() });
  const otherPage = await other.newPage();
  await otherPage.goto("/");
  await signIn(otherPage, name);
  await keepLocalIfOffered(otherPage);
  await projectsDialog(otherPage)
    .getByRole("button", { name: /^Open: Untitled project/ })
    .click();
  await addMove(otherPage);
  await addMove(otherPage);
  await expect(saveState(otherPage)).toHaveAttribute("data-save-state", "saved", {
    timeout: 10_000,
  });
  await expect.poll(async () => (await saveState(otherPage).textContent()) ?? "").toBe("Saved");
  await otherPage.waitForTimeout(300);

  await addMove(page);
  const conflict = page.getByTestId("conflict-dialog");
  await expect(conflict).toBeVisible({ timeout: 10_000 });
  await expect(saveState(page)).toHaveAttribute("data-save-state", "conflict");

  // Cancel: nothing is overwritten and the learner can reopen the dialog.
  await conflict.getByRole("button", { name: "Cancel and keep editing" }).click();
  await expect(conflict).toHaveCount(0);
  await expect(saveState(page)).toHaveAttribute("data-save-state", "conflict");
  await page.getByRole("button", { name: "Resolve conflict" }).click();

  // Save as copy keeps both versions.
  await conflict.getByRole("button", { name: "Save mine as a copy" }).click();
  await expect(conflict).toHaveCount(0);
  await expect(saveState(page)).toHaveAttribute("data-save-state", "saved");
  await openMyProjects(page);
  await expect(page.getByTestId("project-card")).toHaveCount(2);
  await other.close();
});

test("conflict can reload the latest server version", async ({ page, browser }) => {
  const name = alias();
  await register(page, name);
  await newProject(page);
  await addMove(page);
  await expect.poll(async () => (await saveState(page).textContent()) ?? "").toBe("Saved");

  const other = await browser.newContext({ baseURL: page.url() });
  const otherPage = await other.newPage();
  await otherPage.goto("/");
  await signIn(otherPage, name);
  await keepLocalIfOffered(otherPage);
  await projectsDialog(otherPage)
    .getByRole("button", { name: /^Open: Untitled project/ })
    .click();
  await addMove(otherPage);
  await addMove(otherPage);
  await expect.poll(async () => (await saveState(otherPage).textContent()) ?? "").toBe("Saved");
  await otherPage.waitForTimeout(300);

  await addMove(page);
  const conflict = page.getByTestId("conflict-dialog");
  await expect(conflict).toBeVisible({ timeout: 10_000 });
  await conflict.getByRole("button", { name: /^Reload latest/ }).click();
  await expect(conflict).toHaveCount(0);
  await expect(moveBlocks(page)).toHaveCount(3);
  await expect(saveState(page)).toHaveAttribute("data-save-state", "saved");
  await other.close();
});

test("session expiry keeps the work, says so, and resumes after sign-in", async ({
  page,
  context,
}) => {
  const name = alias();
  await register(page, name);
  await newProject(page);
  await expect(saveState(page)).toHaveAttribute("data-save-state", "saved");
  await context.addCookies([
    { name: "agorix_session", value: "expired-or-unknown", url: page.url() },
  ]);
  await addMove(page);
  await expect(saveState(page)).toHaveAttribute("data-save-state", "session-expired", {
    timeout: 10_000,
  });
  await expect(moveBlocks(page)).toHaveCount(1);
  await page.getByTestId("save-state").locator("xpath=following-sibling::button").click();
  const dialog = authDialog(page);
  await expect(dialog).toContainText("Your session expired");
  await dialog.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(saveState(page)).toHaveAttribute("data-save-state", "saved", { timeout: 10_000 });
  await expect(moveBlocks(page)).toHaveCount(1);
});

test("account B never sees account A content after sign-out", async ({ page }) => {
  const a = alias("a");
  await register(page, a);
  await newProject(page);
  await addMove(page);
  await expect.poll(async () => (await saveState(page).textContent()) ?? "").toBe("Saved");
  await page.waitForTimeout(300);
  await openMyProjects(page);
  await projectsDialog(page)
    .getByRole("button", { name: /^Rename: Untitled project/ })
    .click();
  await page.getByTestId("rename-dialog").getByLabel("Project name").fill("Secret of A");
  await page.getByTestId("rename-dialog").getByRole("button", { name: "Save name" }).click();
  await expect(page.getByTestId("rename-dialog")).toHaveCount(0);
  await closeProjects(page);

  await openAppMenu(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  // The editor no longer shows A's blocks and no account chrome remains.
  await expect(moveBlocks(page)).toHaveCount(0);
  await expect(page.getByText("Secret of A")).toHaveCount(0);
  const leaked = await page.evaluate(() =>
    Object.keys(localStorage).filter((key) => key.includes("account-draft")),
  );
  expect(leaked).toEqual([]);

  await register(page, alias("b"));
  await expect(page.getByTestId("projects-empty")).toBeVisible();
  await expect(page.getByText("Secret of A")).toHaveCount(0);
  // And the API itself agrees.
  expect(await page.evaluate(() => fetch("/v1/projects").then((r) => r.json()))).toEqual({
    items: [],
  });
});

test("account UX and states are localized in Spanish", async ({ page }) => {
  await openAppMenu(page);
  await page.getByLabel("Product language").selectOption("es");
  await expect(page.getByRole("button", { name: "Iniciar sesión", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  const dialog = authDialog(page);
  await expect(dialog.getByRole("heading", { name: "Crea una cuenta de Agorix" })).toBeVisible();
  await dialog.getByLabel("Nombre de usuario").fill(alias("es"));
  await dialog.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await dialog.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByTestId("projects-empty")).toContainText("Aún no hay proyectos");
  await newProject(page);
  await expect(saveState(page)).toHaveText("Guardado");
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await expect(page.getByRole("button", { name: /^Eliminar: / })).toBeVisible();
  await closeProjects(page);
  await openAppMenu(page);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await openAppMenu(page);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await authDialog(page).getByLabel("Nombre de usuario").fill("nadie-aqui");
  await authDialog(page).getByLabel("Contraseña", { exact: true }).fill("otra clave cualquiera");
  await authDialog(page).getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(authDialog(page).getByTestId("auth-error")).toHaveText(
    "Usuario o contraseña no válidos.",
  );
});

test("touch targets in account UI are at least 44px on a tablet", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await register(page, alias());
  const heights = await authOrProjectsButtonHeights(page);
  for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);
  expect(heights.length).toBeGreaterThan(0);
});

async function authOrProjectsButtonHeights(page: Page): Promise<number[]> {
  await expect(projectsDialog(page)).toBeVisible();
  return projectsDialog(page)
    .getByRole("button")
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
}
