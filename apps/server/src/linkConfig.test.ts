import { describe, expect, it } from "vitest";
import { readLinkConfig } from "./linkConfig.js";

// Issue #518: startup configuration for the optional adult link.
const ORIGIN = "https://agorix.example";
const SECRET = "s".repeat(40);

describe("readLinkConfig", () => {
  it("is off when nothing is set, including empty pass-through values", () => {
    expect(readLinkConfig({}, ORIGIN)).toEqual({});
    expect(
      readLinkConfig(
        { AGORIX_LINK_SECRET: "", AGORIX_MAIL_SMTP_URL: "", AGORIX_MAIL_FROM: "" },
        ORIGIN,
      ),
    ).toEqual({});
  });

  it("enables the feature without mail when only the secret is set", () => {
    const config = readLinkConfig({ AGORIX_LINK_SECRET: SECRET }, ORIGIN);
    expect(config.secret).toBe(SECRET);
    expect(config.mailer).toBeUndefined();
  });

  it("builds an SMTP mailer when everything is set", () => {
    const config = readLinkConfig(
      {
        AGORIX_LINK_SECRET: SECRET,
        AGORIX_MAIL_SMTP_URL: "smtp://user:pw@mail.example:587",
        AGORIX_MAIL_FROM: "no-reply@agorix.example",
      },
      ORIGIN,
    );
    expect(config.mailer).toBeDefined();
  });

  it("refuses a short secret and half a mail configuration", () => {
    expect(() => readLinkConfig({ AGORIX_LINK_SECRET: "short" }, ORIGIN)).toThrow(/at least 32/);
    expect(() =>
      readLinkConfig(
        { AGORIX_LINK_SECRET: SECRET, AGORIX_MAIL_SMTP_URL: "smtp://x.example" },
        ORIGIN,
      ),
    ).toThrow(/both/);
    expect(() =>
      readLinkConfig({ AGORIX_LINK_SECRET: SECRET, AGORIX_MAIL_FROM: "a@b.example" }, ORIGIN),
    ).toThrow(/both/);
  });

  it("an invalid SMTP URL fails without repeating the password", () => {
    for (const url of [
      "http://u:hunter2@mail.example",
      "smtp://u:hunter2@",
      "smtp://mail.example?plaintext=1",
    ]) {
      try {
        readLinkConfig(
          {
            AGORIX_LINK_SECRET: SECRET,
            AGORIX_MAIL_SMTP_URL: url,
            AGORIX_MAIL_FROM: "a@b.example",
          },
          ORIGIN,
        );
        throw new Error(`accepted ${url}`);
      } catch (error) {
        expect((error as Error).message).toBe(
          "AGORIX_MAIL_SMTP_URL or AGORIX_MAIL_FROM is invalid",
        );
      }
    }
  });

  it("insists on an https origin for the links in the message", () => {
    expect(() =>
      readLinkConfig(
        {
          AGORIX_LINK_SECRET: SECRET,
          AGORIX_MAIL_SMTP_URL: "smtp://mail.example",
          AGORIX_MAIL_FROM: "a@b.example",
        },
        "http://agorix.example",
      ),
    ).toThrow(/invalid/);
  });
});
