/** Only used in explicit scanner mode, never to guess whether human typing is a scan. */
export function scannerKey(buffer: string, key: string): { buffer: string; code?: string } | null {
  if (key === "Enter" || key === "Tab") return { buffer: "", code: buffer.trim() };
  if (key === "Backspace") return { buffer: buffer.slice(0, -1) };
  if (key.length === 1 && !/[\x00-\x1f\x7f]/.test(key)) return { buffer: buffer + key };
  return null;
}
