"use client";

import { useEffect, useState } from "react";
import { workspaceRequest } from "@/lib/stockwell/workspace-request";

type Testimonial = { id: string; name: string; business: string; quote: string; rating: number };

// Share only the in-flight request. Later mounts still see newly approved reviews.
let publicRequest: Promise<Testimonial[]> | undefined;
function loadTestimonials() {
  if (!publicRequest) {
    publicRequest = fetch("/api/workspace?testimonials=public", {
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    }).then(async response => {
      if (!response.ok) throw new Error("Could not load testimonials.");
      const value = await response.json();
      return (value.testimonials || []) as Testimonial[];
    }).finally(() => { publicRequest = undefined; });
  }
  return publicRequest;
}

export function TestimonialSection() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void loadTestimonials().then(items => { if (active) setItems(items); }).catch(() => {});
    return () => { active = false; };
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    setBusy(true); setNotice("");
    try {
      const form = new FormData(element);
      await workspaceRequest({ action: "testimonial-submit", name: form.get("name"), business: form.get("business"), quote: form.get("quote"), rating: Number(form.get("rating")) });
      element.reset(); setShowForm(false); setNotice("Thanks. Your testimonial is awaiting admin review.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not submit testimonial."); }
    finally { setBusy(false); }
  }
  return <section className="testimonial-section" aria-labelledby="testimonial-title">
    <div className="testimonial-heading"><div><span className="section-eyebrow">FROM THE SHOP FLOOR</span><h2 id="testimonial-title">Good work, in their words.</h2><p>Testimonials are shared after review by our team.</p></div><button className="secondary-button" type="button" onClick={() => { setShowForm(v => !v); setNotice(""); }}>Share your experience</button></div>
    {notice && <p className="testimonial-notice" role="status">{notice}</p>}
    {showForm && <form className="testimonial-form" onSubmit={submit}><label>Your name<input name="name" required maxLength={120}/></label><label>Business (optional)<input name="business" maxLength={160}/></label><label>Rating<select name="rating" defaultValue="5">{[5,4,3,2,1].map(v => <option key={v} value={v}>{v} stars</option>)}</select></label><label className="testimonial-quote-field">Your testimonial<textarea name="quote" required maxLength={1200} rows={4}/></label><p>Only workspace owners can submit a testimonial. An admin must approve it before it appears here.</p><button className="marketing-cta" disabled={busy}>{busy ? "Submitting…" : "Send for review"}</button></form>}
    {items.length > 0 ? <div className="testimonial-grid">{items.map(item => <article className="testimonial-card" key={item.id}><div className="testimonial-stars" aria-label={`${item.rating} out of 5 stars`}>{"★".repeat(item.rating)}{"☆".repeat(5-item.rating)}</div><blockquote>“{item.quote}”</blockquote><div><strong>{item.name}</strong>{item.business && <small>{item.business}</small>}</div></article>)}</div> : <div className="testimonial-empty"><span>01</span><p>Be the first workspace owner to share how StockHale fits your business.</p></div>}
  </section>;
}
