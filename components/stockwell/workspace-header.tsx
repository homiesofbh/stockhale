"use client";
import styles from "./workspace-header.module.css";
import { nav, type Module } from "@/components/stockwell/navigation";
import { useWorkspace } from "@/lib/stockwell/use-workspace";
import type { Workspace } from "@/lib/stockwell/workspace";
import { recordCollectionLabels } from "@/lib/stockwell/workspace";
import { Bell, ChevronDown, Download, LogOut, RefreshCw, Settings, ShieldAlert, Trash2 } from "lucide-react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useEffect, useState } from "react";
import { Modal } from "@/components/stockwell/ui";
type Props = {
  go: (m: Module) => void;
  canAccess: (name: string) => boolean;
  module: Module;
  profileMenu: RefObject<HTMLDetailsElement | null>;
  account: Workspace;
  workspace: ReturnType<typeof useWorkspace>;
  notificationReturn: RefObject<Module>;
  setProductSearch: Dispatch<SetStateAction<string>>;
  setModule: Dispatch<SetStateAction<Module>>;
  setNotice: Dispatch<SetStateAction<string>>;
};
export function WorkspaceHeader({
  go,
  canAccess,
  module,
  profileMenu,
  account,
  workspace,
  notificationReturn,
  setProductSearch,
  setModule,
  setNotice,
}: Props) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewActing, setReviewActing] = useState(false);
  const reviewBusy = reviewLoading || reviewActing || workspace.syncing;
  const hasConflict = workspace.review?.conflict || workspace.syncStatus.startsWith("Conflict");
  const needsHelp = hasConflict && workspace.review?.canRecover === false;
  const syncLabel = workspace.syncing ? "Saving changes…"
    : !workspace.cache?.queue.length && !workspace.syncError ? "All changes saved"
    : hasConflict ? "Saved on this device · needs review"
    : workspace.syncStatus.startsWith("Offline") ? "Offline · changes saved on this device"
    : workspace.syncStatus.startsWith("Server unavailable") ? "Waiting for connection · changes saved on this device"
    : workspace.syncStatus.startsWith("Session expired") ? "Sign in again to save online"
    : workspace.syncError ? "Saved on this device · needs review" : "Saving changes…";
  async function runReviewAction(action: () => Promise<unknown>) {
    setReviewActing(true);
    setReviewError("");
    try { await action(); await inspect(); }
    catch (e) { setReviewError(e instanceof Error ? e.message : "Could not complete this action."); }
    finally { setReviewActing(false); }
  }
  async function inspect() {
    setReviewError("");
    setReviewLoading(true);
    try { await workspace.inspectPending(); }
    catch (e) { setReviewError(e instanceof Error ? e.message : "Could not check server records."); }
    finally { setReviewLoading(false); }
  }
  useEffect(() => {
    if (reviewOpen) void inspect();
  }, [reviewOpen]);
  function openReview() {
    if (profileMenu.current) profileMenu.current.open = false;
    setReviewOpen(true);
  }
  const readIndex = account.audit.findIndex((event) => event.id === account.readEvent);
  const unreadCount = account.member.role === "owner"
    ? readIndex < 0 ? account.audit.length : readIndex
    : 0;
  return (
    <header className="topbar">
      <a
        className="brand"
        href="#"
        onClick={(e) => {
          e.preventDefault();
          go(canAccess("Dashboard") ? "Dashboard" : module);
        }}
      >
        <span className="brand-mark">
          <span>S</span>
        </span>
        STOCKHALE<span className="brand-dot">.</span>
      </a>
      <span className="retail-pill">RETAIL</span>
      <nav className="top-navigation" aria-label="Main navigation">
        {nav
          .filter(({ name }) => canAccess(name))
          .map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={module === name ? "active" : ""}
              onClick={() => go(name)}
              aria-label={name}
              aria-current={module === name ? "page" : undefined}
              title={name}
            >
              <Icon size={20} strokeWidth={1.5} />
              <span className="nav-label">{name}</span>
            </button>
          ))}
      </nav>
      <details
        className={styles.profileMenu}
        ref={profileMenu}
        onKeyDown={(e) => {
          if (e.key === "Escape" && profileMenu.current)
            profileMenu.current.open = false;
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null))
            e.currentTarget.open = false;
        }}
      >
        <summary className="top-profile" aria-label={`Profile and navigation${unreadCount ? `, ${unreadCount} unread notifications` : ""}`}>
          <span>{account.name}</span>
          <span className={`profile-orb ${unreadCount ? styles.notificationCounter : ""}`}>
            {unreadCount ? (
              <span aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>
            ) : account.image ? (
              <img src={account.image} alt={account.name} />
            ) : (
              account.name.slice(0, 1)
            )}
          </span>
          <ChevronDown size={16} />
        </summary>
        <div className={styles.dropdown}>
          <p>
            {account.member.name} · {account.member.role}
          </p>
          <nav className={styles.mobileNavigation} aria-label="Mobile navigation">
            {nav
              .filter(({ name }) => canAccess(name))
              .map(({ name, icon: Icon }) => (
                <button
                  key={name}
                  aria-current={module === name ? "page" : undefined}
                  onClick={() => go(name)}
                >
                  <Icon size={18} />
                  {name}
                </button>
              ))}
          </nav>
          <button disabled={workspace.syncing} onClick={() => workspace.syncError ? openReview() : void workspace.sync()}>
            <RefreshCw size={16} /> {syncLabel}
            {workspace.cache?.queue.length
              ? ` (${workspace.cache.queue.length})`
              : ""}
          </button>
          {account.member.role === "owner" && (
            <>
              <button
                onClick={() => {
                  notificationReturn.current = module;
                  setProductSearch("");
                  setModule("Notifications");
                  if (profileMenu.current) profileMenu.current.open = false;
                }}
              >
                <Bell size={16} /> Notifications & logs{" "}
                {unreadCount ? (
                  <span className="badge paid">{unreadCount} unread</span>
                ) : null}
              </button>
              <button
                onClick={() => {
                  setProductSearch("");
                  setModule("Settings");
                  if (profileMenu.current) profileMenu.current.open = false;
                }}
              >
                <Settings size={16} /> Settings
              </button>
            </>
          )}
          <button
            onClick={() =>
              void workspace.signout().catch((e) => setNotice(e.message))
            }
          >
            <LogOut size={16} /> Sign out
          </button>
          {!!workspace.cache?.queue.length && (
            <>
              <button onClick={openReview}>
                <ShieldAlert size={16} /> View device changes
              </button>
            </>
          )}
        </div>
      </details>
      {reviewOpen && workspace.cache && <Modal className={styles.syncReviewModal} title="Your saved changes" eyebrow="STOCKHALE" close={() => { if (!reviewActing) setReviewOpen(false); }}>
        <div className={styles.syncReview}>
          <div className={styles.syncReviewBody} tabIndex={0} role="region" aria-label="Sync review details">
            <div className={`${styles.syncReviewAlert} ${!workspace.cache.queue.length ? styles.syncReviewSuccess : ""}`} role="status">
              <ShieldAlert size={20} />
              <div><strong>{workspace.cache.queue.length ? "Your work is safe on this device." : "All changes are saved online."}</strong><p>{workspace.cache.queue.length ? needsHelp ? account.member.role === "owner" ? "A saved change needs your review. Save a copy, then check the details below." : "A saved change needs review. Ask the owner to check it before saving online." : "We save your changes online automatically. If saving is interrupted, you can try again below." : "You can close this window and continue working."}</p></div>
            </div>
            {reviewLoading && <p role="status">Checking your saved changes…</p>}
            {reviewError && <p className="form-error" role="alert">{reviewError}</p>}
            {workspace.review && <div className={styles.syncReviewDetails}>
              <strong>Waiting to save online: {workspace.cache.queue[0]?.action}</strong>
              <p>Saved under: {workspace.cache.queue[0]?.module}</p>
              {!!workspace.review.collections.length && <p>Records changed: {workspace.review.collections.map(key => recordCollectionLabels[key] || key).join(", ")}</p>}
              <details><summary>Details for the owner</summary><p>{workspace.review.message}</p>
              {!workspace.review.candidates.includes(workspace.cache.queue[0]?.module || "") && workspace.review.candidates.map(module => <button key={module} className="secondary" disabled={reviewBusy} onClick={() => void runReviewAction(() => workspace.resolvePending(module))}>Correct module to {module} and sync</button>)}
              </details>
            </div>}
            <div className={styles.syncReviewStats}><span><b>{workspace.cache.queue.length}</b> changes waiting to save online</span><span><b>{new Set(workspace.cache.queue.map(change => change.module)).size}</b> sections involved</span></div>
            <div className={styles.syncReviewList} aria-label="Pending changes">
              {workspace.cache.queue.slice(0, 20).map((change, index) => <div key={change.id} className={styles.syncReviewItem}><span>#{index + 1}</span><div><strong>{change.action || "Record change"}</strong><small>{change.module} · {new Date(change.occurredAt).toLocaleString("en-PK")}</small></div></div>)}
              {workspace.cache.queue.length > 20 && <small>Showing the first 20 changes. Save a copy to keep a copy of all changes.</small>}
            </div>
          </div>
          <div className={styles.syncReviewActions}>
            <button className="secondary" disabled={reviewActing || !workspace.cache.queue.length} onClick={workspace.exportPending}><Download size={16} /> Save a copy</button>
            <button className="primary" disabled={reviewBusy} onClick={() => { if (workspace.cache?.queue.length) void runReviewAction(workspace.sync); else setReviewOpen(false); }}><RefreshCw size={16} /> {workspace.syncing || reviewActing ? "Saving…" : reviewLoading ? "Checking…" : workspace.cache.queue.length ? "Try again" : "Done"}</button>
          </div>
          {hasConflict && account.member.role === "owner" && <details className={styles.syncReviewOwnerTools}><summary>Owner recovery options</summary><div className={styles.syncReviewDangerZone}><p>Replace this device’s changes?<small>This deletes the changes waiting to save online. Save a copy first.</small></p><button className={styles.syncReviewDiscard} disabled={reviewBusy} onClick={() => void runReviewAction(workspace.useServer)}><Trash2 size={16} /> Delete device changes</button></div></details>}
        </div>
      </Modal>}
    </header>
  );
}
