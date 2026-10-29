import { describe, expect, it, vi } from "vitest";
import {
  oriKidsPilotProject,
  recordOriKidsPilotRun,
  requestOriKidsPilotHint,
} from "./oriKidsPilotClient.js";
import { applyOriKidsPilotProposal } from "./oriKidsPilotApply.js";

const ticketId = "123e4567-e89b-42d3-a456-426614174000";

describe("Kids private Ori client", () => {
  it("sends no project, learner identity, attempt count or hint level from the browser", async () => {
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url.endsWith("/project") ? { projectId: "allowed" } : { level: 1, text: "Probá un paso" },
    })) as unknown as typeof fetch;
    expect(await oriKidsPilotProject(fetchMock)).toBe("allowed");
    expect(await recordOriKidsPilotRun(fetchMock)).toBe(true);
    expect(await requestOriKidsPilotHint(fetchMock)).toEqual({ level: 1, text: "Probá un paso" });
    for (const [url, options] of vi.mocked(fetchMock).mock.calls) {
      expect(String(url)).toMatch(/^\/api\/tutor\/ori\//);
      expect(options?.credentials).toBe("same-origin");
      expect(options?.body).toBe("{}");
      expect(options?.headers).toMatchObject({ "x-agorix-request": "1" });
    }
  });

  it("fails closed for forged pilot and hint responses", async () => {
    const forged = vi.fn(async () => ({
      ok: true,
      json: async () => ({ projectId: "allowed", owner: "forged" }),
    })) as unknown as typeof fetch;
    expect(await oriKidsPilotProject(forged)).toBeNull();
    const hint = vi.fn(async () => ({
      ok: true,
      json: async () => ({ level: 9, text: "forged" }),
    })) as unknown as typeof fetch;
    expect(await requestOriKidsPilotHint(hint)).toBeNull();
  });

  it("applies only an accepted ticket and explicit script identifier", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ status: "applied" }),
    })) as unknown as typeof fetch;
    expect(await applyOriKidsPilotProposal("bad", "main", fetchMock)).toBe("unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await applyOriKidsPilotProposal(ticketId, "main", fetchMock)).toBe("applied");
    const [url, options] = vi.mocked(fetchMock).mock.calls[0]!;
    expect(url).toBe("/api/tutor/ori/review/apply");
    expect(options?.body).toBe(JSON.stringify({ ticketId, scriptId: "main" }));
  });
});
