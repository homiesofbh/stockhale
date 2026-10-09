import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  preview: {
    buckets: {
      invoices: { access: "private" },
      attachments: { access: "private" },
    },
  },
});
