import { randomBytes } from "node:crypto";
import { connect as netConnect, type Socket } from "node:net";
import { connect as tlsConnect, type TLSSocket } from "node:tls";
import { renderMail } from "./mailTemplates.js";
import type { Mailer, MailMessage } from "./types.js";

export type MailDeliveryErrorKind =
  "config" | "connect" | "timeout" | "tls" | "auth" | "rejected" | "protocol";

/** Fixed messages only: addresses, tokens, passwords and server text never end up in an error. */
export class MailDeliveryError extends Error {
  constructor(readonly kind: MailDeliveryErrorKind) {
    super(`mail delivery failed: ${kind}`);
    this.name = "MailDeliveryError";
  }
}

export interface SmtpConfig {
  readonly host: string;
  readonly port: number;
  /** Implicit TLS from the first byte (smtps://). Otherwise STARTTLS is required. */
  readonly secure: boolean;
  /** Loopback test servers only. Never honoured for any other host. */
  readonly allowPlaintext: boolean;
  readonly user?: string;
  readonly pass?: string;
  readonly from: string;
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const ADDRESS = /^[^\s<>"\\,;:\r\n]+@[^\s<>"\\,;:\r\n]+$/;

/**
 * `smtps://user:pass@host[:465]` (implicit TLS) or `smtp://user:pass@host[:587]` (STARTTLS required).
 * `?plaintext=1` is accepted for loopback hosts only. Errors never repeat the URL (it holds the password).
 */
export function parseSmtpUrl(raw: string, from: string): SmtpConfig {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new MailDeliveryError("config");
  }
  const secure = url.protocol === "smtps:";
  if (!secure && url.protocol !== "smtp:") throw new MailDeliveryError("config");
  if (url.hostname === "" || !ADDRESS.test(from)) throw new MailDeliveryError("config");
  const host = decodeURIComponent(url.hostname);
  const wantsPlaintext = url.searchParams.get("plaintext") === "1";
  if (wantsPlaintext && (secure || !LOOPBACK.has(host))) throw new MailDeliveryError("config");
  const port = url.port === "" ? (secure ? 465 : 587) : Number(url.port);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new MailDeliveryError("config");
  const user = url.username === "" ? undefined : decodeURIComponent(url.username);
  const pass = url.password === "" ? undefined : decodeURIComponent(url.password);
  if ((user === undefined) !== (pass === undefined)) throw new MailDeliveryError("config");
  return {
    host,
    port,
    secure,
    allowPlaintext: wantsPlaintext,
    ...(user === undefined || pass === undefined ? {} : { user, pass }),
    from,
  };
}

export interface SmtpReply {
  readonly code: number;
  readonly lines: readonly string[];
}

/** What the protocol needs from a connection; a fake one drives the unit tests. */
export interface SmtpTransport {
  readReply(): Promise<SmtpReply>;
  write(text: string): Promise<void>;
  /** Upgrade the live connection to TLS (after a 220 to STARTTLS). */
  startTls(): Promise<void>;
  close(): void;
}

function expect(reply: SmtpReply, ...codes: number[]): void {
  if (!codes.includes(reply.code)) {
    throw new MailDeliveryError(reply.code >= 500 && reply.code < 600 ? "rejected" : "protocol");
  }
}

function encodedSubject(subject: string): string {
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

function wrap76(base64: string): string {
  return base64.match(/.{1,76}/g)?.join("\r\n") ?? "";
}

export function buildRfc822(input: {
  readonly from: string;
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly now: Date;
  readonly messageIdDomain: string;
}): string {
  const id = randomBytes(12).toString("hex");
  return [
    `From: <${input.from}>`,
    `To: <${input.to}>`,
    `Subject: ${encodedSubject(input.subject)}`,
    `Date: ${input.now.toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: <${id}@${input.messageIdDomain}>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "Auto-Submitted: auto-generated",
    "",
    // Base64 keeps lines short and can never start a line with "." (no dot-stuffing needed).
    wrap76(Buffer.from(input.text, "utf8").toString("base64")),
    "",
  ].join("\r\n");
}

/** The SMTP conversation, with TLS required before any credential or message is sent. */
export async function deliverSmtp(
  transport: SmtpTransport,
  config: SmtpConfig,
  mail: { readonly to: string; readonly subject: string; readonly text: string },
  options: { readonly now?: () => Date; readonly clientName?: string } = {},
): Promise<void> {
  if (!ADDRESS.test(mail.to) || !ADDRESS.test(config.from)) throw new MailDeliveryError("config");
  const name = options.clientName ?? "agorix.invalid";
  let encrypted = config.secure;

  expect(await transport.readReply(), 220);
  await transport.write(`EHLO ${name}\r\n`);
  let ehlo = await transport.readReply();
  expect(ehlo, 250);

  if (!config.secure) {
    const offersStartTls = ehlo.lines.some((line) => /^STARTTLS$/i.test(line.slice(4).trim()));
    if (offersStartTls) {
      await transport.write("STARTTLS\r\n");
      expect(await transport.readReply(), 220);
      await transport.startTls();
      encrypted = true;
      await transport.write(`EHLO ${name}\r\n`);
      ehlo = await transport.readReply();
      expect(ehlo, 250);
    } else if (!config.allowPlaintext) {
      throw new MailDeliveryError("tls");
    }
  }

  if (config.user !== undefined && config.pass !== undefined) {
    if (!encrypted && !config.allowPlaintext) throw new MailDeliveryError("tls");
    const mechanisms = ehlo.lines
      .map((line) => line.slice(4).trim())
      .find((line) => /^AUTH\b/i.test(line));
    const canPlain = mechanisms === undefined || /\bPLAIN\b/i.test(mechanisms);
    if (canPlain) {
      const credentials = Buffer.from(`\0${config.user}\0${config.pass}`, "utf8").toString(
        "base64",
      );
      await transport.write(`AUTH PLAIN ${credentials}\r\n`);
    } else if (/\bLOGIN\b/i.test(mechanisms ?? "")) {
      await transport.write("AUTH LOGIN\r\n");
      expect(await transport.readReply(), 334);
      await transport.write(`${Buffer.from(config.user, "utf8").toString("base64")}\r\n`);
      expect(await transport.readReply(), 334);
      await transport.write(`${Buffer.from(config.pass, "utf8").toString("base64")}\r\n`);
    } else {
      throw new MailDeliveryError("auth");
    }
    const auth = await transport.readReply();
    if (auth.code !== 235) throw new MailDeliveryError("auth");
  }

  await transport.write(`MAIL FROM:<${config.from}>\r\n`);
  expect(await transport.readReply(), 250);
  await transport.write(`RCPT TO:<${mail.to}>\r\n`);
  expect(await transport.readReply(), 250, 251);
  await transport.write("DATA\r\n");
  expect(await transport.readReply(), 354);
  const domain = config.from.slice(config.from.lastIndexOf("@") + 1);
  const body = buildRfc822({
    from: config.from,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    now: (options.now ?? (() => new Date()))(),
    messageIdDomain: domain,
  });
  await transport.write(`${body}\r\n.\r\n`);
  expect(await transport.readReply(), 250);
  await transport.write("QUIT\r\n");
}

interface LineReader {
  next(): Promise<string>;
}

function lineReader(socket: Socket | TLSSocket, timeoutMs: number): LineReader {
  let buffer = "";
  let waiting: { resolve: (line: string) => void; reject: (error: Error) => void } | undefined;
  let failure: Error | undefined;
  const queue: string[] = [];
  const flush = () => {
    let index = buffer.indexOf("\n");
    while (index >= 0) {
      queue.push(buffer.slice(0, index).replace(/\r$/, ""));
      buffer = buffer.slice(index + 1);
      index = buffer.indexOf("\n");
    }
    if (waiting !== undefined && queue.length > 0) {
      const { resolve } = waiting;
      waiting = undefined;
      resolve(queue.shift() as string);
    }
  };
  socket.setEncoding("utf8");
  socket.on("data", (chunk: string) => {
    buffer += chunk;
    if (buffer.length > 16_384) {
      failure = new MailDeliveryError("protocol");
      socket.destroy();
    }
    flush();
  });
  const fail = (kind: MailDeliveryErrorKind) => {
    failure ??= new MailDeliveryError(kind);
    if (waiting !== undefined) {
      const { reject } = waiting;
      waiting = undefined;
      reject(failure);
    }
  };
  socket.on("error", () => fail("connect"));
  socket.on("close", () => fail("connect"));
  socket.setTimeout(timeoutMs, () => {
    fail("timeout");
    socket.destroy();
  });
  return {
    next() {
      if (queue.length > 0) return Promise.resolve(queue.shift() as string);
      if (failure !== undefined) return Promise.reject(failure);
      return new Promise((resolve, reject) => {
        waiting = { resolve, reject };
      });
    },
  };
}

/** Real network transport (node:net / node:tls). Certificates are always verified. */
export async function openSmtpTransport(
  config: SmtpConfig,
  timeoutMs = 10_000,
): Promise<SmtpTransport> {
  let socket: Socket | TLSSocket = await new Promise<Socket | TLSSocket>((resolve, reject) => {
    const onError = () => reject(new MailDeliveryError("connect"));
    const created = config.secure
      ? tlsConnect({ host: config.host, port: config.port, servername: config.host }, () =>
          resolve(created),
        )
      : netConnect({ host: config.host, port: config.port }, () => resolve(created));
    created.once("error", onError);
    created.setTimeout(timeoutMs, () => {
      created.destroy();
      reject(new MailDeliveryError("timeout"));
    });
  });
  let reader = lineReader(socket, timeoutMs);

  return {
    async readReply() {
      const lines: string[] = [];
      for (;;) {
        const line = await reader.next();
        lines.push(line);
        const match = /^(\d{3})([ -])/.exec(line);
        if (match === null) throw new MailDeliveryError("protocol");
        if (match[2] === " ") return { code: Number(match[1]), lines };
        if (lines.length > 50) throw new MailDeliveryError("protocol");
      }
    },
    write(text) {
      return new Promise<void>((resolve, reject) => {
        socket.write(text, "utf8", (error) =>
          error ? reject(new MailDeliveryError("connect")) : resolve(),
        );
      });
    },
    async startTls() {
      const plain = socket as Socket;
      plain.removeAllListeners("data");
      const upgraded = await new Promise<TLSSocket>((resolve, reject) => {
        const secure = tlsConnect({ socket: plain, servername: config.host }, () =>
          resolve(secure),
        );
        secure.once("error", () => reject(new MailDeliveryError("tls")));
      });
      socket = upgraded;
      reader = lineReader(socket, timeoutMs);
    },
    close() {
      socket.destroy();
    },
  };
}

export interface SmtpMailerOptions {
  readonly config: SmtpConfig;
  /** Public HTTPS origin used to build the verification link. */
  readonly publicOrigin: string;
  readonly timeoutMs?: number;
  /** Test seam: replace the real network. */
  readonly open?: (config: SmtpConfig) => Promise<SmtpTransport>;
}

export class SmtpMailer implements Mailer {
  constructor(private readonly options: SmtpMailerOptions) {
    if (!/^https:\/\/[^/]+$/.test(options.publicOrigin)) throw new MailDeliveryError("config");
  }

  async send(message: MailMessage): Promise<void> {
    const rendered = renderMail(message, this.options.publicOrigin);
    const transport = await (
      this.options.open ?? ((config) => openSmtpTransport(config, this.options.timeoutMs))
    )(this.options.config);
    try {
      await deliverSmtp(transport, this.options.config, rendered);
    } catch (error) {
      throw error instanceof MailDeliveryError ? error : new MailDeliveryError("protocol");
    } finally {
      transport.close();
    }
  }
}
