import { MailDeliveryError, SmtpMailer, parseSmtpUrl } from "@agorix/link-service";

export interface LinkEnvConfig {
  /** Undefined means the adult-link feature is off. */
  readonly secret?: string;
  /** Undefined means no mail transport: the feature runs but verification mail is not delivered. */
  readonly mailer?: SmtpMailer;
}

type Env = Readonly<Record<string, string | undefined>>;

/**
 * Reads the optional adult-link settings. Empty values count as unset so a compose file can pass the
 * variables through unconditionally. Errors never repeat a value: the SMTP URL holds a password.
 */
export function readLinkConfig(env: Env, publicOrigin: string): LinkEnvConfig {
  const secret = env["AGORIX_LINK_SECRET"] || undefined;
  if (secret !== undefined && secret.length < 32) {
    throw new Error("AGORIX_LINK_SECRET must be at least 32 characters");
  }
  const smtpUrl = env["AGORIX_MAIL_SMTP_URL"] || undefined;
  const from = env["AGORIX_MAIL_FROM"] || undefined;
  if ((smtpUrl === undefined) !== (from === undefined)) {
    throw new Error("Set both AGORIX_MAIL_SMTP_URL and AGORIX_MAIL_FROM, or neither");
  }
  if (secret === undefined) return {};
  if (smtpUrl === undefined || from === undefined) return { secret };
  try {
    return {
      secret,
      mailer: new SmtpMailer({ config: parseSmtpUrl(smtpUrl, from), publicOrigin }),
    };
  } catch (error) {
    throw new Error(
      error instanceof MailDeliveryError
        ? "AGORIX_MAIL_SMTP_URL or AGORIX_MAIL_FROM is invalid"
        : "mail configuration failed",
    );
  }
}
