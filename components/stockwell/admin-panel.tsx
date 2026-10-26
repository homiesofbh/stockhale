"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw, Search, Users } from "lucide-react";
import { workspaceRequest } from "@/lib/stockwell/workspace-request";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type Workspace = {
  id: string;
  name: string;
  owner: { name: string; email: string };
  accountCreatedAt: string;
  lastActivityAt: string | null;
  subscription: string;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  planActive: boolean;
  planActivatedAt: string | null;
  planExpiresAt: string | null;
  locked: boolean;
  accessRevokedAt: string | null;
  countryCode: string | null;
  price: { currency: string; monthly: number; yearly: number };
  memberCount: number;
  workforceEmailCount: number;
  usage: {
    products: number;
    sales: number;
    purchases: number;
    customers: number;
    suppliers: number;
    activity: number;
    revision: number;
  };
};

type Overview = {
  plans: string[];
  totals: { users: number; workspaces: number; workforceEmails: number };
  workspaces: Workspace[];
};

type Testimonial = {
  id: string;
  name: string;
  business: string;
  quote: string;
  rating: number;
  status: string;
  createdAt: string;
  workspaceName: string;
  ownerEmail: string;
};

type Tone = "green" | "amber" | "neutral";
type WorkspaceSort =
  | "alphabetical"
  | "accountCreated"
  | "planActivated"
  | "planExpires"
  | "subscription";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const PRICES: Record<"PKR" | "USD", Record<string, [number, number]>> = {
  PKR: {
    Starter: [999, 9990],
    Growth: [2499, 24990],
    Business: [5999, 59990],
    Pro: [5999, 59990],
  },
  USD: {
    Starter: [12, 120],
    Growth: [29, 290],
    Business: [69, 690],
    Pro: [69, 690],
  },
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value: string | null | undefined) {
  return value ? dateFormatter.format(new Date(value)) : "Not recorded";
}

function planLabel(plan: string, countryCode: string | null) {
  if (plan === "Free") return "Free · no paid access";
  if (plan === "Enterprise") return "Enterprise · custom";

  const currency = countryCode === "PK" ? "PKR" : "USD";
  const [monthly, yearly] = PRICES[currency][plan] ?? [0, 0];
  const name = plan === "Pro" ? "Pro (legacy)" : plan;

  return `${name} · ${currency} ${monthly.toLocaleString()}/mo · ${yearly.toLocaleString()}/yr`;
}

function getAccess(item: Workspace): { label: string; tone: Tone } {
  if (item.planActive) return { label: "Active", tone: "green" };

  if (item.locked) {
    const trialExpired =
      !!item.trialEndsAt && Date.now() >= Date.parse(item.trialEndsAt);
    return {
      label: trialExpired ? "Trial expired · locked" : "Access revoked · locked",
      tone: "amber",
    };
  }

  if (item.trialStartedAt) return { label: "Trial active", tone: "neutral" };
  return { label: "Legacy access", tone: "neutral" };
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function fetchJson<T>(url: string, fallback: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || fallback);
  return value as T;
}

/* -------------------------------------------------------------------------- */
/* Small presentational pieces                                                */
/* -------------------------------------------------------------------------- */

function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const className = tone === "neutral" ? "badge" : `badge ${tone}`;
  return <span className={className}>{children}</span>;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span
      className="admin-stars"
      role="img"
      aria-label={`${rating} out of 5 stars`}
    >
      {"★".repeat(rating)}
      {"☆".repeat(Math.max(0, 5 - rating))}
    </span>
  );
}

function Totals({ totals }: { totals: Overview["totals"] }) {
  const items = [
    { label: "Registered users", value: totals.users },
    { label: "Workspaces", value: totals.workspaces },
    { label: "Workforce email addresses", value: totals.workforceEmails },
  ];

  return (
    <div className="admin-totals">
      {items.map((item) => (
        <article key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value.toLocaleString()}</strong>
        </article>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export function AdminPanel({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<Overview | null>(null);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [error, setError] = useState("");
  const [reviewsError, setReviewsError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [query, setQuery] = useState("");
  const [subscriptionFilter, setSubscriptionFilter] = useState("All");
  const [sortBy, setSortBy] = useState<WorkspaceSort>("alphabetical");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [workspacePage, setWorkspacePage] = useState(1);
  const workspacePageSize = 10;

  function updateSort(value: string) {
    const [field, direction] = value.split(":") as [WorkspaceSort, "asc" | "desc"];
    setSortBy(field);
    setSortDirection(direction);
  }

  /* ---------- Data loading ---------- */

  const load = useCallback(async () => {
    setError("");
    setReviewsError("");

    const [overview, reviews] = await Promise.allSettled([
      fetchJson<Overview>(
        "/api/workspace?admin=overview",
        "Could not load admin overview.",
      ),
      fetchJson<{ testimonials?: Testimonial[] }>(
        "/api/workspace?admin=testimonials",
        "Could not load testimonials.",
      ),
    ]);

    if (overview.status === "fulfilled") setData(overview.value);
    else setError(errorMessage(overview.reason, "Could not load admin overview."));

    if (reviews.status === "fulfilled")
      setTestimonials(reviews.value.testimonials ?? []);
    else
      setReviewsError(errorMessage(reviews.reason, "Could not load testimonials."));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /* ---------- Actions ---------- */

  async function run(id: string, fallback: string, task: () => Promise<string>) {
    setBusy(id);
    setError("");
    setNotice("");
    try {
      setNotice(await task());
      await load();
    } catch (e) {
      setError(errorMessage(e, fallback));
    } finally {
      setBusy("");
    }
  }

  function reviewTestimonial(id: string, status: "approved" | "denied") {
    return run(id, "Could not review testimonial.", async () => {
      await workspaceRequest({ action: "testimonial-review", id, status });
      return status === "approved"
        ? "Testimonial approved and published."
        : "Testimonial denied.";
    });
  }

  function changePlan(workspaceId: string, subscription: string) {
    return run(workspaceId, "Subscription could not be updated.", async () => {
      const result = await workspaceRequest({
        action: "admin-subscription",
        workspaceId,
        subscription,
      });
      if (result.error) throw new Error(result.error);
      return `${result.subscription} access ${
        result.planActive ? "activated" : "deactivated"
      } immediately.`;
    });
  }

  function cancelPlan(workspace: Workspace) {
    const confirmed = window.confirm(
      `Cancel the ${workspace.subscription} plan for "${workspace.name}"? Access is revoked immediately.`,
    );
    if (!confirmed) return;

    return run(workspace.id, "Plan could not be cancelled.", async () => {
      const result = await workspaceRequest({
        action: "admin-cancel-subscription",
        workspaceId: workspace.id,
      });
      if (result.error) throw new Error(result.error);
      return "Plan cancelled and access revoked immediately.";
    });
  }

  /* ---------- Derived data ---------- */

  const pendingCount = testimonials.filter((t) => t.status === "pending").length;

  // Pending submissions first so they are never buried.
  const sortedTestimonials = useMemo(
    () =>
      [...testimonials].sort((a, b) => {
        const aPending = a.status === "pending" ? 0 : 1;
        const bPending = b.status === "pending" ? 0 : 1;
        return aPending - bPending || b.createdAt.localeCompare(a.createdAt);
      }),
    [testimonials],
  );

  const workspaceMatches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!data) return [];
    return data.workspaces.filter((w) => {
      if (subscriptionFilter !== "All" && w.subscription !== subscriptionFilter)
        return false;
      if (!term) return true;
      return [w.name, w.owner.name, w.owner.email, w.id]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [data, query, subscriptionFilter]);

  const sortedWorkspaces = useMemo(() => {
    const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
    const value = (workspace: Workspace) => {
      if (sortBy === "alphabetical") return workspace.name || workspace.owner.name || workspace.owner.email;
      if (sortBy === "subscription") return workspace.subscription;
      if (sortBy === "accountCreated") return workspace.accountCreatedAt;
      if (sortBy === "planActivated") return workspace.planActivatedAt || "";
      return workspace.planExpiresAt || "";
    };
    return [...workspaceMatches].sort((a, b) => {
      const aValue = value(a);
      const bValue = value(b);
      const aMissing = !aValue;
      const bMissing = !bValue;
      if (aMissing !== bMissing) return aMissing ? 1 : -1;
      const result = typeof aValue === "string" && typeof bValue === "string"
        ? (sortBy === "accountCreated" || sortBy === "planActivated" || sortBy === "planExpires"
            ? aValue.localeCompare(bValue)
            : collator.compare(aValue, bValue))
        : 0;
      return sortDirection === "asc" ? result : -result;
    });
  }, [sortBy, sortDirection, workspaceMatches]);

  const workspacePageCount = Math.max(1, Math.ceil(sortedWorkspaces.length / workspacePageSize));
  const workspaces = sortedWorkspaces.slice(
    (workspacePage - 1) * workspacePageSize,
    workspacePage * workspacePageSize,
  );

  useEffect(() => {
    setWorkspacePage(1);
  }, [query, subscriptionFilter, sortBy, sortDirection]);

  useEffect(() => {
    setWorkspacePage((page) => Math.min(page, workspacePageCount));
  }, [workspacePageCount]);

  /* ---------- Render ---------- */

  return (
    <section className="admin-page" aria-busy={!data && !error}>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ADMINISTRATION</span>
          <h1>Accounts &amp; usage</h1>
          <p>
            Registered users, workspace activity, team email counts, and
            assigned subscriptions.
          </p>
        </div>
        <div className="heading-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => void load()}
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <button type="button" className="secondary-button" onClick={onBack}>
            <ArrowLeft size={16} /> Back to workspace
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <p className="admin-notice" role="status">
          {notice}
        </p>
      )}
      {!data && !error && <div className="admin-loading">Loading admin overview…</div>}

      {data && (
        <>
          <Totals totals={data.totals} />

          {/* ---------------- Testimonials ---------------- */}
          <section className="admin-block" aria-labelledby="admin-reviews-title">
            <header className="admin-block-head">
              <div>
                <span className="eyebrow">TESTIMONIALS</span>
                <h2 id="admin-reviews-title">Owner submissions</h2>
                <p>Approve submissions to publish them, or deny them.</p>
              </div>
              {pendingCount > 0 && (
                <Badge tone="amber">{pendingCount} pending</Badge>
              )}
            </header>

            {reviewsError && (
              <div className="error-banner" role="alert">
                {reviewsError}
              </div>
            )}

            {!reviewsError && sortedTestimonials.length === 0 ? (
              <p className="admin-empty">No testimonials submitted.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table admin-table-reviews">
                  <thead>
                    <tr>
                      <th scope="col">Workspace / owner</th>
                      <th scope="col">Testimonial</th>
                      <th scope="col">Status</th>
                      <th scope="col">Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTestimonials.map((t) => {
                      const pending = t.status === "pending";
                      const tone: Tone =
                        t.status === "approved"
                          ? "green"
                          : pending
                            ? "amber"
                            : "neutral";

                      return (
                        <tr key={t.id}>
                          <td>
                            <strong>{t.workspaceName}</strong>
                            <small>
                              {t.name} · {t.ownerEmail}
                            </small>
                            {t.business && <small>{t.business}</small>}
                          </td>
                          <td>
                            <Stars rating={t.rating} />
                            <p className="admin-quote">{t.quote}</p>
                          </td>
                          <td>
                            <Badge tone={tone}>{t.status}</Badge>
                          </td>
                          <td>
                            {pending ? (
                              <div className="admin-actions">
                                <button
                                  type="button"
                                  className="primary"
                                  disabled={busy === t.id}
                                  onClick={() =>
                                    void reviewTestimonial(t.id, "approved")
                                  }
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  className="secondary-button"
                                  disabled={busy === t.id}
                                  onClick={() =>
                                    void reviewTestimonial(t.id, "denied")
                                  }
                                >
                                  Deny
                                </button>
                              </div>
                            ) : (
                              <span className="muted">Reviewed</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ---------------- Workspaces ---------------- */}
          <section className="admin-block" aria-labelledby="admin-workspaces-title">
            <header className="admin-block-head">
              <div>
                <span className="eyebrow">WORKSPACES</span>
                <h2 id="admin-workspaces-title">Plans &amp; access</h2>
                <p>
                  {sortedWorkspaces.length === 0
                    ? "No matching workspaces."
                    : `Showing ${(workspacePage - 1) * workspacePageSize + 1}–${Math.min(
                        workspacePage * workspacePageSize,
                        sortedWorkspaces.length,
                      )} of ${sortedWorkspaces.length} workspaces.`}
                </p>
              </div>
              <div className="admin-workspace-controls">
                <label className="admin-search">
                  <Search size={16} aria-hidden="true" />
                  <span className="sr-only">Search workspaces</span>
                  <input
                    type="search"
                    placeholder="Search name, email or ID"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <label className="admin-control-field">
                  <span>Subscription</span>
                  <select value={subscriptionFilter} onChange={(event) => setSubscriptionFilter(event.target.value)}>
                    <option value="All">All plans</option>
                    {data.plans.map((plan) => <option key={plan} value={plan}>{plan}</option>)}
                  </select>
                </label>
                <label className="admin-control-field admin-sort-field">
                  <span>Sort by</span>
                  <select value={`${sortBy}:${sortDirection}`} onChange={(event) => updateSort(event.target.value)}>
                    <option value="alphabetical:asc">Alphabetical · A–Z</option>
                    <option value="alphabetical:desc">Alphabetical · Z–A</option>
                    <option value="accountCreated:asc">Account created · Oldest first</option>
                    <option value="accountCreated:desc">Account created · Newest first</option>
                    <option value="planActivated:asc">Plan activation · Oldest first</option>
                    <option value="planActivated:desc">Plan activation · Newest first</option>
                    <option value="planExpires:asc">Plan expiration · Soonest first</option>
                    <option value="planExpires:desc">Plan expiration · Latest first</option>
                    <option value="subscription:asc">Subscription · A–Z</option>
                    <option value="subscription:desc">Subscription · Z–A</option>
                  </select>
                </label>
              </div>
            </header>

            <div className="admin-table-wrap">
              <table className="admin-table admin-table-workspaces">
                <thead>
                  <tr>
                    <th scope="col">Owner / workspace</th>
                    <th scope="col">Region &amp; price</th>
                    <th scope="col">Usage</th>
                    <th scope="col">Plan &amp; access</th>
                    <th scope="col">Dates</th>
                  </tr>
                </thead>
                <tbody>
                  {workspaces.map((item) => {
                    const access = getAccess(item);
                    const isBusy = busy === item.id;

                    return (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.owner.name || item.owner.email}</strong>
                          <small>{item.owner.email}</small>
                          <span className="admin-workspace-name">{item.name}</span>
                          <small className="admin-id" title={item.id}>
                            ID {item.id}
                          </small>
                          <span className="admin-member-count">
                            <Users size={13} aria-hidden="true" />
                            {item.memberCount}{" "}
                            {item.memberCount === 1 ? "member" : "members"}
                          </span>
                        </td>

                        <td>
                          <strong>
                            {item.countryCode || "Unknown · USD default"}
                          </strong>
                          {item.subscription === "Enterprise" ? (
                            <small>Custom pricing</small>
                          ) : item.subscription === "Free" ? (
                            <small>No paid plan selected</small>
                          ) : (
                            <>
                              <small>
                                {item.price.currency}{" "}
                                {item.price.monthly.toLocaleString()} / month
                              </small>
                              <small>
                                {item.price.currency}{" "}
                                {item.price.yearly.toLocaleString()} / year
                              </small>
                            </>
                          )}
                        </td>

                        <td>
                          <dl className="admin-usage">
                            <div>
                              <dt>Products</dt>
                              <dd>{item.usage.products}</dd>
                            </div>
                            <div>
                              <dt>Sales</dt>
                              <dd>{item.usage.sales}</dd>
                            </div>
                            <div>
                              <dt>Purchases</dt>
                              <dd>{item.usage.purchases}</dd>
                            </div>
                            <div>
                              <dt>Customers</dt>
                              <dd>{item.usage.customers}</dd>
                            </div>
                            <div>
                              <dt>Suppliers</dt>
                              <dd>{item.usage.suppliers}</dd>
                            </div>
                            <div>
                              <dt>Activity</dt>
                              <dd>{item.usage.activity}</dd>
                            </div>
                          </dl>
                        </td>

                        <td>
                          <select
                            aria-label={`Subscription for ${item.name}`}
                            value={item.subscription}
                            disabled={isBusy}
                            onChange={(event) =>
                              void changePlan(item.id, event.target.value)
                            }
                          >
                            {data.plans.map((plan) => (
                              <option key={plan} value={plan}>
                                {planLabel(plan, item.countryCode)}
                              </option>
                            ))}
                          </select>
                          <div className="admin-access">
                            <Badge tone={access.tone}>{access.label}</Badge>
                            {item.planActive && (
                              <button
                                type="button"
                                className="admin-danger-link"
                                disabled={isBusy}
                                onClick={() => void cancelPlan(item)}
                              >
                                Cancel plan
                              </button>
                            )}
                          </div>
                        </td>

                        <td>
                          <dl className="admin-dates">
                            <div>
                              <dt>Account created</dt>
                              <dd>{formatDate(item.accountCreatedAt)}</dd>
                            </div>
                            <div>
                              <dt>Last activity</dt>
                              <dd>{formatDate(item.lastActivityAt)}</dd>
                            </div>
                            <div>
                              <dt>Plan activated</dt>
                              <dd>
                                {formatDate(
                                  item.planActivatedAt ||
                                    (item.planActive ? item.trialStartedAt : null),
                                )}
                              </dd>
                            </div>
                            <div>
                              <dt>Plan expires</dt>
                              <dd>{formatDate(item.planExpiresAt)}</dd>
                            </div>
                            {item.trialStartedAt && (
                              <div>
                                <dt>Trial</dt>
                                <dd>
                                  {formatDate(item.trialStartedAt)} →{" "}
                                  {formatDate(item.trialEndsAt)}
                                </dd>
                              </div>
                            )}
                          </dl>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {workspaces.length === 0 && (
                <p className="admin-empty">
                  {data.workspaces.length === 0
                    ? "No workspaces yet."
                    : "No workspaces match your search."}
                </p>
              )}
              {sortedWorkspaces.length > workspacePageSize && (
                <nav className="admin-pagination" aria-label="Workspace pages">
                  <button type="button" className="secondary-button" disabled={workspacePage === 1} onClick={() => setWorkspacePage((page) => page - 1)}>Previous</button>
                  <span>Page {workspacePage} of {workspacePageCount}</span>
                  <button type="button" className="secondary-button" disabled={workspacePage === workspacePageCount} onClick={() => setWorkspacePage((page) => page + 1)}>Next</button>
                </nav>
              )}
            </div>
          </section>
        </>
      )}
    </section>
  );
}
