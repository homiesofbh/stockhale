/** Process scanner characters without converting codes to numbers. */
export function scannerKey(buffer: string, key: string): { buffer: string; code?: string } | null {
  if (key === "Enter" || key === "Tab") return { buffer: "", code: buffer.trim() };
  if (key === "Backspace") return { buffer: buffer.slice(0, -1) };
  if (key.length === 1 && !/[\x00-\x1f\x7f]/.test(key)) return { buffer: buffer + key };
  return null;
}

/** Keyboard readers are identified by a sustained burst, scoped to one field. */
export function isScannerBurst(code: string, elapsed: number, inBarcodeField: boolean): boolean {
  const minimumLength = inBarcodeField ? 3 : 6;
  return code.length >= minimumLength && elapsed >= 0 && elapsed / (code.length - 1) <= 20;
}
