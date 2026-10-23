export const LINK_SERVICE_PACKAGE_NAME = "@agorix/link-service";
export { normalizeEmail } from "./email.js";
export { renderMail, type RenderedMail } from "./mailTemplates.js";
export {
  MailDeliveryError,
  SmtpMailer,
  buildRfc822,
  deliverSmtp,
  openSmtpTransport,
  parseSmtpUrl,
  type MailDeliveryErrorKind,
  type SmtpConfig,
  type SmtpMailerOptions,
  type SmtpReply,
  type SmtpTransport,
} from "./smtp.js";
export { InMemoryLinkRepository } from "./memory.js";
export { LinkService } from "./service.js";
export type {
  CreatedLinkCode,
  DeviceSummaryView,
  LinkServiceOptions,
  LinkedDeviceView,
  RedeemedLink,
  ResolvedDevice,
} from "./service.js";
export { SUMMARY_MAX_BYTES, parseLinkSummary, type LinkSummary } from "./summary.js";
export {
  DEFAULT_LINK_POLICY,
  LinkError,
  NoopMailer,
  type Clock,
  type CodeRow,
  type EmailRow,
  type LinkErrorCode,
  type LinkPolicy,
  type LinkRepository,
  type LinkRow,
  type MailMessage,
  type Mailer,
  type RandomSource,
  type SummaryRow,
  type TokenRow,
  type VerificationRow,
} from "./types.js";
export { LINK_SERVICE_MIGRATIONS, SqlLinkRepository } from "./sql.js";
export type { LinkSqlDialect, LinkSqlExecutor, LinkSqlRow, LinkSqlValue } from "./sql.js";
