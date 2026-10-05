import { describe, expect, it, vi } from "vitest";
import {
  createStudioPipeline,
  type StudioRouteResult,
  type StudioRouter,
} from "@agorix/learning-decision-plane";
import type { LearningCompanionResponse } from "@agorix/tutor-contract";
import { createProposalSource } from "./studioProposalSource.js";
import type { StudioProviderClient, StudioProviderOutcome } from "./studioProvider.js";
import {
  createCompanionTurn,
  createStudioStarterProject,
  openStoredProject,
} from "./studioCore.js";

const project = () =>
  openStoredProject(createStudioStarterProject({ starter: "blank", locale: "en-US" }));
const validResponse = (): LearningCompanionResponse =>
  createCompanionTurn(project(), "build").response;

const allow: StudioRouter = (): StudioRouteResult => ({
  status: "selected",
  reason: "selected",
  providerRequestAllowed: true,
  locality: "local",
});
const unavailableRoute: StudioRouter = (): StudioRouteResult => ({
  status: "unavailable",
  reason: "no-compatible-provider",
  providerRequestAllowed: false,
});

function setup(options: {
  route?: StudioRouter | undefined;
  outcome?: StudioProviderOutcome;
  maxRequests?: number;
  noClient?: boolean;
}) {
  const request = vi.fn(
    async () =>
      options.outcome ?? {
        status: "unavailable" as const,
        reason: "all-unavailable" as const,
        message: "AI help is unavailable right now.",
      },
  );
  const client: StudioProviderClient = {
    probe: async () => ({ state: "available", message: "" }),
    request,
  };
  const pipeline = createStudioPipeline({
    ...(options.route === undefined ? {} : { route: options.route }),
    ...(options.maxRequests === undefined ? {} : { budget: { maxRequests: options.maxRequests } }),
  });
  const source = createProposalSource({
    pipeline,
    client: options.noClient === true ? undefined : client,
  });
  return { source, request, pipeline };
}

describe("proposal source", () => {
  it("returns a provider session for a valid builder response", async () => {
    const { source, request } = setup({
      route: allow,
      outcome: { status: "response", response: validResponse(), locality: "local" },
    });
    const result = await source.request(project(), "first-step");
    expect(result.origin).toBe("provider");
    if (result.origin !== "provider") return;
    expect(result.session.review.proposal.id).toBeTruthy();
    expect(request).toHaveBeenCalledOnce();
  });

  it("falls back silently when there is no client or no router", async () => {
    const none = await setup({ route: allow, noClient: true }).source.request(
      project(),
      "first-step",
    );
    expect(none).toEqual({ origin: "built-in", reason: "no-provider" });
    const { source, request } = setup({ route: undefined });
    expect(await source.request(project(), "first-step")).toMatchObject({
      origin: "built-in",
      reason: "not-allowed",
    });
    expect(request).not.toHaveBeenCalled();
  });

  it("falls back with a notice when the route is unavailable", async () => {
    const { source, request } = setup({ route: unavailableRoute });
    const result = await source.request(project(), "first-step");
    expect(result).toMatchObject({ origin: "built-in", reason: "not-allowed" });
    expect(result.origin === "built-in" && result.notice).toMatch(/AI help isn't available/);
    expect(request).not.toHaveBeenCalled();
  });

  it("stops asking the provider once the request budget is spent", async () => {
    const { source, request } = setup({
      route: allow,
      maxRequests: 1,
      outcome: { status: "response", response: validResponse(), locality: "local" },
    });
    expect((await source.request(project(), "first-step")).origin).toBe("provider");
    const second = await source.request(project(), "first-step");
    expect(second).toMatchObject({ origin: "built-in", reason: "not-allowed" });
    expect(second.origin === "built-in" && second.notice).toMatch(/limit/);
    expect(request).toHaveBeenCalledOnce();
  });

  it("falls back when the provider is unavailable or rejected", async () => {
    const unavailable = await setup({
      route: allow,
      outcome: { status: "unavailable", reason: "all-unavailable", message: "Not now." },
    }).source.request(project(), "first-step");
    expect(unavailable).toEqual({ origin: "built-in", reason: "unavailable", notice: "Not now." });
    const rejected = await setup({
      route: allow,
      outcome: { status: "rejected", message: "That answer was not safe." },
    }).source.request(project(), "first-step");
    expect(rejected).toEqual({
      origin: "built-in",
      reason: "rejected",
      notice: "That answer was not safe.",
    });
  });

  it("falls back when the response is not a valid builder proposal", async () => {
    const good = validResponse();
    if (good.capability !== "builder") throw new Error("expected builder");
    const invalid = {
      ...good,
      payload: { ...good.payload, validation: { status: "invalid", errors: ["bad"] } },
    } as LearningCompanionResponse;
    const result = await setup({
      route: allow,
      outcome: { status: "response", response: invalid, locality: "local" },
    }).source.request(project(), "first-step");
    expect(result).toMatchObject({ origin: "built-in", reason: "invalid" });
    const coach = { ...good, capability: "coach" } as unknown as LearningCompanionResponse;
    expect(
      await setup({
        route: allow,
        outcome: { status: "response", response: coach, locality: "local" },
      }).source.request(project(), "first-step"),
    ).toMatchObject({ origin: "built-in", reason: "invalid" });
  });

  it("falls back when the proposal is for a program that has since changed", async () => {
    const response = validResponse();
    const changed = openStoredProject({
      ...createStudioStarterProject({ starter: "blank", locale: "en-US" }),
      program: {
        schema: project().stored.program.schema,
        scripts: [
          { id: "main", trigger: { type: "onStart" }, statements: [{ type: "move", steps: 3 }] },
        ],
      },
    } as never);
    const { source } = setup({
      route: allow,
      outcome: { status: "response", response, locality: "local" },
    });
    expect(await source.request(changed, "first-step")).toMatchObject({
      origin: "built-in",
      reason: "stale",
    });
  });

  it("never throws when the provider call itself fails", async () => {
    const pipeline = createStudioPipeline({ route: allow });
    const source = createProposalSource({
      pipeline,
      client: {
        probe: async () => ({ state: "available", message: "" }),
        request: async () => {
          throw new Error("boom");
        },
      },
    });
    expect(await source.request(project(), "first-step")).toMatchObject({
      origin: "built-in",
      reason: "unavailable",
    });
  });

  it("records only non-PII telemetry", async () => {
    const { source, pipeline } = setup({
      route: allow,
      outcome: { status: "response", response: validResponse(), locality: "local" },
    });
    await source.request(project(), "repeat-pattern");
    const text = JSON.stringify(pipeline.events());
    expect(pipeline.events()).toHaveLength(1);
    expect(text).not.toMatch(/learnerIntent|"text"|message/);
  });
});
