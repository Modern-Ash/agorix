import type { Locale } from "../i18n.js";
import { ta } from "./accountI18n.js";
import { Dialog } from "./Dialog.js";
import type { ImportOffer } from "./workspace.js";

export interface ImportOfferDialogProps {
  readonly locale: Locale;
  readonly offer: ImportOffer;
  readonly onImport: () => void;
  readonly onKeepLocal: () => void;
  readonly onOpenCopy: () => void;
  readonly onRemoveLocal: () => void;
  readonly onDone: () => void;
}

/** Explicit, opt-in offer. Nothing is uploaded unless the learner picks Import. */
export function ImportOfferDialog(props: ImportOfferDialogProps) {
  const { locale, offer } = props;
  if (offer.phase === "none") return null;

  if (offer.phase === "imported") {
    return (
      <Dialog title={ta(locale, "importDoneTitle")} onClose={props.onDone} testId="import-dialog">
        <p className="agx-dialog-copy">{ta(locale, "importDoneBody")}</p>
        <div className="agx-actions">
          <button type="button" className="agx-primary" onClick={props.onOpenCopy}>
            {ta(locale, "importOpenCopy")}
          </button>
          <button type="button" className="agx-danger" onClick={props.onRemoveLocal}>
            {ta(locale, "importRemoveLocal")}
          </button>
          <button type="button" onClick={props.onDone}>
            {ta(locale, "importKeepBoth")}
          </button>
        </div>
      </Dialog>
    );
  }

  const importing = offer.phase === "importing";
  return (
    <Dialog
      title={ta(locale, offer.phase === "failed" ? "importFailedTitle" : "importTitle")}
      testId="import-dialog"
    >
      <p className="agx-dialog-copy">
        {ta(locale, offer.phase === "failed" ? "importFailedBody" : "importBody")}
      </p>
      <div role="status" className="agx-hint">
        {importing ? ta(locale, "importing") : null}
      </div>
      <div className="agx-actions">
        <button type="button" className="agx-primary" disabled={importing} onClick={props.onImport}>
          {offer.phase === "failed" ? ta(locale, "retry") : ta(locale, "importAction")}
        </button>
        <button type="button" disabled={importing} onClick={props.onKeepLocal}>
          {ta(locale, "keepLocalAction")}
        </button>
      </div>
    </Dialog>
  );
}
