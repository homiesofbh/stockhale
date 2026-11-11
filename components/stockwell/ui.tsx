"use client";
import { Info, Package, X } from "lucide-react";
import {
  cloneElement,
  useEffect,
  useRef,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactElement<{ "aria-label"?: string }>;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {cloneElement(
        children,
        {
          "aria-label": label,
        },
      )}
    </label>
  );
}
export function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function InfoTip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <details className="info-tip-wrap">
      <summary
        className="info-tip-trigger"
        aria-label={label}
        aria-controls={id}
        title={`${label} — select to expand`}
      >
        <Info size={15} aria-hidden="true" />
      </summary>
      <div className="info-tip-popover" id={id} role="note">
        <strong>{label}</strong>
        <div>{children}</div>
      </div>
    </details>
  );
}
export function Empty({
  title = "No records yet",
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Package size={32} strokeWidth={1.3} />
      <h3>{title}</h3>
      <p>{children || "Your records will appear here as you work."}</p>
    </div>
  );
}
export function Table({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: ReactNode[][];
  empty?: string;
}) {
  if (!rows.length) return <Empty title={empty} />;
  return <>
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>;
}
export function ServerPagination({ page, pageCount, count, pageSize, setPage }: { page: number; pageCount: number; count: number; pageSize: number; setPage: (page: number) => void }) {
  if (pageCount <= 1) return null;
  return <nav className="account-week-pagination" aria-label="Table pages">
    <button type="button" className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Previous</button>
    <span aria-live="polite">Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, count)} of {count} · Page {page} of {pageCount}</span>
    <button type="button" className="secondary" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>Next →</button>
  </nav>;
}
export function Modal({
  title,
  eyebrow = "STOCKHALE / NEW RECORD",
  children,
  close,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  close: () => void;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog ref={dialog} onCancel={(event) => { event.preventDefault(); close(); }} className={`modal ${className}`} aria-label={title}>
      <div className="modal-head">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <button
          className="icon-button"
          onClick={close}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Stat({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div className={`stat ${accent ? "accent" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
