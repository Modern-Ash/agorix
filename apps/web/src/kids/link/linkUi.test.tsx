import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdultAccountCard } from "./AdultAccountCard.js";
import { ThisDeviceCard } from "./ThisDeviceCard.js";
import { assertLinkCatalogComplete, formatCountdown, linkError, linkText } from "./linkCopy.js";
import type { LinkApi } from "./linkApi.js";

// Issues #509 to #513: static structure and copy. Behaviour is covered by the browser journeys.
const api = {} as LinkApi;
const noop = () => undefined;

describe("link copy", () => {
  it("has identical Spanish and English catalogs, including every error kind", () => {
    expect(() => assertLinkCatalogComplete()).not.toThrow();
    expect(linkError("es", "invalid-code")).toContain("código");
    expect(linkError("en", "invalid-code")).toContain("code");
    expect(linkError("es", "invalid-alias")).toContain("sin @");
  });

  it("fills placeholders and leaves none behind", () => {
    expect(linkText("es", "signedInAs", { alias: "ada" })).toBe("Sesión iniciada como ada");
    expect(linkText("en", "expiresIn", { time: "09:59" })).toBe("Expires in 09:59");
    expect(linkText("es", "missions", {})).not.toContain("{");
  });

  it("formats a countdown that never goes negative", () => {
    expect(formatCountdown(600_000)).toBe("10:00");
    expect(formatCountdown(59_001)).toBe("01:00");
    expect(formatCountdown(1)).toBe("00:01");
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(-5000)).toBe("00:00");
  });
});

describe("AdultAccountCard", () => {
  const base = { locale: "es" as const, api, onSession: noop, onEmail: noop };

  it("asks only for a username and password to sign in, with autofill hints", () => {
    const html = renderToStaticMarkup(<AdultAccountCard {...base} session={null} email={null} />);
    expect(html).toContain('autoComplete="username"');
    expect(html).toContain('autoComplete="current-password"');
    expect(html).toContain('aria-label="Mostrar contraseña"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain('type="email"');
  });

  it("shows the email-pending state with resend, and never prints the address", () => {
    const html = renderToStaticMarkup(
      <AdultAccountCard
        {...base}
        session={{ alias: "ada" }}
        email={{ present: true, verified: false }}
      />,
    );
    expect(html).toContain("Sesión iniciada como ada");
    expect(html).toContain("Reenviar correo");
    expect(html).toContain("Ya lo confirmé");
    expect(html).not.toMatch(/@/);
  });

  it("shows confirmation once verified", () => {
    const html = renderToStaticMarkup(
      <AdultAccountCard
        {...base}
        locale="en"
        session={{ alias: "ada" }}
        email={{ present: true, verified: true }}
      />,
    );
    expect(html).toContain("Email confirmed.");
    expect(html).not.toContain("Resend");
  });
});

describe("ThisDeviceCard", () => {
  it("shows a 6-digit keypad before linking, with labelled controls", () => {
    const html = renderToStaticMarkup(
      <ThisDeviceCard locale="es" api={api} link={null} onLink={noop} />,
    );
    expect(html).toContain('aria-label="Código de 6 números"');
    expect(html).toContain('aria-label="Vincular"');
    expect(html).toContain('aria-label="Borrar"');
    for (const digit of "0123456789") expect(html).toContain(`>${digit}</button>`);
  });

  it("shows the sharing switch and unlink when linked, and never the token", () => {
    const token = "abcdefghijklmnopqrstuvwxyz0123456789_-AB";
    const html = renderToStaticMarkup(
      <ThisDeviceCard locale="en" api={api} link={{ token, sharing: false }} onLink={noop} />,
    );
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain("Unlink this device");
    expect(html).not.toContain(token);
  });
});
