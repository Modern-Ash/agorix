import type { Locale } from "../i18n.js";
import { ta } from "./accountI18n.js";
import { Dialog } from "./Dialog.js";

export interface ConflictDialogProps {
  readonly locale: Locale;
  readonly onReload: () => void;
  readonly onCopy: () => void;
  readonly onCancel: () => void;
}

/** A conflict is never resolved silently: the learner picks reload, copy or keep editing. */
export function ConflictDialog(props: ConflictDialogProps) {
  const { locale } = props;
  return (
    <Dialog
      title={ta(locale, "conflictTitle")}
      role="alertdialog"
      onClose={props.onCancel}
      testId="conflict-dialog"
    >
      <p className="agx-dialog-copy">{ta(locale, "conflictBody")}</p>
      <div className="agx-actions agx-actions-stack">
        <button type="button" className="agx-primary" data-autofocus="" onClick={props.onCopy}>
          {ta(locale, "conflictCopy")}
        </button>
        <button type="button" onClick={props.onReload}>
          {ta(locale, "conflictReload")}
        </button>
        <button type="button" onClick={props.onCancel}>
          {ta(locale, "conflictCancel")}
        </button>
      </div>
    </Dialog>
  );
}
