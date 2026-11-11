"use client";
import { useEffect, useState } from "react";

export type CollectionFilters = {
  collection: string;
  module?: string;
  query?: string;
  secondaryQuery?: string;
  productId?: string;
  productRole?: string;
  actor?: string;
  moduleFilter?: string;
  week?: string;
  accountId?: string;
  bankOnly?: boolean;
  secondaryFrom?: string;
  secondaryTo?: string;
  from?: string;
  to?: string;
  category?: string;
  status?: string;
  paymentMethod?: string;
  contactId?: string;
  postedOnly?: boolean;
  noContactOnly?: boolean;
  unpaidOnly?: boolean;
  tradeId?: string;
  forwardableOnly?: boolean;
  productIds?: string[];
  pageSize?: number;
  enabled?: boolean;
};
export type CollectionPage<T> = {
  records: T[];
  count: number;
  page: number;
  pageSize: number;
  aggregates?: Record<string, any>;
  meta?: Record<string, unknown>;
};
export function useServerCollection<T>(filters: CollectionFilters) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CollectionPage<T>>({ records: [], count: 0, page: 1, pageSize: filters.pageSize || 25 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { collection, module = "", query = "", secondaryQuery = "", productId = "", productIds = [], productRole = "", contactId = "", postedOnly = false, noContactOnly = false, unpaidOnly = false, tradeId = "", forwardableOnly = false, actor = "", moduleFilter = "", week = "", accountId = "", bankOnly = false, secondaryFrom = "", secondaryTo = "", from = "", to = "", category = "All", status = "All", paymentMethod = "All", pageSize = 25, enabled = true } = filters;
  const productIdsKey = productIds.join(",");
  useEffect(() => { setPage(1); }, [collection, module, query, secondaryQuery, productId, productIdsKey, productRole, contactId, postedOnly, noContactOnly, unpaidOnly, tradeId, forwardableOnly, actor, moduleFilter, week, accountId, bankOnly, secondaryFrom, secondaryTo, from, to, category, status, paymentMethod, pageSize]);
  useEffect(() => {
    if (!enabled) { setLoading(false); setError(""); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams({ collection, module, q: query, q2: secondaryQuery, productId, productIds: productIdsKey, productRole, contactId, postedOnly: postedOnly ? "1" : "0", noContactOnly: noContactOnly ? "1" : "0", unpaidOnly: unpaidOnly ? "1" : "0", tradeId, forwardableOnly: forwardableOnly ? "1" : "0", actor, moduleFilter, week, accountId, bankOnly: bankOnly ? "1" : "0", from2: secondaryFrom, to2: secondaryTo, from, to, category, status, paymentMethod, page: String(page), pageSize: String(pageSize) });
      setLoading(true);
      try {
        const response = await fetch(`/api/workspace?${params}`, { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load records.");
        setData(result);
        setError("");
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not load records.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 120);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [collection, module, query, secondaryQuery, productId, productIdsKey, productRole, contactId, postedOnly, noContactOnly, unpaidOnly, tradeId, forwardableOnly, actor, moduleFilter, week, accountId, bankOnly, secondaryFrom, secondaryTo, from, to, category, status, paymentMethod, page, pageSize, enabled]);
  return { ...data, loading, error, setPage, pageCount: Math.max(1, Math.ceil(data.count / data.pageSize)) };
}
