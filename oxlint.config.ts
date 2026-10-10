import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["nextjs"],
  rules: {
    "nextjs/no-typos": "warn",
  },
});
