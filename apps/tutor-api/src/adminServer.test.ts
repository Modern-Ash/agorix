import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { getKidsMission } from "@agorix/curriculum";
import { AdminAuth, hashAdminPassword } from "./adminAuth.js";
import { createMemoryAiConfigRepository, defaultAiConfig } from "./aiConfig.js";
import { configFromEnv } from "./index.js";
import { createTutorServer } from "./server.js";

const servers: Server[] = [];
afterEach(async () =>
  Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  ),
);

async function start() {
  const config = configFromEnv({ AGORIX_TUTOR_ADAPTER: "fake" });
  const repository = createMemoryAiConfigRepository(
    defaultAiConfig(
      {
        provider: "auto",
        codexBin: "codex",
        codexModel: "gpt-6-luna",
        opencodeBin: "opencode",
        timeoutMs: 7_000,
      },
      config,
    ),
  );
  const server = createTutorServer({
    config,
    aiConfig: repository,
    adminAuth: new AdminAuth(hashAdminPassword("a-strong-admin-password")),
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, repository };
}

describe("AI administrator HTTP boundary", () => {
  it("rejects adult cookies, bad passwords, missing CSRF and invalid or stale publication", async () => {
    const { base } = await start();
    const get = (cookie?: string) =>
      fetch(`${base}/api/tutor/admin/config`, {
        headers: cookie ? { cookie, origin: base } : { origin: base },
      });
    expect((await get()).status).toBe(401);
    expect((await get("agorix_adult_session=adult-token")).status).toBe(401);
    const login = (password: string) =>
      fetch(`${base}/api/tutor/admin/session`, {
        method: "POST",
        headers: { origin: base, "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
    expect((await login("wrong-password")).status).toBe(401);
    const signed = await login("a-strong-admin-password");
    expect(signed.status).toBe(200);
    const cookie = signed.headers.get("set-cookie")!.split(";")[0]!;
    expect(signed.headers.get("set-cookie")).toContain("HttpOnly");
    const { csrf } = (await signed.json()) as { csrf: string };
    const current = (await (await get(cookie)).json()) as {
      current: { revision: number; config: unknown };
    };
    expect(current.current.revision).toBe(1);
    expect(JSON.stringify(current)).not.toContain("a-strong-admin-password");
    const post = (path: string, value: unknown, token = csrf) =>
      fetch(`${base}/api/tutor/admin/${path}`, {
        method: "POST",
        headers: {
          origin: base,
          cookie,
          "content-type": "application/json",
          "x-agorix-admin-csrf": token,
        },
        body: JSON.stringify(value),
      });
    expect(
      (await post("publish", { expectedRevision: 1, config: current.current.config }, "wrong"))
        .status,
    ).toBe(403);
    const invalid = { ...(current.current.config as object), secret: "no" };
    expect((await post("preview", { expectedRevision: 1, config: invalid })).status).toBe(400);
    const edited = structuredClone(current.current.config) as {
      capabilities: { mission: { enabled: boolean } };
    };
    edited.capabilities.mission.enabled = false;
    expect((await post("preview", { expectedRevision: 1, config: edited })).status).toBe(200);
    const published = await post("publish", { expectedRevision: 1, config: edited });
    expect(published.status).toBe(200);
    expect((await post("publish", { expectedRevision: 1, config: edited })).status).toBe(409);
    expect((await post("rollback", { expectedRevision: 2, sourceRevision: 1 })).status).toBe(200);
    expect((await get(cookie)).status).toBe(200);
    expect(
      (
        await fetch(`${base}/api/tutor/admin/session`, {
          method: "DELETE",
          headers: { origin: base, cookie, "x-agorix-admin-csrf": csrf },
        })
      ).status,
    ).toBe(200);
    expect((await get(cookie)).status).toBe(401);
  });

  it("a disabled published mission policy preserves the child fallback", async () => {
    const { base, repository } = await start();
    const revision = repository.current();
    repository.publish(
      {
        ...revision.config,
        capabilities: {
          ...revision.config.capabilities,
          mission: { ...revision.config.capabilities.mission, enabled: false },
        },
      },
      1,
      "operator",
    );
    const mission = getKidsMission("kids.m1.straight", "es");
    const response = await fetch(`${base}/api/tutor/ori`, {
      method: "POST",
      headers: { origin: base, "content-type": "application/json" },
      body: JSON.stringify({
        missionId: mission.id,
        locale: "es",
        hintLevel: 1,
        program: {
          schema: "agorix/program/v1",
          scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [] }],
        },
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toHaveProperty("message");
  });
});
