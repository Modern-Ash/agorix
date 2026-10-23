import { createServer, type Server, type Socket } from "node:net";
import { describe, expect, it } from "vitest";
import {
  MailDeliveryError,
  SmtpMailer,
  deliverSmtp,
  parseSmtpUrl,
  renderMail,
  type SmtpConfig,
  type SmtpReply,
  type SmtpTransport,
} from "../src/index.js";

// Issue #518: SMTP delivery with TLS required before any credential or message.
const FROM = "no-reply@agorix.example";
const mail = { to: "ada@example.com", subject: "Confirmá / Confirm", text: "hola\r\n.\r\nlínea" };

function config(extra: Partial<SmtpConfig> = {}): SmtpConfig {
  return {
    host: "smtp.example",
    port: 587,
    secure: false,
    allowPlaintext: false,
    from: FROM,
    ...extra,
  };
}

/** Scripted server: pops one reply per read, records everything written. */
function scripted(replies: readonly (string | readonly string[])[]) {
  const written: string[] = [];
  const events: string[] = [];
  const queue = [...replies];
  const transport: SmtpTransport = {
    async readReply(): Promise<SmtpReply> {
      const next = queue.shift();
      if (next === undefined) throw new MailDeliveryError("protocol");
      const lines = typeof next === "string" ? [next] : [...next];
      return { code: Number(lines[0]!.slice(0, 3)), lines };
    },
    async write(text) {
      written.push(text);
      events.push(`write:${text.split(" ")[0]!.trim().slice(0, 12)}`);
    },
    async startTls() {
      events.push("tls");
    },
    close() {
      events.push("close");
    },
  };
  return { transport, written, events };
}

const OK_DELIVERY = ["250 sender ok", "250 rcpt ok", "354 go", "250 queued"];

describe("parseSmtpUrl", () => {
  it("reads smtps and smtp, with default ports, credentials and decoding", () => {
    expect(parseSmtpUrl("smtps://us%40er:p%3Ass@mail.example", FROM)).toMatchObject({
      host: "mail.example",
      port: 465,
      secure: true,
      user: "us@er",
      pass: "p:ss",
      allowPlaintext: false,
    });
    expect(parseSmtpUrl("smtp://mail.example", FROM)).toMatchObject({ port: 587, secure: false });
    expect(parseSmtpUrl("smtp://mail.example:2525", FROM).port).toBe(2525);
  });

  it("allows plaintext only on loopback and only for STARTTLS-style URLs", () => {
    expect(parseSmtpUrl("smtp://127.0.0.1:2525?plaintext=1", FROM).allowPlaintext).toBe(true);
    expect(parseSmtpUrl("smtp://localhost:2525?plaintext=1", FROM).allowPlaintext).toBe(true);
    for (const bad of [
      "smtp://mail.example?plaintext=1",
      "smtps://127.0.0.1?plaintext=1",
      "smtp://10.0.0.5:25?plaintext=1",
    ]) {
      expect(() => parseSmtpUrl(bad, FROM), bad).toThrow(MailDeliveryError);
    }
  });

  it("rejects bad input and never echoes the URL or the password", () => {
    const secretUrls = [
      "http://u:topsecret@mail.example",
      "smtp://u:topsecret@",
      "smtp://u@mail.example",
      "smtp://:topsecret@mail.example",
      "smtp://u:topsecret@mail.example:99999",
      "not a url topsecret",
    ];
    for (const url of secretUrls) {
      try {
        parseSmtpUrl(url, FROM);
        throw new Error(`accepted ${url}`);
      } catch (error) {
        expect(error).toBeInstanceOf(MailDeliveryError);
        expect(String((error as Error).message)).not.toContain("topsecret");
        expect(String((error as Error).message)).not.toContain("mail.example");
      }
    }
    for (const from of ["", "no-at-sign", "a b@c.d", "a@b.c\r\nBcc: x@y.z"]) {
      expect(() => parseSmtpUrl("smtp://mail.example", from), from).toThrow(MailDeliveryError);
    }
  });
});

describe("deliverSmtp sequencing", () => {
  it("upgrades with STARTTLS before AUTH and before any mail", async () => {
    const s = scripted([
      "220 hi",
      ["250-mail", "250-STARTTLS", "250 AUTH PLAIN LOGIN"],
      "220 ready",
      ["250-mail", "250 AUTH PLAIN LOGIN"],
      "235 ok",
      ...OK_DELIVERY,
    ]);
    await deliverSmtp(s.transport, config({ user: "u", pass: "p" }), mail);
    const order = s.events;
    expect(order.indexOf("tls")).toBeGreaterThan(order.indexOf("write:STARTTLS"));
    expect(order.indexOf("write:AUTH")).toBeGreaterThan(order.indexOf("tls"));
    expect(order.indexOf("write:MAIL")).toBeGreaterThan(order.indexOf("write:AUTH"));
    expect(s.written.join("")).toContain("AUTH PLAIN " + Buffer.from("\0u\0p").toString("base64"));
    expect(s.written.at(-1)).toBe("QUIT\r\n");
  });

  it("implicit TLS skips STARTTLS", async () => {
    const s = scripted(["220 hi", ["250-mail", "250 AUTH PLAIN"], "235 ok", ...OK_DELIVERY]);
    await deliverSmtp(s.transport, config({ secure: true, port: 465, user: "u", pass: "p" }), mail);
    expect(s.events).not.toContain("tls");
    expect(s.written.join("")).not.toContain("STARTTLS");
  });

  it("refuses to continue when STARTTLS is not offered, before any credential or message", async () => {
    const s = scripted(["220 hi", ["250-mail", "250 AUTH PLAIN"]]);
    await expect(
      deliverSmtp(s.transport, config({ user: "u", pass: "secret-pass" }), mail),
    ).rejects.toMatchObject({
      kind: "tls",
    });
    const sent = s.written.join("");
    expect(sent).not.toContain("AUTH");
    expect(sent).not.toContain("secret-pass");
    expect(sent).not.toContain("MAIL FROM");
    expect(sent).not.toContain("DATA");
  });

  it("plaintext is possible only when explicitly allowed (loopback config)", async () => {
    const s = scripted(["220 hi", "250 mail", ...OK_DELIVERY]);
    await deliverSmtp(s.transport, config({ allowPlaintext: true }), mail);
    expect(s.written.join("")).toContain("DATA");
  });

  it("with loopback plaintext explicitly allowed, login works without STARTTLS", async () => {
    const s = scripted(["220 hi", ["250-mail", "250 AUTH PLAIN"], "235 ok", ...OK_DELIVERY]);
    await deliverSmtp(s.transport, config({ allowPlaintext: true, user: "u", pass: "p" }), mail);
    expect(s.written.join("")).toContain("AUTH PLAIN");
  });

  it("falls back to AUTH LOGIN when PLAIN is not offered", async () => {
    const s = scripted([
      "220 hi",
      ["250-mail", "250-STARTTLS", "250 ok"],
      "220 go",
      ["250-mail", "250 AUTH LOGIN"],
      "334 VXNlcg==",
      "334 UGFzcw==",
      "235 ok",
      ...OK_DELIVERY,
    ]);
    await deliverSmtp(s.transport, config({ user: "u", pass: "p" }), mail);
    const sent = s.written.join("");
    expect(sent).toContain("AUTH LOGIN");
    expect(sent).toContain(Buffer.from("u").toString("base64"));
    expect(sent).toContain(Buffer.from("p").toString("base64"));
  });

  it("maps a bad login, a rejected recipient and odd replies to fixed kinds", async () => {
    const tls = [
      "220 hi",
      ["250-mail", "250-STARTTLS", "250 AUTH PLAIN"],
      "220 go",
      ["250-mail", "250 AUTH PLAIN"],
    ];
    await expect(
      deliverSmtp(
        scripted([...tls, "535 bad credentials"]).transport,
        config({ user: "u", pass: "p" }),
        mail,
      ),
    ).rejects.toMatchObject({ kind: "auth" });
    await expect(
      deliverSmtp(
        scripted([...tls, "235 ok", "250 sender ok", "550 no such user ada@example.com"]).transport,
        config({ user: "u", pass: "p" }),
        mail,
      ),
    ).rejects.toMatchObject({ kind: "rejected" });
    await expect(
      deliverSmtp(scripted(["421 busy"]).transport, config(), mail),
    ).rejects.toMatchObject({
      kind: "protocol",
    });
    await expect(
      deliverSmtp(
        scripted(["220 hi", ["250-mail", "250 AUTH XOAUTH2", "250-STARTTLS"]]).transport,
        config({ allowPlaintext: true, user: "u", pass: "p" }),
        mail,
      ),
    ).rejects.toBeInstanceOf(MailDeliveryError);
  });

  it("refuses header-injection addresses before touching the network", async () => {
    const s = scripted([]);
    await expect(
      deliverSmtp(s.transport, config(), { ...mail, to: "a@b.c\r\nBcc: x@y.z" }),
    ).rejects.toMatchObject({ kind: "config" });
    expect(s.written).toEqual([]);
  });

  it("sends a base64 body that carries the text intact and no line starts with a dot", async () => {
    const s = scripted(["220 hi", "250 mail", ...OK_DELIVERY]);
    await deliverSmtp(s.transport, config({ allowPlaintext: true }), mail, {
      now: () => new Date("2026-10-23T12:00:00Z"),
    });
    const data = s.written.find((w) => w.startsWith("From:"))!;
    expect(data).toContain("Subject: =?UTF-8?B?");
    expect(data).toContain("Date: Fri, 23 Oct 2026 12:00:00 +0000");
    expect(data).toContain("Content-Transfer-Encoding: base64");
    expect(data.endsWith("\r\n.\r\n")).toBe(true);
    const base64 = data.split("\r\n\r\n")[1]!.replace(/\r\n/g, "").replace(/\.$/, "");
    expect(Buffer.from(base64, "base64").toString("utf8")).toBe(mail.text);
    expect(data.split("\r\n").some((line) => line.startsWith(".") && line !== ".")).toBe(false);
    expect(Buffer.from(data, "ascii").toString("ascii")).toBe(data); // headers are pure ASCII
  });
});

describe("renderMail", () => {
  it("builds a bilingual verification message with the encoded link", () => {
    const rendered = renderMail(
      { kind: "verify-email", to: "ada@example.com", token: "ab-_CD12" },
      "https://agorix.example/",
    );
    expect(rendered.text).toContain("https://agorix.example/kids?verify=ab-_CD12");
    expect(rendered.text).toContain("Hola");
    expect(rendered.text).toContain("Hello");
    expect(rendered.subject).toContain("Confirmá");
    expect(rendered.subject).toContain("Confirm");
  });

  it("the email-in-use notice carries no token and no link", () => {
    const rendered = renderMail(
      { kind: "email-in-use", to: "ada@example.com" },
      "https://agorix.example",
    );
    expect(rendered.text).not.toMatch(/https?:|verify=|token/i);
  });
});

/** A tiny real SMTP server over loopback TCP, enough to prove the socket code. */
function fakeServer(
  options: { silent?: boolean } = {},
): Promise<{ server: Server; port: number; received: string[] }> {
  const received: string[] = [];
  return new Promise((resolve) => {
    const server = createServer((socket: Socket) => {
      if (options.silent === true) return;
      socket.setEncoding("utf8");
      let data = "";
      let inData = false;
      socket.write("220 fake ready\r\n");
      socket.on("data", (chunk: string) => {
        data += chunk;
        for (;;) {
          if (inData) {
            const end = data.indexOf("\r\n.\r\n");
            if (end < 0) return;
            received.push(data.slice(0, end));
            data = data.slice(end + 5);
            inData = false;
            socket.write("250 queued\r\n");
            continue;
          }
          const eol = data.indexOf("\r\n");
          if (eol < 0) return;
          const line = data.slice(0, eol);
          data = data.slice(eol + 2);
          if (line.startsWith("EHLO")) socket.write("250 fake\r\n");
          else if (line.startsWith("MAIL") || line.startsWith("RCPT")) socket.write("250 ok\r\n");
          else if (line === "DATA") {
            inData = true;
            socket.write("354 go\r\n");
          } else if (line === "QUIT") socket.end("221 bye\r\n");
        }
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        server,
        port: typeof address === "object" && address ? address.port : 0,
        received,
      });
    });
  });
}

describe("SmtpMailer over a real socket", () => {
  it("delivers a verification message through the loopback test server", async () => {
    const { server, port, received } = await fakeServer();
    try {
      const mailer = new SmtpMailer({
        config: parseSmtpUrl(`smtp://127.0.0.1:${port}?plaintext=1`, FROM),
        publicOrigin: "https://agorix.example",
        timeoutMs: 2000,
      });
      await mailer.send({ kind: "verify-email", to: "ada@example.com", token: "tok-123_abc" });
      expect(received).toHaveLength(1);
      const body = received[0]!.split("\r\n\r\n")[1]!.replace(/\r\n/g, "");
      expect(Buffer.from(body, "base64").toString("utf8")).toContain(
        "https://agorix.example/kids?verify=tok-123_abc",
      );
      expect(received[0]).toContain("To: <ada@example.com>");
    } finally {
      server.close();
    }
  });

  it("times out on a silent server and reports it without details", async () => {
    const { server, port } = await fakeServer({ silent: true });
    try {
      const mailer = new SmtpMailer({
        config: parseSmtpUrl(`smtp://127.0.0.1:${port}?plaintext=1`, FROM),
        publicOrigin: "https://agorix.example",
        timeoutMs: 200,
      });
      await expect(
        mailer.send({ kind: "email-in-use", to: "ada@example.com" }),
      ).rejects.toMatchObject({ kind: "timeout", message: "mail delivery failed: timeout" });
    } finally {
      server.close();
    }
  });

  it("reports a refused connection as a plain 'connect' failure", async () => {
    const { server, port } = await fakeServer();
    server.close();
    const mailer = new SmtpMailer({
      config: parseSmtpUrl(`smtp://127.0.0.1:${port}?plaintext=1`, FROM),
      publicOrigin: "https://agorix.example",
      timeoutMs: 500,
    });
    await expect(
      mailer.send({ kind: "email-in-use", to: "ada@example.com" }),
    ).rejects.toMatchObject({
      kind: "connect",
    });
  });

  it("only accepts an https public origin for links", () => {
    expect(
      () => new SmtpMailer({ config: config(), publicOrigin: "http://agorix.example" }),
    ).toThrow(MailDeliveryError);
  });
});
