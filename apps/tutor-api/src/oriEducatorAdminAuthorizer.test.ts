import { describe, expect, it } from "vitest";
import type { IncomingMessage } from "node:http";
import type { AdminAuth } from "./adminAuth.js";
import { createOriEducatorAdminAuthorizer } from "./oriEducatorAdminAuthorizer.js";

function request(csrf = "valid", origin = "https://agorix.example"): IncomingMessage {
  return {
    method: "POST",
    headers: {
      host: "agorix.example",
      origin,
      "content-type": "application/json",
      "x-agorix-admin-csrf": csrf,
    },
  } as unknown as IncomingMessage;
}
describe("Ori adult educator administrative authorization", () => {
  it("requires an authorized role and stable authenticated session", async () => {
    const auth = { read: () => ({ author: "educator", csrf: "valid" }) } as unknown as AdminAuth;
    const authorize = createOriEducatorAdminAuthorizer({
      auth, trustedHosts: ["agorix.example"], resolveRole: async () => true,
    });
    expect(await authorize(request())).toEqual({ id: "educator", canReviewOri: true });
    expect(await authorize(request("forged"))).toBeNull();
    expect(await authorize(request("valid", "https://attacker.example"))).toBeNull();
  });
  it("denies missing role, session revocation and resolver failure", async () => {
    let reads = 0;
    const auth = {
      read: () => ++reads === 1 ? { author: "educator", csrf: "valid" } : null,
    } as unknown as AdminAuth;
    const authorize = createOriEducatorAdminAuthorizer({
      auth, trustedHosts: ["agorix.example"], resolveRole: async () => true,
    });
    expect(await authorize(request())).toBeNull();
    const stable = { read: () => ({ author: "educator", csrf: "valid" }) } as unknown as AdminAuth;
    expect(await createOriEducatorAdminAuthorizer({
      auth: stable, trustedHosts: ["agorix.example"], resolveRole: async () => false,
    })(request())).toBeNull();
    expect(await createOriEducatorAdminAuthorizer({
      auth: stable, trustedHosts: ["agorix.example"], resolveRole: async () => { throw Error("down"); },
    })(request())).toBeNull();
  });
});
