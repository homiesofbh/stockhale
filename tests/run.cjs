const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const dir = mkdtempSync(path.join(tmpdir(), "stockwell-tests-"));
try {
  const compiled = spawnSync(
    process.execPath,
    [
      require.resolve("typescript/bin/tsc"),
      "lib/stockwell/model.ts",
      "lib/stockwell/invoice-pdf.ts",
      "lib/stockwell/server.ts",
      "lib/stockwell/record-selectors.ts",
      "lib/stockwell/reports.ts",
      "lib/stockwell/service-worker.ts",
      "lib/stockwell/service-worker-client.ts",
      "--esModuleInterop",
      "--target",
      "ES2022",
      "--module",
      "commonjs",
      "--outDir",
      dir,
      "--skipLibCheck",
    ],
    { stdio: "inherit" },
  );
  if (compiled.status !== 0) process.exitCode = compiled.status || 1;
  else {
    const tests = spawnSync(
      process.execPath,
      [
        "--test",
        "tests/retail.cjs",
        "tests/invoice-pdf.cjs",
        "tests/workspace.cjs",
        "tests/record-selectors.cjs",
        "tests/service-worker.cjs",
      ],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          STOCKWELL_TEST_DIR: dir,
          STOCKWELL_SERVER: path.join(dir, "server.js"),
          STOCKWELL_MODEL: path.join(dir, "model.js"),
          STOCKWELL_PDF_MODULE: path.join(dir, "invoice-pdf.js"),
          NODE_PATH: path.join(process.cwd(), "node_modules"),
        },
      },
    );
    process.exitCode = tests.status || 0;
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
