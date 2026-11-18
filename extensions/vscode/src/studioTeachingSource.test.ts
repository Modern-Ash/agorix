import { describe, expect, it, vi } from "vitest";
import { createStudioPipeline, type StudioRouter } from "@agorix/learning-decision-plane";
import type { StudioProviderClient } from "./studioProvider.js";
import {
  createCompanionTurn,
  createStudioStarterProject,
  openStoredProject,
} from "./studioCore.js";
import { createTeachingSource } from "./studioTeachingSource.js";

const project = () =>
  openStoredProject(createStudioStarterProject({ starter: "first-mission", locale: "en" }));
const allow: StudioRouter = () => ({
  status: "selected",
  reason: "selected",
  providerRequestAllowed: true,
  locality: "local",
});

describe("explicit Studio teaching source", () => {
  it("asks through the provider boundary and shares the request budget", async () => {
    const baseline = createCompanionTurn(project(), "explain").response;
    const response = {
      ...baseline,
      metadata: { ...baseline.metadata, provenance: "local-provider" as const },
    };
    const request = vi.fn(async () => ({
      status: "response" as const,
      response,
      locality: "local" as const,
    }));
    const source = createTeachingSource({
      pipeline: createStudioPipeline({ route: allow, budget: { maxRequests: 1 } }),
      client: { request } as unknown as StudioProviderClient,
    });
    const first = await source.request(project(), "explain", { selectedNodeIds: [] });
    expect(first?.capability).toBe("explainer");
    expect(request).toHaveBeenCalledOnce();
    expect(await source.request(project(), "explain", { selectedNodeIds: [] })).toBeUndefined();
    expect(request).toHaveBeenCalledOnce();
  });

  it("stays local when unconfigured or denied", async () => {
    const denied = createTeachingSource({
      pipeline: createStudioPipeline({
        route: () => ({ status: "unavailable", reason: "off", providerRequestAllowed: false }),
      }),
      client: { request: vi.fn() } as unknown as StudioProviderClient,
    });
    expect(await denied.request(project(), "debug", {})).toBeUndefined();
    const offline = createTeachingSource({
      pipeline: createStudioPipeline({ route: allow }),
      client: undefined,
    });
    expect(await offline.request(project(), "reflect", {})).toBeUndefined();
  });

  it("does not present a server fallback as an Ori model answer", async () => {
    const fallback = createCompanionTurn(project(), "explain").response;
    const source = createTeachingSource({
      pipeline: createStudioPipeline({ route: allow }),
      client: {
        request: async () => ({ status: "response", response: fallback, locality: "local" }),
      } as unknown as StudioProviderClient,
    });
    expect(await source.request(project(), "explain", {})).toBeUndefined();
  });

  it("rejects a mismatched teaching capability and falls back when the service fails", async () => {
    const response = createCompanionTurn(project(), "explain").response;
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        status: "response",
        response: {
          ...response,
          metadata: { ...response.metadata, provenance: "local-provider" },
        },
        locality: "local",
      })
      .mockRejectedValueOnce(new Error("network failed"));
    const source = createTeachingSource({
      pipeline: createStudioPipeline({ route: allow }),
      client: { request } as unknown as StudioProviderClient,
    });
    expect(await source.request(project(), "debug", {})).toBeUndefined();
    expect(await source.request(project(), "debug", {})).toBeUndefined();
    expect(request).toHaveBeenCalledTimes(2);
  });
});
