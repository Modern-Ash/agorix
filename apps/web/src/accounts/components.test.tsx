import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { assertAccountCatalogCompleteness, ta } from "./accountI18n.js";
import { AuthDialog, authErrorKey } from "./AuthDialog.js";
import { ClientError } from "./clients.js";
import { ConflictDialog } from "./ConflictDialog.js";
import { ImportOfferDialog } from "./ImportOfferDialog.js";
import { ProjectsDialog } from "./ProjectsDialog.js";
import { SaveBadge, saveStateKey } from "./SaveBadge.js";

const noop = () => undefined;
const asyncNoop = async () => undefined;

describe("account catalog", () => {
  it("is complete in English and Spanish", () => {
    expect(() => assertAccountCatalogCompleteness()).not.toThrow();
    expect(ta("es", "saveSaving")).toBe("Guardando…");
    expect(ta("en", "saveSaving")).toBe("Saving…");
  });
});

describe("AuthDialog", () => {
  const props = { locale: "en" as const, onSubmit: asyncNoop, onClose: noop };

  it("uses autofill-friendly fields and an accessible password toggle", () => {
    const html = renderToStaticMarkup(<AuthDialog {...props} />);
    expect(html).toContain('autoComplete="username"');
    expect(html).toContain('autoComplete="current-password"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('aria-label="Show password"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).not.toMatch(/type="email"/);
    expect(html).not.toMatch(/real name|email address\b.*required/i);
  });

  it("switches to new-password autofill when registering", () => {
    const html = renderToStaticMarkup(<AuthDialog {...props} initialMode="register" />);
    expect(html).toContain('autoComplete="new-password"');
    expect(html).toContain("do not use your real name");
  });

  it("explains session expiry and offers no registration switch", () => {
    const html = renderToStaticMarkup(<AuthDialog {...props} sessionExpired prefillAlias="ada" />);
    expect(html).toContain("Your session expired");
    expect(html).not.toContain("Create an account");
  });

  it("maps typed errors to localized messages without echoing details", () => {
    expect(authErrorKey(new ClientError("invalid-credentials"))).toBe("errInvalidCredentials");
    expect(authErrorKey(new ClientError("username-taken"))).toBe("errUsernameTaken");
    expect(authErrorKey(new ClientError("rate-limited"))).toBe("errRateLimited");
    expect(authErrorKey(new ClientError("transient"))).toBe("errTransient");
    expect(authErrorKey(new ClientError("validation", "INVALID_ALIAS"))).toBe("errAlias");
    expect(authErrorKey(new Error("boom"))).toBe("errGeneric");
  });
});

describe("SaveBadge", () => {
  it("renders the five truthful states in both languages", () => {
    expect(ta("en", saveStateKey("saved", true))).toBe("Saved");
    expect(ta("en", saveStateKey("saving", true))).toBe("Saving…");
    expect(ta("en", saveStateKey("offline", true))).toBe("Offline — saved on this device");
    expect(ta("en", saveStateKey("conflict", true))).toBe("Conflict — a newer version exists");
    expect(ta("en", saveStateKey("session-expired", true))).toBe("Session expired");
    expect(ta("es", saveStateKey("offline", true))).toContain("guardado en este dispositivo");
  });

  it("never claims device safety when the draft could not be stored", () => {
    expect(ta("en", saveStateKey("offline", false))).not.toContain("saved on this device");
  });

  it("is a polite status region and offers recovery actions", () => {
    const conflict = renderToStaticMarkup(
      <SaveBadge locale="en" state="conflict" deviceDraftOk onResolveConflict={noop} />,
    );
    expect(conflict).toContain('role="status"');
    expect(conflict).toContain('data-save-state="conflict"');
    expect(conflict).toContain("Resolve conflict");
    const expired = renderToStaticMarkup(
      <SaveBadge locale="en" state="session-expired" deviceDraftOk onSignIn={noop} />,
    );
    expect(expired).toContain("Sign in");
  });
});

describe("ProjectsDialog", () => {
  const base = {
    locale: "en" as const,
    onOpen: asyncNoop,
    onCreate: asyncNoop,
    onRename: asyncNoop,
    onDuplicate: asyncNoop,
    onDelete: asyncNoop,
    onRetry: noop,
    onClose: noop,
  };
  const item = {
    projectId: "p1",
    title: "Space race",
    revision: 1,
    createdAt: "2026-01-02T03:04:05.000Z",
    updatedAt: "2026-01-02T03:04:05.000Z",
    semanticHash: "h",
  };

  it("shows loading, empty and error states", () => {
    expect(
      renderToStaticMarkup(
        <ProjectsDialog {...base} projects={{ status: "loading", items: [] }} />,
      ),
    ).toContain("Loading your projects");
    expect(
      renderToStaticMarkup(<ProjectsDialog {...base} projects={{ status: "ready", items: [] }} />),
    ).toContain("No projects yet");
    const error = renderToStaticMarkup(
      <ProjectsDialog {...base} projects={{ status: "error", items: [], error: "transient" }} />,
    );
    expect(error).toContain("Check your connection");
    expect(error).toContain("Try again");
  });

  it("renders cards with per-project labelled actions and no share affordance", () => {
    const html = renderToStaticMarkup(
      <ProjectsDialog
        {...base}
        projects={{ status: "ready", items: [item] }}
        activeProjectId="p1"
      />,
    );
    expect(html).toContain("Space race");
    expect(html).toContain("Updated");
    expect(html).toContain('aria-label="Open: Space race"');
    expect(html).toContain('aria-label="Rename: Space race"');
    expect(html).toContain('aria-label="Duplicate: Space race"');
    expect(html).toContain('aria-label="Delete: Space race"');
    expect(html).toContain("Open now");
    expect(/\b(share|publish)\b/i.test(html)).toBe(false);
  });

  it("is Spanish when asked", () => {
    const html = renderToStaticMarkup(
      <ProjectsDialog {...base} locale="es" projects={{ status: "ready", items: [item] }} />,
    );
    expect(html).toContain("Mis proyectos");
    expect(html).toContain("Eliminar: Space race");
  });
});

describe("ImportOfferDialog and ConflictDialog", () => {
  const handlers = {
    locale: "en" as const,
    onImport: noop,
    onKeepLocal: noop,
    onOpenCopy: noop,
    onRemoveLocal: noop,
    onDone: noop,
  };

  it("offers explicit import or keep-local with the required wording", () => {
    const html = renderToStaticMarkup(
      <ImportOfferDialog {...handlers} offer={{ phase: "offered" }} />,
    );
    expect(html).toContain("You have a project saved on this device");
    expect(html).toContain("Import to my projects");
    expect(html).toContain("Keep only on this device");
  });

  it("renders nothing when there is no offer", () => {
    expect(
      renderToStaticMarkup(<ImportOfferDialog {...handlers} offer={{ phase: "none" }} />),
    ).toBe("");
  });

  it("states that a failed import left the local project untouched", () => {
    const html = renderToStaticMarkup(
      <ImportOfferDialog {...handlers} offer={{ phase: "failed" }} />,
    );
    expect(html).toContain("untouched");
  });

  it("requires an explicit conflict choice and has no silent overwrite", () => {
    const html = renderToStaticMarkup(
      <ConflictDialog locale="en" onReload={noop} onCopy={noop} onCancel={noop} />,
    );
    expect(html).toContain("Reload latest");
    expect(html).toContain("Save mine as a copy");
    expect(html).toContain("Cancel and keep editing");
    expect(html).toContain('role="alertdialog"');
    expect(html).not.toMatch(/overwrite server|force save/i);
  });
});
