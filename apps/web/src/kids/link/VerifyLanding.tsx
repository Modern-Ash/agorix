import { useEffect, useState } from "react";
import type { Locale } from "../../i18n.js";
import { createLinkApi } from "./linkApi.js";
import { linkText } from "./linkCopy.js";

/** Handles the link in the verification email (`/kids?verify=TOKEN`) and removes the token from the URL. */
export function VerifyLanding({ locale }: { readonly locale: Locale }) {
  const [state, setState] = useState<"idle" | "ok" | "bad">("idle");

  useEffect(() => {
    let token: string | null = null;
    try {
      token = new URLSearchParams(window.location.search).get("verify");
    } catch {
      return;
    }
    if (token === null) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("verify");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    } catch {
      // The token is only used once anyway.
    }
    let cancelled = false;
    createLinkApi()
      .verifyEmail(token)
      .then(() => !cancelled && setState("ok"))
      .catch(() => !cancelled && setState("bad"));
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "idle") return null;
  return (
    <p role="status" className="kids-link-banner">
      {linkText(locale, state === "ok" ? "verifyOk" : "verifyBad")}{" "}
      <button type="button" className="kids-button" onClick={() => setState("idle")}>
        ✕
      </button>
    </p>
  );
}
