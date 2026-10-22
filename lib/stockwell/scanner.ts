/** Process scanner characters without converting codes to numbers. */
export function scannerKey(buffer: string, key: string): { buffer: string; code?: string } | null {
  if (key === "Enter" || key === "Tab") return { buffer: "", code: buffer.trim() };
  if (key === "Backspace") return { buffer: buffer.slice(0, -1) };
  if (key.length === 1 && !/[\x00-\x1f\x7f]/.test(key)) return { buffer: buffer + key };
  return null;
}
