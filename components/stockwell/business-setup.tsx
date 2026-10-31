"use client";
import { useState } from "react";
import type { useWorkspace } from "@/lib/stockwell/use-workspace";

export function BusinessSetup({ workspace }: { workspace: ReturnType<typeof useWorkspace> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function choose(businessType: "retail" | "manufacturer") {
    setBusy(true);
    setError("");
    try {
      await workspace.action({ action: "business-setup", businessType });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save your business type.");
    } finally {
      setBusy(false);
    }
  }
  return <main className="business-setup-shell"><section className="business-setup-card"><span className="section-eyebrow">WELCOME TO STOCKHALE</span><h1>How does your business work?</h1><p>This helps us set up the right workspace. You can buy materials, make products, and sell them to customers or businesses in a manufacturer workspace.</p><div className="business-setup-options"><button disabled={busy} onClick={() => void choose("manufacturer")}><strong>We manufacture products</strong><span>Buy raw materials, create recipes, and record production runs.</span></button><button disabled={busy} onClick={() => void choose("retail")}><strong>We sell or manage other business operations</strong><span>Use inventory, purchasing, sales, customers, and accounts.</span></button></div>{error && <p role="alert" className="form-error">{error}</p>}{busy && <small role="status">Setting up your workspace…</small>}</section></main>;
}
