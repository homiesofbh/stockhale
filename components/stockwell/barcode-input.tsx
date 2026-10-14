"use client";

import { useEffect, useRef, type RefObject } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onScan: (code: string) => string | false | void;
  inputRef?: RefObject<HTMLInputElement | null>;
  name?: string;
  label?: string;
  action?: string;
  placeholder?: string;
};

/** Keyboard-wedge scanners send text followed by Enter or Tab, without a network connection. */
export function BarcodeInput({
  value, onChange, onScan, inputRef, name,
  label = "Barcode", placeholder = "Barcode / SKU",
}: Props) {
  const localRef = useRef<HTMLInputElement>(null);
  const ref = inputRef || localRef;
  const buffer = useRef("");
  function finishScan(code: string) {
    if (!code.trim()) return;
    const productId = onScan(code.trim());
    buffer.current = "";
    requestAnimationFrame(() => {
      const input = ref.current;
      if (!input) return;
      if (productId === false) { input.focus(); input.select(); return; }
      const form = input.form;
      const controls = Array.from(form?.querySelectorAll<HTMLElement>(
        'input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled)',
      ) || []).filter((control) => control.getClientRects().length > 0);
      const target = typeof productId === "string"
        ? controls.find((control) => control.dataset.barcodeQuantity === productId)
        : controls.slice(controls.indexOf(input) + 1).find((control) => !input.closest(".barcode-control")?.contains(control));
      target?.focus();
      if (target instanceof HTMLInputElement) target.select();
    });
  }
  const callbacks = useRef({ onChange, onScan: finishScan });
  callbacks.current = { onChange, onScan: finishScan };

  useEffect(() => {
    let last = 0;
    let scanning = false;
    let original: { input: HTMLInputElement | HTMLTextAreaElement; value: string; start: number | null; end: number | null } | null = null;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => { buffer.current = ""; scanning = false; original = null; clearTimeout(timer); };
    const complete = () => {
      const code = buffer.current;
      reset();
      callbacks.current.onChange(code);
      callbacks.current.onScan(code);
    };
    const listener = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.repeat) return;
      if (!ref.current?.form?.contains(event.target as Node)) return;
      if (event.key === "Enter" || event.key === "Tab") {
        if (!scanning) { reset(); return; }
        event.preventDefault();
        event.stopImmediatePropagation();
        complete();
        return;
      }
      if (event.key.length !== 1) { if (event.key !== "Shift") reset(); return; }
      const now = performance.now();
      if (!buffer.current || now - last > 35) {
        reset();
        const target = event.target;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
          original = { input: target, value: target.value, start: target.selectionStart, end: target.selectionEnd };
      }
      last = now;
      buffer.current += event.key;
      if (buffer.current.length >= 3) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!scanning && original) {
          // Restore the characters received before the rapid burst was recognized.
          const prototype = original.input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(original.input, original.value);
          original.input.dispatchEvent(new Event("input", { bubbles: true }));
          if (original.start !== null) original.input.setSelectionRange(original.start, original.end);
        }
        scanning = true;
        callbacks.current.onChange(buffer.current);
      }
      clearTimeout(timer);
      timer = setTimeout(() => { if (scanning) complete(); else reset(); }, 100);
    };
    window.addEventListener("keydown", listener, true);
    return () => { reset(); window.removeEventListener("keydown", listener, true); };
  }, []);

  return (
    <div className="barcode-control">
      <div className="scan-row">
        <input
          ref={ref} name={name} value={value} aria-label={label}
          autoFocus autoComplete="off" spellCheck={false} placeholder="Barcode / SKU"
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
      </div>
    </div>
  );
}

