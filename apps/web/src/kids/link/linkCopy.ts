import type { Locale } from "../../i18n.js";
import type { LinkApiErrorKind } from "./linkApi.js";

const es = {
  title: "Cuenta de adulto y vinculación",
  intro:
    "Opcional. Con una cuenta de adulto podés ver el progreso de este dispositivo desde otro. El niño no necesita cuenta, nombre ni correo.",
  adultTitle: "Mi cuenta de adulto",
  signIn: "Entrar",
  createAccount: "Crear cuenta",
  alias: "Usuario",
  aliasNote: "Elegí un usuario de 3 a 32 caracteres; el correo va abajo.",
  password: "Contraseña",
  passwordNote: "Al menos 12 caracteres.",
  email: "Tu correo (solo vos lo ves)",
  emailNote:
    "Lo usamos para confirmar que sos un adulto y para avisarte. Nunca se muestra en el dispositivo del niño.",
  submitSignIn: "Entrar",
  submitCreate: "Crear mi cuenta",
  showPassword: "Mostrar contraseña",
  hidePassword: "Ocultar contraseña",
  signedInAs: "Sesión iniciada como {alias}",
  signOut: "Salir",
  emailPending: "Revisá tu correo y abrí el enlace para confirmarlo.",
  emailVerified: "Correo confirmado.",
  resend: "Reenviar correo",
  resendWait: "Podés reenviarlo en {n} s",
  resent: "Te lo enviamos de nuevo.",
  checkAgain: "Ya lo confirmé",
  notYet: "Todavía no está confirmado.",
  verifyOk: "Correo confirmado. Ya podés vincular un dispositivo desde Adultos.",
  verifyBad: "Ese enlace no sirve o venció. Pedí otro desde Adultos.",
  linkTitle: "Vincular un dispositivo",
  linkIntro: "Se genera un código de 6 números. Escribilo en el dispositivo del niño, en Adultos.",
  makeCode: "Generar código",
  newCode: "Código nuevo",
  cancelCode: "Cancelar código",
  codeLabel: "Código de vinculación",
  expiresIn: "Vence en {time}",
  codeExpired: "El código venció. Generá uno nuevo.",
  linked: "¡Dispositivo vinculado!",
  devicesTitle: "Dispositivos vinculados",
  noDevices: "Todavía no hay dispositivos vinculados.",
  lastSeen: "Última vez: {day}",
  syncOn: "Compartir progreso",
  syncOnNote: "Si lo apagás, este dispositivo deja de enviar resúmenes.",
  unlink: "Desvincular",
  unlinkConfirm: "¿Desvincular este dispositivo?",
  unlinkYes: "Sí, desvincular",
  cancel: "Cancelar",
  unlinkedOn: "Desvinculado. Se borra el {day}.",
  summaryTitle: "Resumen",
  missions: "Misiones completadas: {n}",
  concepts: "Conceptos practicados: {a} · {b} · {c}",
  oriDecisions: "Decisiones sobre Ori: {used} usadas · {changed} cambiadas · {rejected} rechazadas",
  minutesLine: "{day}: {n} min",
  retentionNote:
    "Cuando desvinculás un dispositivo, su resumen queda visible 30 días y después se borra.",
  addEmailTitle: "Agregá tu correo",
  addEmailIntro:
    "Tu cuenta todavía no tiene correo. Hace falta uno confirmado para vincular dispositivos.",
  addEmailSubmit: "Enviar enlace de confirmación",
  deleteTitle: "Borrar mi cuenta",
  deleteIntro:
    "Se borran para siempre tu cuenta, tus proyectos guardados, el correo, los dispositivos vinculados y sus resúmenes. No se puede deshacer.",
  deleteStart: "Borrar mi cuenta y todos mis datos",
  deletePassword: "Escribí tu contraseña para confirmar",
  deleteConfirm: "Sí, borrar todo",
  deleteDone: "Tu cuenta y tus datos se borraron.",
  privacyTitle: "Privacidad",
  privacyNote:
    "Guardamos tu correo (solo lo ves vos), un vínculo anónimo por dispositivo y resúmenes de cantidades: misiones, conceptos, minutos por día y decisiones sobre Ori. Nunca guardamos el nombre del niño, su ubicación, sus proyectos, lo que charla con Ori, imágenes ni audio. Podés desvincular cuando quieras.",
  noSummary: "Todavía no llegó ningún resumen.",
  thisDeviceTitle: "Este dispositivo",
  thisDeviceIntro: "Escribí el código que generó el adulto en su cuenta.",
  enterCode: "Código de 6 números",
  link: "Vincular",
  del: "Borrar",
  deviceLinked: "Este dispositivo está vinculado a una cuenta de adulto.",
  shareProgress: "Compartir el progreso",
  shareNote: "Solo cantidades: misiones, conceptos, minutos por día y decisiones sobre Ori.",
  unlinkThis: "Desvincular este dispositivo",
  storageBlocked: "Este navegador no puede guardar la vinculación. Probá fuera del modo privado.",
  errors: {
    unavailable: "Esta función no está disponible ahora.",
    offline: "No hay conexión. Probá de nuevo más tarde.",
    unauthenticated: "Tu sesión terminó. Entrá de nuevo.",
    "email-not-verified": "Primero confirmá tu correo.",
    "invalid-email": "Revisá el correo.",
    "invalid-alias": "Elegí un usuario sin @, de 3 a 32 caracteres.",
    "invalid-code": "Ese código no sirvió. Pedí uno nuevo.",
    "rate-limited": "Demasiados intentos. Esperá un rato.",
    "not-found": "No lo encontramos.",
    "invalid-credentials": "Usuario o contraseña incorrectos.",
    "username-taken": "Ese usuario no está disponible.",
    "weak-password": "La contraseña es muy corta (mínimo 12 caracteres).",
    "invalid-summary": "No se pudo enviar el resumen.",
    "wrong-password": "La contraseña no es correcta.",
    "email-required": "Hace falta un correo para crear la cuenta.",
    transient: "Algo falló. Probá de nuevo.",
  },
} as const;

type Catalog = {
  readonly [K in keyof typeof es]: (typeof es)[K] extends string
    ? string
    : { readonly [E in LinkApiErrorKind]: string };
};

const en: Catalog = {
  title: "Adult account and linking",
  intro:
    "Optional. With an adult account you can see this device's progress from another one. The child needs no account, name or email.",
  adultTitle: "My adult account",
  signIn: "Sign in",
  createAccount: "Create account",
  alias: "Username",
  aliasNote: "Choose a username of 3 to 32 characters; enter your email below.",
  password: "Password",
  passwordNote: "At least 12 characters.",
  email: "Your email (only you see it)",
  emailNote:
    "We use it to confirm you are an adult and to reach you. It is never shown on the child's device.",
  submitSignIn: "Sign in",
  submitCreate: "Create my account",
  showPassword: "Show password",
  hidePassword: "Hide password",
  signedInAs: "Signed in as {alias}",
  signOut: "Sign out",
  emailPending: "Check your email and open the link to confirm it.",
  emailVerified: "Email confirmed.",
  resend: "Resend email",
  resendWait: "You can resend in {n} s",
  resent: "We sent it again.",
  checkAgain: "I confirmed it",
  notYet: "It is not confirmed yet.",
  verifyOk: "Email confirmed. You can now link a device from Grown-ups.",
  verifyBad: "That link does not work or has expired. Ask for another in Grown-ups.",
  linkTitle: "Link a device",
  linkIntro: "A 6-digit code is created. Type it on the child's device, in Grown-ups.",
  makeCode: "Create code",
  newCode: "New code",
  cancelCode: "Cancel code",
  codeLabel: "Link code",
  expiresIn: "Expires in {time}",
  codeExpired: "The code expired. Create a new one.",
  linked: "Device linked!",
  devicesTitle: "Linked devices",
  noDevices: "No linked devices yet.",
  lastSeen: "Last seen: {day}",
  syncOn: "Share progress",
  syncOnNote: "If you turn it off, this device stops sending summaries.",
  unlink: "Unlink",
  unlinkConfirm: "Unlink this device?",
  unlinkYes: "Yes, unlink",
  cancel: "Cancel",
  unlinkedOn: "Unlinked. Deleted on {day}.",
  summaryTitle: "Summary",
  missions: "Missions completed: {n}",
  concepts: "Concepts practised: {a} · {b} · {c}",
  oriDecisions: "Decisions about Ori: {used} used · {changed} changed · {rejected} rejected",
  minutesLine: "{day}: {n} min",
  retentionNote:
    "When you unlink a device, its summary stays visible for 30 days and is then deleted.",
  addEmailTitle: "Add your email",
  addEmailIntro: "Your account has no email yet. A confirmed one is needed to link devices.",
  addEmailSubmit: "Send confirmation link",
  deleteTitle: "Delete my account",
  deleteIntro:
    "Your account, saved projects, email, linked devices and their summaries are deleted forever. This cannot be undone.",
  deleteStart: "Delete my account and all my data",
  deletePassword: "Type your password to confirm",
  deleteConfirm: "Yes, delete everything",
  deleteDone: "Your account and data were deleted.",
  privacyTitle: "Privacy",
  privacyNote:
    "We keep your email (only you see it), an anonymous link per device and summaries of amounts: missions, concepts, minutes per day and decisions about Ori. We never keep the child's name, location, projects, chats with Ori, images or audio. You can unlink whenever you want.",
  noSummary: "No summary has arrived yet.",
  thisDeviceTitle: "This device",
  thisDeviceIntro: "Type the code the adult created in their account.",
  enterCode: "6-digit code",
  link: "Link",
  del: "Delete",
  deviceLinked: "This device is linked to an adult account.",
  shareProgress: "Share progress",
  shareNote: "Only amounts: missions, concepts, minutes per day and decisions about Ori.",
  unlinkThis: "Unlink this device",
  storageBlocked: "This browser cannot keep the link. Try outside private mode.",
  errors: {
    unavailable: "This feature is not available right now.",
    offline: "No connection. Try again later.",
    unauthenticated: "Your session ended. Sign in again.",
    "email-not-verified": "Confirm your email first.",
    "invalid-email": "Check the email.",
    "invalid-alias": "Choose a username without @, 3 to 32 characters long.",
    "invalid-code": "That code did not work. Ask for a new one.",
    "rate-limited": "Too many attempts. Wait a while.",
    "not-found": "We could not find it.",
    "invalid-credentials": "Wrong username or password.",
    "username-taken": "That username is not available.",
    "weak-password": "The password is too short (at least 12 characters).",
    "invalid-summary": "The summary could not be sent.",
    "wrong-password": "The password is not correct.",
    "email-required": "An email is needed to create the account.",
    transient: "Something failed. Try again.",
  },
};

export type LinkText = typeof es;
export type LinkCopyKey = Exclude<keyof typeof es, "errors">;

const catalogs = { es, en } as const;

export function linkText(
  locale: Locale,
  key: LinkCopyKey,
  values: Record<string, string | number> = {},
): string {
  const template = (catalogs[locale] as Catalog)[key] as string;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ""));
}

export function linkError(locale: Locale, kind: LinkApiErrorKind): string {
  return (catalogs[locale] as Catalog).errors[kind];
}

export function assertLinkCatalogComplete(): void {
  const keys = (object: object) => Object.keys(object).sort().join(",");
  if (keys(es) !== keys(en)) throw new Error("link catalog keys differ");
  if (keys(es.errors) !== keys(en.errors)) throw new Error("link error keys differ");
}

/** mm:ss for a countdown; never negative. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
