"use client";

import { useEffect, useState } from "react";
import { workspaceRequest } from "@/lib/stockwell/use-workspace";
import { ArrowLeft, RefreshCw, Users } from "lucide-react";

type Overview = {
  plans: string[];
  totals: { users: number; workspaces: number; workforceEmails: number };
  workspaces: Array<{
    id: string;
    name: string;
    owner: { name: string; email: string };
    subscription: string;
    memberCount: number;
    workforceEmailCount: number;
    usage: { products: number; sales: number; purchases: number; customers: number; suppliers: number; activity: number; revision: number };
  }>;
};
type Testimonial = { id: string; name: string; business: string; quote: string; rating: number; status: string; createdAt: string; workspaceName: string; ownerEmail: string };

export function AdminPanel({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);

  async function load() {
    setError("");
    try {
      const response = await fetch("/api/workspace?admin=overview", { cache: "no-store" });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "Could not load admin overview.");
      setData(value);
      const reviewResponse = await fetch("/api/workspace?admin=testimonials", { cache: "no-store" });
      const reviewValue = await reviewResponse.json();
      if (!reviewResponse.ok) throw new Error(reviewValue.error || "Could not load testimonials.");
      setTestimonials(reviewValue.testimonials || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load admin overview.");
    }
  }

  async function reviewTestimonial(id: string, status: "approved" | "denied") {
    setBusy(id); setError(""); setNotice("");
    try {
      await workspaceRequest({ action: "testimonial-review", id, status });
      setNotice(status === "approved" ? "Testimonial approved and published." : "Testimonial denied.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not review testimonial."); }
    finally { setBusy(""); }
  }

  useEffect(() => { void load(); }, []);

  async function changePlan(workspaceId: string, subscription: string) {
    setBusy(workspaceId);
    setError("");
    setNotice("");
    try {
      const result = await workspaceRequest({ action: "admin-subscription", workspaceId, subscription });
      if (result.error) throw new Error(result.error);
      setNotice("Subscription updated.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Subscription could not be updated.");
    } finally {
      setBusy("");
    }
  }

  return <section className="admin-page">
    <div className="page-heading"><div><span className="eyebrow">ADMINISTRATION</span><h1>Accounts &amp; usage</h1><p>Registered users, workspace activity, team email counts, and assigned subscriptions.</p></div><div className="heading-actions"><button className="secondary-button" onClick={() => void load()}><RefreshCw size={16}/> Refresh</button><button className="secondary-button" onClick={onBack}><ArrowLeft size={16}/> Back to workspace</button></div></div>
    {error && <div className="error-banner" role="alert">{error}</div>}
    {notice && <p className="admin-notice" role="status">{notice}</p>}
    {!data && !error && <div className="loading">Loading admin overview…</div>}
    {data && <>
      <div className="admin-testimonials"><div className="page-heading"><div><span className="eyebrow">TESTIMONIALS</span><h2>Owner submissions</h2><p>Approve submissions to publish them, or deny them.</p></div></div>{testimonials.length === 0 ? <p className="admin-empty">No testimonials submitted.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Workspace / owner</th><th>Testimonial</th><th>Status</th><th>Review</th></tr></thead><tbody>{testimonials.map(t => <tr key={t.id}><td><strong>{t.workspaceName}</strong><small>{t.name} · {t.ownerEmail}</small>{t.business && <small>{t.business}</small>}</td><td><span>{"★".repeat(t.rating)}{"☆".repeat(5-t.rating)}</span><p>{t.quote}</p></td><td>{t.status}</td><td>{t.status === "pending" ? <div className="admin-testimonial-actions"><button className="primary-button" disabled={busy === t.id} onClick={() => void reviewTestimonial(t.id,"approved")}>Approve</button><button className="secondary-button" disabled={busy === t.id} onClick={() => void reviewTestimonial(t.id,"denied")}>Deny</button></div> : <span>Reviewed</span>}</td></tr>)}</tbody></table></div>}</div>
      <div className="admin-totals"><article><span>Registered users</span><strong>{data.totals.users}</strong></article><article><span>Workspaces</span><strong>{data.totals.workspaces}</strong></article><article><span>Workforce email addresses</span><strong>{data.totals.workforceEmails}</strong></article></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>User / workspace</th><th>Users</th><th>Workforce emails</th><th>Usage</th><th>Subscription</th></tr></thead><tbody>{data.workspaces.map((item) => <tr key={item.id}><td><strong>{item.owner.name || item.owner.email}</strong><small>{item.owner.email}</small><span className="admin-workspace-name">{item.name}</span></td><td><span className="admin-member-count"><Users size={14}/>{item.memberCount}</span></td><td>{item.workforceEmailCount}</td><td><span>{item.usage.products} products · {item.usage.sales} sales</span><small>{item.usage.purchases} purchases · {item.usage.customers} customers · {item.usage.suppliers} suppliers</small><small>{item.usage.activity} activity records</small></td><td><select aria-label={`Subscription for ${item.name}`} value={item.subscription} disabled={busy === item.id} onChange={(event) => void changePlan(item.id, event.target.value)}>{data.plans.map((plan) => <option key={plan}>{plan}</option>)}</select></td></tr>)}</tbody></table>{data.workspaces.length === 0 && <p className="admin-empty">No workspaces yet.</p>}</div>
    </>}
  </section>;
}
