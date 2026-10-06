const csvCell = (v: unknown) => {
  const value = String(v ?? "");
  return `"${(typeof v !== "number" && /^[=+@\-\t\r]/.test(value) ? "'" : "") + value.replaceAll('"', '""')}"`;
};
export function download(name: string, data: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csv(name: string, columns: string[], rows: unknown[][]) {
  download(
    `${name}.csv`,
    "\uFEFF" +
      [columns, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n"),
    "text/csv;charset=utf-8",
  );
}
