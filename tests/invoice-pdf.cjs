const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const m = require(process.env.STOCKWELL_MODEL);
const { createInvoicePdf, invoiceLayout, needsUnicodeFont } = require(
  process.env.STOCKWELL_PDF_MODULE,
);
function fixture(count = 2) {
  const s = m.emptyStore();
  s.products = Array.from({ length: count }, (_, i) => ({
    id: `p${i}`,
    name: `Premium product ${i + 1} / retail pack`,
    sku: `SKU-${String(i + 1).padStart(3, "0")}`,
    barcode: "",
    category: "General",
    cost: 60,
    price: 100,
    low: 5,
  }));
  s.customers.push({
    id: "c1",
    name: "QA Customer",
    phone: "0300 1234567",
    email: "qa@example.test",
    address: "Test Street, Lahore",
  });
  const t = {
    id: "t1",
    number: "INV-00001",
    date: "2026-10-06",
    contactId: "c1",
    lines: s.products.map((p) => ({
      productId: p.id,
      qty: 2,
      price: 100,
      cost: 60,
    })),
    discount: 20,
    tax: 10,
    paid: 50,
    method: "Cash",
    head: "Sales",
  };
  s.invoices.push(t);
  return { s, t };
}
test("layout profiles lock printer geometry and safe content margins", () => {
  assert.deepEqual(invoiceLayout("A4"), {
    width: 210,
    margin: 17,
    maxHeight: 297,
    fontSize: 10,
    leading: 5,
  });
  assert.deepEqual(invoiceLayout("80mm"), {
    width: 80,
    margin: 4,
    maxHeight: 1200,
    fontSize: 9,
    leading: 4.2,
  });
  assert.deepEqual(invoiceLayout("58mm"), {
    width: 58,
    margin: 4,
    maxHeight: 1200,
    fontSize: 9,
    leading: 4.2,
  });
  assert.equal(invoiceLayout("80mm").width - invoiceLayout("80mm").margin * 2, 72);
  assert.equal(invoiceLayout("58mm").width - invoiceLayout("58mm").margin * 2, 50);
});
test("PDF uses real text and lossless compression without raster images", () => {
  const { s, t } = fixture();
  const doc = createInvoicePdf(s, t);
  const compressed = Buffer.from(doc.output("arraybuffer"));
  const uncompressed = Buffer.from(
    createInvoicePdf(s, t, "A4", { compress: false }).output("arraybuffer"),
  );
  assert.ok(compressed.byteLength < uncompressed.byteLength);
  assert.ok(
    compressed.byteLength < 12000,
    `Small invoice is ${compressed.byteLength} bytes`,
  );
  assert.ok(compressed.toString("latin1").includes("/FlateDecode"));
  assert.ok(!compressed.toString("latin1").includes("/Subtype /Image"));
  assert.ok(doc.internal.pages[1].join("\n").includes("INV-00001"));
  assert.equal(doc.getNumberOfPages(), 1);
});
test("58 mm and 80 mm PDFs use exact paper width and trim blank receipt length", () => {
  const { s, t } = fixture();
  for (const paper of ["58mm", "80mm"]) {
    const doc = createInvoicePdf(s, t, paper);
    const box = doc.getPageInfo(1).pageContext.mediaBox;
    const width = (box.topRightX - box.bottomLeftX) / doc.internal.scaleFactor;
    const height = (box.topRightY - box.bottomLeftY) / doc.internal.scaleFactor;
    assert.ok(Math.abs(width - parseInt(paper)) < 0.01);
    assert.ok(height < 297 && height >= 100, `Receipt height ${height} mm`);
    assert.equal(doc.getNumberOfPages(), 1);
  }
});
test("large invoice paginates and keeps its final line and totals", () => {
  const { s, t } = fixture(120);
  const doc = createInvoicePdf(s, t);
  assert.ok(doc.getNumberOfPages() >= 3);
  const text = doc.internal.pages.flat().join("\n");
  assert.ok(text.includes("SKU-120"));
  assert.ok(text.includes("Total \\(PKR\\)"));
  assert.ok(text.includes("Balance / credit"));
});
test("extremely long product name wraps across pages without dropping text", () => {
  const { s, t } = fixture(1);
  s.products[0].name = "Very long product name ".repeat(200) + "FINALMARKER";
  const doc = createInvoicePdf(s, t);
  assert.ok(doc.getNumberOfPages() > 1);
  assert.ok(doc.internal.pages.flat().join("\n").includes("FINALMARKER"));
});
test("Unicode font is required instead of silently corrupting customer or product names", () => {
  const { s, t } = fixture(1);
  s.products[0].name = "چاول";
  assert.equal(needsUnicodeFont(["Rice"]), false);
  assert.equal(needsUnicodeFont(["چاول"]), true);
  assert.throws(() => createInvoicePdf(s, t), /Unicode font required/);
  const base64 = fs
    .readFileSync(
      path.join(process.cwd(), "public/fonts/stockwell-unicode.ttf"),
    )
    .toString("base64");
  const doc = createInvoicePdf(s, t, "A4", { unicodeFont: base64 });
  const buffer = Buffer.from(doc.output("arraybuffer"));
  assert.ok(buffer.toString("latin1").includes("/ToUnicode"));
  assert.ok(buffer.byteLength < 200000);
});
// Optional scratch PDFs for rendering/extraction QA; never use real user records here.
if (process.env.STOCKWELL_PDF_QA) {
  const dir = process.env.STOCKWELL_PDF_QA;
  fs.mkdirSync(dir, { recursive: true });
  for (const paper of ["A4", "58mm", "80mm"]) {
    const { s, t } = fixture();
    const doc = createInvoicePdf(s, t, paper);
    fs.writeFileSync(
      path.join(dir, `${paper}.pdf`),
      Buffer.from(doc.output("arraybuffer")),
    );
  }
  const { s, t } = fixture(120);
  fs.writeFileSync(
    path.join(dir, "multipage.pdf"),
    Buffer.from(createInvoicePdf(s, t).output("arraybuffer")),
  );
}

test("company invoices include optional NTN and work with name-only customer profiles", () => {
  const { s, t } = fixture();
  s.customers[0] = { id: "c1", name: "Hale Trading", phone: "", email: "", address: "", ntn: "0012345-6" };
  const pdf = Buffer.from(createInvoicePdf(s, t, "A4", { compress: false }).output("arraybuffer")).toString("latin1");
  assert.ok(pdf.includes("Hale Trading"));
  assert.ok(pdf.includes("NTN: 0012345-6"));
  delete s.customers[0].ntn;
  const nameOnly = Buffer.from(createInvoicePdf(s, t, "A4", { compress: false }).output("arraybuffer")).toString("latin1");
  assert.ok(nameOnly.includes("Hale Trading"));
  assert.ok(!nameOnly.includes("NTN:"));
});
