import { useState } from "react";
import { pairingQrDataUrl, readPairingQr } from "./pairingQr.js";

interface QrProps {
  readonly value: string;
  readonly label: string;
}

export function PairingQr({ value, label }: QrProps) {
  return (
    <img
      className="kids-pairing-qr"
      src={pairingQrDataUrl(value)}
      alt={label}
      width={180}
      height={180}
    />
  );
}

interface ScanProps {
  readonly label: string;
  readonly errorText: string;
  readonly hint?: string;
  readonly disabled?: boolean;
  readonly onValue: (value: string) => void;
}

export function PairingScan({ label, errorText, hint, disabled = false, onValue }: ScanProps) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function choose(file: File | undefined) {
    if (file === undefined) return;
    setBusy(true);
    setFailed(false);
    try {
      onValue(await readPairingQr(file));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="kids-pairing-scan">
      <label>
        <span>{label}</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          disabled={busy || disabled}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void choose(file);
          }}
        />
      </label>
      {hint !== undefined ? <small>{hint}</small> : null}
      {failed ? <p role="alert">{errorText}</p> : null}
    </div>
  );
}
