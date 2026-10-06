import { jsPDF } from "jspdf";
import {
  balance,
  paid,
  returned,
  round,
  subtotal,
  total,
  type Store,
  type Trade,
} from "./model";

export type InvoicePaper = "A4" | "80mm" | "58mm";
type PdfOptions = { compress?: boolean; unicodeFont?: string };
const clean = (value: string) =>
  value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
export function invoiceText(s: Store, t: Trade) {
  const contact = (t.number.startsWith("PUR") ? s.suppliers : s.customers).find(
    (c) => c.id === t.contactId,
  );
  return [
    t.number,
    t.date,
    contact?.name || "",
    contact?.phone || "",
    contact?.email || "",
    contact?.address || "",
    ...t.lines.flatMap((l) => {
      const p = s.products.find((p) => p.id === l.productId);
      return [p?.name || "Unknown item", p?.sku || ""];
    }),
  ].map(clean);
}
export const needsUnicodeFont = (texts: string[]) =>
  texts.some((text) => /[^\x20-\x7E\xA0-\xFF\n\r\t]/.test(text));

/** Direct PDF primitives only: selectable text, vector lines and lossless stream compression. */
export function createInvoicePdf(
  s: Store,
  t: Trade,
  paper: InvoicePaper = "A4",
  options: PdfOptions = {},
) {
  const receipt = paper !== "A4";
  const width = paper === "58mm" ? 58 : paper === "80mm" ? 80 : 210;
  const margin = receipt ? 4 : 17;
  const right = width - margin;
  const contentWidth = right - margin;
  // Receipt height is trimmed after drawing, so a short receipt has no A4-sized blank tail.
  const maxHeight = receipt ? 1200 : 297;
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: receipt ? [width, maxHeight] : "a4",
    compress: options.compress !== false,
    putOnlyUsedFonts: true,
    floatPrecision: 3,
    precision: 3,
  });
  const texts = invoiceText(s, t);
  if (needsUnicodeFont(texts) && !options.unicodeFont)
    throw new Error("Unicode font required to preserve invoice text.");
  if (options.unicodeFont) {
    doc.addFileToVFS("StockwellUnicode.ttf", options.unicodeFont);
    doc.addFont("StockwellUnicode.ttf", "StockwellUnicode", "normal");
  }
  const font = options.unicodeFont ? "StockwellUnicode" : "helvetica";
  const size = receipt ? 9 : 10;
  const leading = receipt ? 4.2 : 5;
  let y = margin;
  let currentHeight = maxHeight;
  const documentPages: { height: number; used: number }[] = [];
  const setFont = (pt = size, bold = false) => {
    doc.setFont(
      font,
      options.unicodeFont ? "normal" : bold ? "bold" : "normal",
    );
    doc.setFontSize(pt);
    doc.setTextColor(44, 44, 57);
  };
  setFont();
  doc.setProperties({
    title: `${t.number} - Stockwell`,
    subject: "Retail invoice",
    creator: "Stockwell",
    author: "Stockwell",
  });
  const rule = () => {
    doc.setDrawColor(211, 208, 224);
    doc.setLineWidth(0.2);
    doc.line(margin, y, right, y);
    y += receipt ? 4 : 7;
  };
  const addPage = () => {
    documentPages.push({ height: currentHeight, used: y });
    doc.addPage(receipt ? [width, maxHeight] : "a4", "portrait");
    currentHeight = maxHeight;
    y = margin;
    setFont(receipt ? 8 : 9);
    doc.text(`Stockwell / ${t.number} / continued`, margin, y + 3);
    y += receipt ? 9 : 12;
  };
  const ensure = (height: number) => {
    if (y + height > currentHeight - margin - 10) addPage();
  };
  const text = (
    value: string,
    pt = size,
    bold = false,
    x = margin,
    maxWidth = contentWidth,
  ) => {
    setFont(pt, bold);
    const lines: string[] = doc.splitTextToSize(clean(value), maxWidth);
    const lineHeight = pt * 0.352778 * 1.32;
    for (const line of lines) {
      ensure(lineHeight + 1);
      setFont(pt, bold);
      doc.text(line, x, y + lineHeight * 0.8);
      y += lineHeight;
    }
  };
  const amount = (n: number) =>
    (Object.is(n, -0) ? 0 : n).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const fit = (
    value: string,
    x: number,
    baseline: number,
    available: number,
    pt = size,
    bold = false,
    align: "left" | "right" = "right",
  ) => {
    setFont(pt, bold);
    while (doc.getTextWidth(value) > available && pt > 6) {
      pt -= 0.25;
      setFont(pt, bold);
    }
    if (doc.getTextWidth(value) > available)
      throw new Error(
        "A numeric value is too wide for this paper. Choose a larger paper size.",
      );
    doc.text(value, x, baseline, { align });
  };
  setFont(receipt ? 20 : 29, true);
  doc.text("Stockwell", receipt ? width / 2 : margin, y + (receipt ? 7 : 10), {
    align: receipt ? "center" : "left",
  });
  y += receipt ? 15 : 22;
  text(
    t.number.startsWith("PUR") ? "Purchase record" : "Invoice",
    receipt ? 12 : 21,
    true,
  );
  y += 3;
  text(`${t.number}  |  ${t.date}`, receipt ? 8 : 10);
  y += 5;
  rule();
  const contact = (t.number.startsWith("PUR") ? s.suppliers : s.customers).find(
    (c) => c.id === t.contactId,
  );
  text(t.number.startsWith("PUR") ? "SUPPLIER" : "BILL TO", receipt ? 7 : 8);
  y += 1;
  text(contact?.name || "Walk-in customer", size, true);
  for (const value of [contact?.address, contact?.phone, contact?.email].filter(
    Boolean,
  ))
    text(value!, receipt ? 8 : 9);
  y += 3;
  const status =
    balance(s, t) < 0
      ? "Credit balance"
      : balance(s, t) === 0
        ? "Paid"
        : paid(s, t) > 0
          ? "Partial"
          : "Unpaid";
  text(`Payment: ${status} / ${t.method}`, receipt ? 8 : 9);
  y += 5;
  rule();
  const descriptionWidth = receipt ? contentWidth : 93;
  const qtyX = receipt ? right : 132,
    priceX = receipt ? right : 160,
    amountX = right;
  const tableHead = () => {
    ensure(10);
    setFont(receipt ? 8 : 9, true);
    if (receipt) doc.text("ITEM / QTY x UNIT PRICE", margin, y + 3);
    else {
      doc.text("ITEM", margin, y + 3);
      doc.text("QTY", qtyX, y + 3, { align: "right" });
      doc.text("UNIT PRICE", priceX, y + 3, { align: "right" });
    }
    doc.text("AMOUNT", amountX, y + 3, { align: "right" });
    y += 7;
    rule();
  };
  tableHead();
  for (const line of t.lines) {
    const product = s.products.find((p) => p.id === line.productId);
    setFont(size);
    const itemLines: string[] = doc.splitTextToSize(
      clean(product?.name || "Unknown item"),
      descriptionWidth,
    );
    const skuLines: string[] = product?.sku
      ? doc.splitTextToSize(clean(product.sku), descriptionWidth)
      : [];
    const fullHeight =
      (itemLines.length + skuLines.length) * leading + (receipt ? 7 : 0) + 5;
    if (y + Math.min(fullHeight, 45) > currentHeight - margin - 10) {
      addPage();
      tableHead();
    }
    let first = true;
    for (const itemLine of itemLines) {
      if (y + leading > currentHeight - margin - 10) {
        addPage();
        tableHead();
      }
      setFont(size);
      doc.text(itemLine, margin, y + 3);
      if (first && !receipt) {
        fit(String(line.qty), qtyX, y + 3, 18);
        fit(amount(line.price), priceX, y + 3, 25);
        fit(amount(round(line.qty * line.price)), amountX, y + 3, 29);
      }
      first = false;
      y += leading;
    }
    for (const sku of skuLines) {
      if (y + leading > currentHeight - margin - 10) {
        addPage();
        tableHead();
      }
      setFont(receipt ? 7 : 8);
      doc.setTextColor(120, 118, 135);
      doc.text(sku, margin, y + 3);
      y += leading;
    }
    if (receipt) {
      ensure(7);
      const a = amount(round(line.qty * line.price));
      fit(
        `${line.qty} x ${amount(line.price)}`,
        margin,
        y + 3,
        contentWidth * 0.53,
        8,
        false,
        "left",
      );
      fit(a, right, y + 3, contentWidth * 0.44, 9, true);
      y += 6;
    }
    y += 2;
    doc.setDrawColor(231, 229, 238);
    doc.line(margin, y, right, y);
    y += 4;
  }
  const summary: [string, number][] = [
    ["Subtotal", subtotal(t)],
    ["Discount", -t.discount],
    [`Tax (${t.tax}%)`, round(((subtotal(t) - t.discount) * t.tax) / 100)],
    ["Total (PKR)", total(t)],
    ["Return credit", -returned(s, t.id)],
    ["Paid", paid(s, t)],
    ["Balance / credit", balance(s, t)],
  ];
  // Keep a normal invoice's totals together; long receipts can continue on a new page.
  ensure(receipt ? 59 : 68);
  y += 3;
  const totalsLeft = receipt ? margin : right - 80;
  for (const [label, value] of summary) {
    const grand = label === "Total (PKR)";
    const rowHeight = grand ? 11 : receipt ? 6 : 8;
    ensure(rowHeight);
    if (grand) {
      doc.setDrawColor(175, 168, 192);
      doc.line(totalsLeft, y, right, y);
      y += 2;
    }
    fit(
      label,
      totalsLeft,
      y + 4,
      receipt ? contentWidth * 0.56 : 42,
      grand ? (receipt ? 10 : 13) : receipt ? 8 : 10,
      grand,
      "left",
    );
    fit(
      amount(value),
      right,
      y + 4,
      receipt ? contentWidth * 0.42 : 35,
      grand ? (receipt ? 11 : 14) : receipt ? 9 : 10,
      grand,
    );
    y += rowHeight;
  }
  y += 9;
  ensure(14);
  setFont(receipt ? 8 : 9);
  doc.text("Thank you for your business.", width / 2, y + 3, {
    align: "center",
  });
  y += 5;
  setFont(receipt ? 7 : 8);
  doc.setTextColor(126, 121, 141);
  doc.text("Generated with Stockwell", width / 2, y + 3, { align: "center" });
  y += 8;
  documentPages.push({ height: currentHeight, used: y });
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page);
    const height = receipt
      ? Math.max(100, documentPages[page - 1].used + margin + 7)
      : 297;
    setFont(receipt ? 6 : 8);
    doc.setTextColor(146, 139, 157);
    doc.text(
      `${t.number}  /  ${page} of ${doc.getNumberOfPages()}`,
      receipt ? width / 2 : right,
      height - margin,
      { align: receipt ? "center" : "right" },
    );
    if (receipt) {
      const context = doc.getCurrentPageInfo().pageContext;
      context.mediaBox.bottomLeftY =
        (maxHeight - height) * doc.internal.scaleFactor;
    }
  }
  return doc;
}

let fontCache: Promise<{ base64: string; coverage: Set<number> }> | undefined;
async function unicodeFont() {
  fontCache ??= Promise.all([
    fetch("/fonts/stockwell-unicode.ttf"),
    fetch("/fonts/stockwell-unicode-coverage.json"),
  ])
    .then(async ([font, coverage]) => {
      if (!font.ok || !coverage.ok)
        throw new Error(
          "The PDF font could not load. Use Print / Save PDF to preserve the invoice text.",
        );
      const bytes = new Uint8Array(await font.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192)
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return {
        base64: btoa(binary),
        coverage: new Set<number>(await coverage.json()),
      };
    })
    .catch((e) => {
      fontCache = undefined;
      throw e;
    });
  return fontCache;
}
export async function downloadInvoicePdf(
  s: Store,
  t: Trade,
  paper: InvoicePaper,
) {
  const texts = invoiceText(s, t);
  let font: string | undefined;
  if (needsUnicodeFont(texts)) {
    const data = await unicodeFont();
    if (
      texts.some((text) =>
        [...text].some(
          (char) =>
            !/\s/.test(char) && !data.coverage.has(char.codePointAt(0)!),
        ),
      )
    )
      throw new Error(
        "This invoice contains a character the compact PDF font cannot preserve. Use Print / Save PDF so your browser can preserve all text.",
      );
    font = data.base64;
  }
  const doc = createInvoicePdf(s, t, paper, { unicodeFont: font });
  doc.save(`${t.number}-${paper}.pdf`);
  return {
    bytes: doc.output("arraybuffer").byteLength,
    pages: doc.getNumberOfPages(),
  };
}
