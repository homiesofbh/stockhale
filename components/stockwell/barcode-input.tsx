"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { scannerKey } from "@/lib/stockwell/scanner";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onScan: (code: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  name?: string;
  label?: string;
  action?: string;
  placeholder?: string;
};

/** Keyboard-wedge scanners send text followed by Enter or Tab, without a network connection. */
export function BarcodeInput({
  value, onChange, onScan, inputRef, name,
  label = "Barcode scanner input", action = "Add item",
  placeholder = "Scan barcode or enter SKU, then press Enter",
}: Props) {
  const localRef = useRef<HTMLInputElement>(null);
  const ref = inputRef || localRef;
  const [scannerMode, setScannerMode] = useState(false);
  const buffer = useRef("");
  function finishScan(code: string) {
    onScan(code);
    // Select the completed code so the next hardware scan replaces it.
    requestAnimationFrame(() => { ref.current?.focus(); ref.current?.select(); });
  }
  const callbacks = useRef({ onChange, onScan: finishScan });
  callbacks.current = { onChange, onScan: finishScan };

  useEffect(() => {
    if (!scannerMode) return;
    // Explicit mode avoids mistaking fast human typing for a scanner, and
    // prevents scanner characters from entering price, name or quantity fields.
    const listener = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.repeat) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setScannerMode(false);
        return;
      }
      const result = scannerKey(buffer.current, event.key);
      if (!result) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      buffer.current = result.buffer;
      if (result.code !== undefined) {
        if (result.code) callbacks.current.onScan(result.code);
      } else {
        callbacks.current.onChange(result.buffer);
      }
    };
    window.addEventListener("keydown", listener, true);
    return () => window.removeEventListener("keydown", listener, true);
  }, [scannerMode]);

  return (
    <div className="barcode-control">
      <div className="scan-row">
        <input
          ref={ref} name={name} value={value} aria-label={label}
          autoFocus autoComplete="off" spellCheck={false} placeholder={placeholder}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === "Tab") && !event.nativeEvent.isComposing) {
              if (event.key === "Tab" && !value.trim()) return;
              event.preventDefault();
              finishScan(event.currentTarget.value);
            }
          }}
        />
        <button type="button" className="secondary-button" onClick={() => finishScan(value)}>{action}</button>
      </div>
      <button
        type="button" className="secondary-button scanner-mode-button" aria-pressed={scannerMode}
        onClick={() => {
          buffer.current = "";
          setScannerMode(!scannerMode);
          ref.current?.focus();
        }}
      >
        {scannerMode ? "Turn off scanner mode" : "Use barcode scanner"}
      </button>
      <p className="form-hint" role="status">
        {scannerMode
          ? "Scanner mode on: scans go to this field from anywhere in the form. Turn it off or press Escape to edit other fields."
          : "Scan into this field, or enable scanner mode to scan from anywhere in the form. Configure your scanner to send Enter or Tab after each barcode."}
      </p>
    </div>
  );
}

